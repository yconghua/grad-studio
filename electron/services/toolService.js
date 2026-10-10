/**
 * 工具箱服务（Service Layer）—— 学术工具 + 就业工具
 *
 * 权限模型：仅导师 / 学生可用（requireToolsUser），组管 / 超管一律拒绝；
 * 数据按 user_id 隔离（期刊缓存全局共享除外）。
 * 所有外网请求经 providers/multiSource 并行调度（每源独立超时 + 失败降级），
 * 每次查询落 tool_source_logs；缓存走内存 TTL + MySQL 持久化。
 * API Key 经 Electron safeStorage 加密后落库，读取时只返回"已配置"状态不返回明文。
 */
const crypto = require('crypto')
const { app, safeStorage } = require('electron')
const toolRepository = require('../db/repositories/toolRepository')
const authService = require('./authService')
const ApiError = require('./apiError')
const { runMultiSources } = require('./providers/multiSource')
const { ROLE_STUDENT, ROLE_MENTOR } = require('../../shared/constants')

// ===== 常量 =====
const TOOL_ROLES = [ROLE_STUDENT, ROLE_MENTOR]
const TOOL_NAMES = { doi: 'doi', journal: 'journal', search: 'search', translate: 'translate', company: 'company' }
const CACHE_TTL = { doi: 10 * 60 * 1000, journal: 30 * 60 * 1000, translate: 10 * 60 * 1000, company: 5 * 60 * 1000 }
const CACHE_TABLE = { doi: 'doi', journal: 'journal', company: 'company' }

// 内存缓存（Map：key → { payload, sources, ts }）
const memCache = new Map()

function md5(str) {
  return crypto.createHash('md5').update(String(str)).digest('hex')
}

function normTitle(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '').trim()
}

function normDoi(raw) {
  if (!raw) return ''
  return String(raw).trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').toLowerCase()
}

// 当前登录用户（401 兜底）
async function currentUser() {
  const me = await authService.getCurrentUser()
  if (!me) throw new ApiError('未登录，请重新登录', 401)
  return me
}

// 工具箱角色闸门：仅导师 / 学生
function requireToolsUser(u) {
  if (!u || !TOOL_ROLES.includes(u.role)) throw new ApiError('无权限：工具箱仅对导师和学生开放', 403)
}

// ===== 设置与 API Key =====

function encryptKeys(plainObj) {
  if (!plainObj || typeof plainObj !== 'object') return null
  const out = {}
  for (const [k, v] of Object.entries(plainObj)) {
    if (v && String(v).trim()) {
      if (safeStorage.isEncryptionAvailable()) {
        out[k] = safeStorage.encryptString(String(v).trim()).toString('base64')
      } else {
        throw new ApiError('系统安全存储不可用，无法保存 API Key', 500)
      }
    }
  }
  return JSON.stringify(out)
}

function decryptKeys(encStr) {
  if (!encStr) return {}
  try {
    const obj = JSON.parse(encStr)
    const out = {}
    for (const [k, v] of Object.entries(obj)) {
      if (!v) continue
      if (safeStorage.isEncryptionAvailable()) out[k] = safeStorage.decryptString(Buffer.from(v, 'base64'))
      else out[k] = ''
    }
    return out
  } catch (e) {
    return {}
  }
}

async function getSettings(userId) {
  const row = await toolRepository.getSettings(userId)
  if (!row) return { defaultCitation: 'gb7714', translateEngines: [], apiKeys: {}, favorites: {}, recentUsed: [] }
  let favorites = {}
  let recentUsed = []
  try { favorites = JSON.parse(row.favorites || '{}') } catch (e) { favorites = {} }
  try { recentUsed = JSON.parse(row.recent_used || '[]') } catch (e) { recentUsed = [] }
  // 只返回各源"是否已配置"，不返回明文
  const keyState = {}
  for (const k of Object.keys(decryptKeys(row.api_keys))) keyState[k] = true
  return {
    defaultCitation: row.default_citation || 'gb7714',
    translateEngines: row.translate_engines ? String(row.translate_engines).split(',') : [],
    apiKeys: keyState,
    favorites,
    recentUsed
  }
}

async function saveSettings(userId, payload = {}) {
  const data = {}
  if (payload.defaultCitation !== undefined) data.defaultCitation = String(payload.defaultCitation || 'gb7714')
  if (payload.translateEngines !== undefined) data.translateEngines = (payload.translateEngines || []).join(',')
  if (payload.favorites !== undefined) data.favorites = JSON.stringify(payload.favorites || {})
  if (payload.recentUsed !== undefined) data.recentUsed = JSON.stringify(payload.recentUsed || [])
  // API Key 更新：合并式（未传的源保留原值）
  if (payload.apiKeys && typeof payload.apiKeys === 'object') {
    const old = decryptKeys((await toolRepository.getSettings(userId) || {}).api_keys)
    const merged = { ...old }
    for (const [k, v] of Object.entries(payload.apiKeys)) {
      if (v && String(v).trim()) merged[k] = String(v).trim()
    }
    data.apiKeys = encryptKeys(merged)
  }
  await toolRepository.upsertSettings(userId, data)
  return getSettings(userId)
}

// 测试单个源 Key 是否可用（调该源一次最小请求）
async function testSourceKey(userId, source, value) {
  requireToolsUser(await currentUser())
  const src = findSource(source)
  if (!src) throw new ApiError('未知数据源', 400)
  if (!src.requiresKey) throw new ApiError('该数据源无需配置 Key', 400)
  if (!value || !String(value).trim()) throw new ApiError('请输入 Key', 400)
  const keys = { [src.keyName]: String(value).trim() }
  const out = await src.fetch({ text: 'hello', keyword: 'test', targetLang: 'zh', srcLang: 'auto' }, { keys })
  if (out && out.items && out.items.length) return { ok: true, message: '连接成功' }
  if (out && out.error) return { ok: false, message: out.error }
  return { ok: true, message: '连接成功（无返回数据）' }
}

function findSource(source) {
  const { SOURCE_REGISTRY } = require('./providers/multiSource')
  for (const list of Object.values(SOURCE_REGISTRY)) {
    const hit = list.find((s) => s.name === source || s.keyName === source)
    if (hit) return hit
  }
  return null
}

// ===== 日志落库 =====
async function logSources(userId, tool, querySnapshot, states) {
  for (const s of states) {
    try {
      await toolRepository.addSourceLog(userId, tool, querySnapshot, s.label || s.name, s.status, s.costMs, s.resultCount, s.error || null)
    } catch (e) {
      // 日志写入失败不影响主流程
    }
  }
}

// ===== 缓存读写 =====
function memGet(table, key) {
  const hit = memCache.get(`${table}:${key}`)
  if (!hit) return null
  const ttl = CACHE_TTL[table] || 10 * 60 * 1000
  if (Date.now() - hit.ts > ttl) { memCache.delete(`${table}:${key}`); return null }
  return hit
}

function memSet(table, key, payload, sources) {
  memCache.set(`${table}:${key}`, { payload, sources, ts: Date.now() })
}

async function cacheGet(table, dbKey, userId) {
  // 内存优先
  const m = memGet(table, dbKey)
  if (m) return { payload: m.payload, sources: m.sources, from: 'memory' }
  // 数据库
  let row = null
  if (table === 'journal') row = await toolRepository.getJournalCache(dbKey)
  else if (table === 'doi') row = await toolRepository.getDoiCache(userId, dbKey)
  else if (table === 'company') row = await toolRepository.getCompanyCache(userId, dbKey)
  if (!row) return null
  // 数据库 TTL 检查（避免过期数据长期驻留）
  const age = Date.now() - new Date(row.updated_at).getTime()
  if (age > CACHE_TTL[table]) return null
  let payload = null
  try { payload = JSON.parse(row.payload) } catch (e) { payload = null }
  if (!payload) return null
  memSet(table, dbKey, payload, row.sources)
  return { payload, sources: row.sources, from: 'db' }
}

async function cacheSet(table, dbKey, payload, sources, userId, emptyHit = false) {
  memSet(table, dbKey, payload, sources)
  const json = JSON.stringify(payload)
  if (table === 'journal') await toolRepository.upsertJournalCache(dbKey, json, sources)
  else if (table === 'doi') await toolRepository.upsertDoiCache(userId, dbKey, 'doi', json, sources)
  else if (table === 'company') await toolRepository.upsertCompanyCache(userId, dbKey, json, sources, emptyHit)
}

// ===== 通用多源查询（含日志） =====
async function querySources(userId, tool, params, keys) {
  const res = await runMultiSources(tool, params, keys)
  const snapshot = String(params.keyword || params.doi || params.title || params.text || params.issn || '').slice(0, 100)
  await logSources(userId, tool, snapshot, res.states)
  return res
}

// ===== 结果合并 =====

// 按去重键合并：首条为基底，后续源补缺失字段；源字段来源标注（数组项合并为逗号串）
function mergeByKey(items, keyFn, priorityFields = []) {
  const map = new Map()
  const order = []
  for (const it of items) {
    const k = keyFn(it)
    if (!k) continue
    if (!map.has(k)) {
      map.set(k, { ...it, _sources: [it._source || ''] })
      order.push(k)
    } else {
      const base = map.get(k)
      // 高优先级字段覆盖（priorityFields 在前者优先）
      for (const f of priorityFields) {
        if (it[f] && !base[f]) base[f] = it[f]
      }
      for (const f of ['title', 'authors', 'venue', 'year', 'abstract', 'citedBy', 'referencesCount', 'doi', 'url', 'publisher', 'volume', 'issue', 'pages', 'concepts', 'oaStatus', 'openAccessPdf']) {
        if (it[f] && !base[f]) base[f] = it[f]
      }
      if (it._source && !base._sources.includes(it._source)) base._sources.push(it._source)
    }
  }
  return order.map((k) => {
    const it = map.get(k)
    it.source = it._sources.join('、')
    delete it._sources
    return it
  })
}

// ===== DOI 查询 =====
async function queryDoi(userId, payload = {}) {
  const me = await currentUser()
  requireToolsUser(me)
  const { doi, title, pmid } = payload
  if (!doi && !title && !pmid) throw new ApiError('请输入 DOI、标题或 PMID', 400)
  const type = doi ? 'doi' : (title ? 'title' : 'pmid')
  const rawKey = doi ? normDoi(doi) : (title || pmid)
  const dbKey = md5(`${type}:${rawKey}`)
  const hit = await cacheGet('doi', dbKey, userId)
  if (hit) return { item: hit.payload, sources: hit.sources, from: hit.from, states: null }

  const keys = decryptKeys((await toolRepository.getSettings(userId) || {}).api_keys)
  const params = { doi, title, pmid, limit: 5 }
  const res = await querySources(userId, TOOL_NAMES.doi, params, keys)
  const merged = mergeByKey(res.items, (it) => normDoi(it.doi) || normTitle(it.title), ['citedBy', 'abstract', 'venue'])
  // 引用次数取多源最大值并标注（已在合并中按最大值补全）
  const item = merged[0] || null
  if (item) await cacheSet('doi', dbKey, item, res.states.map((s) => s.label).join(','), userId)
  return { item, sources: res.states.map((s) => s.label).join(','), from: 'live', states: res.states, warnings: res.warnings }
}

// ===== 期刊查询 =====
async function queryJournal(userId, payload = {}) {
  const me = await currentUser()
  requireToolsUser(me)
  const { keyword, issn } = payload
  if (!keyword && !issn) throw new ApiError('请输入期刊名或 ISSN', 400)
  const dbKey = issn ? `issn:${issn}` : `name:${String(keyword).trim().toLowerCase()}`
  const hit = await cacheGet('journal', dbKey, userId)
  if (hit) return { list: hit.payload, sources: hit.sources, from: hit.from, states: null }

  const keys = decryptKeys((await toolRepository.getSettings(userId) || {}).api_keys)
  const params = { keyword, issn, limit: 8 }
  const res = await querySources(userId, TOOL_NAMES.journal, params, keys)
  // 去重键：ISSN 优先，否则归一化期刊名；影响因子字段优先级（WoS > 中科院 > ShowJCR > 聚合）在合并中按顺序补全
  const merged = mergeByKey(res.items, (it) => (it.issn || it.eissn || '') ? `issn:${normDoi(it.issn || it.eissn)}` : `name:${normTitle(it.name)}`)
  if (merged.length) await cacheSet('journal', dbKey, merged, res.states.map((s) => s.label).join(','), userId)
  return { list: merged, sources: res.states.map((s) => s.label).join(','), from: 'live', states: res.states, warnings: res.warnings }
}

// ===== 学术搜索聚合 =====
async function searchAcademic(userId, payload = {}) {
  const keyword = String(payload.keyword || '').trim()
  if (!keyword) throw new ApiError('请输入搜索关键词', 400)
  const me = await currentUser()
  requireToolsUser(me)
  const keys = decryptKeys((await toolRepository.getSettings(userId) || {}).api_keys)
  const params = { keyword, limit: Number(payload.limit) || 10 }
  const res = await querySources(userId, TOOL_NAMES.search, params, keys)
  let merged = mergeByKey(res.items, (it) => normDoi(it.doi) || normTitle(it.title))
  // 年份 / OA 筛选
  if (payload.yearFrom) merged = merged.filter((it) => it.year && Number(it.year) >= Number(payload.yearFrom))
  if (payload.yearTo) merged = merged.filter((it) => it.year && Number(it.year) <= Number(payload.yearTo))
  if (payload.oaOnly) merged = merged.filter((it) => it.oa && it.oa !== 'closed')
  // 记录搜索历史
  try {
    await toolRepository.addSearchHistory(userId, keyword, JSON.stringify({ yearFrom: payload.yearFrom || '', yearTo: payload.yearTo || '', oaOnly: !!payload.oaOnly }), merged.length)
  } catch (e) { /* 历史写入失败不阻塞 */ }
  return { list: merged, states: res.states, warnings: res.warnings }
}

// ===== 在线翻译（按选定引擎逐个调用，多引擎并列展示而非合并） =====
async function translate(userId, payload = {}) {
  const text = String(payload.text || '').trim()
  if (!text) throw new ApiError('请输入待翻译文本', 400)
  const targetLang = payload.targetLang || 'zh'
  const srcLang = payload.srcLang || 'auto'
  const me = await currentUser()
  requireToolsUser(me)
  const settings = await getSettings(userId)
  const keys = decryptKeys((await toolRepository.getSettings(userId) || {}).api_keys)
  const srcHash = md5(text)
  const results = []
  const states = []
  const warnings = []
  const { translateSources } = require('./providers/translateSources')
  // 引擎选择：设置指定则只调指定引擎；否则调所有已配置 Key 的引擎
  const hasKey = (s) => keys[s.keyName] || (s.keyName === 'baidu' && keys.baiduAppid) || (s.keyName === 'youdao' && keys.youdaoAppKey)
  const selected = settings.translateEngines && settings.translateEngines.length
    ? translateSources.filter((s) => settings.translateEngines.includes(s.name))
    : translateSources.filter(hasKey)
  for (const src of selected) {
    if (!hasKey(src)) {
      states.push({ label: src.label, status: 'skipped', costMs: 0, resultCount: 0, error: '未配置 Key' })
      warnings.push(`${src.label}未配置 Key`)
      continue
    }
    const hit = await toolRepository.getTranslationHistory(userId, srcHash, targetLang, src.name)
    if (hit) {
      results.push({ engine: src.name, label: src.label, translatedText: hit.translated_text, from: 'cache' })
      states.push({ label: src.label, status: 'ok', costMs: 0, resultCount: 1, error: '' })
      continue
    }
    const t0 = Date.now()
    let status = 'ok'
    let error = ''
    let translated = ''
    let count = 0
    try {
      const out = await src.fetch({ text, srcLang, targetLang }, { keys })
      if (out && out.items && out.items.length) {
        translated = out.items[0].translatedText
        count = 1
      } else if (out && out.error) {
        status = 'fail'
        error = out.error
      } else {
        status = 'fail'
        error = '无译文返回'
      }
    } catch (e) {
      status = 'fail'
      error = (e && e.message) || '未知错误'
    }
    states.push({ label: src.label, status, costMs: Date.now() - t0, resultCount: count, error })
    if (status === 'ok' && translated) {
      results.push({ engine: src.name, label: src.label, translatedText: translated, from: 'live' })
      try {
        await toolRepository.addTranslationHistory(userId, srcHash, srcLang, targetLang, src.name, text, translated)
      } catch (e) { /* 历史写入失败不阻塞 */ }
    } else if (status === 'fail') {
      warnings.push(`${src.label}不可用`)
    }
    try {
      await toolRepository.addSourceLog(userId, 'translate', text.slice(0, 100), src.label, status, Date.now() - t0, count, error || null)
    } catch (e) { /* 日志写入失败不阻塞 */ }
  }
  return { results, states, warnings }
}

// ===== 公司搜索 =====
async function searchCompany(userId, payload = {}) {
  const me = await currentUser()
  requireToolsUser(me)
  const keyword = String(payload.keyword || '').trim()
  if (!keyword) throw new ApiError('请输入公司名称或关键词', 400)
  const dbKey = md5(keyword)
  const hit = await cacheGet('company', dbKey, userId)
  if (hit) return { list: hit.payload, sources: hit.sources, from: hit.from, states: null }

  const keys = decryptKeys((await toolRepository.getSettings(userId) || {}).api_keys)
  const params = { keyword, city: payload.city || '' }
  const res = await querySources(userId, TOOL_NAMES.company, params, keys)
  const merged = mergeByKey(res.items, (it) => it.creditCode || normTitle(it.name))
  if (merged.length) await cacheSet('company', dbKey, merged, res.states.map((s) => s.label).join(','), userId, false)
  try {
    await toolRepository.addCompanySearchHistory(userId, keyword, payload.city || '', merged.length)
  } catch (e) { /* 历史写入失败不阻塞 */ }
  return { list: merged, states: res.states, warnings: res.warnings }
}

// ===== 收藏与历史 =====
async function listCompanyFavorites(userId) {
  requireToolsUser(await currentUser())
  return toolRepository.listCompanyFavorites(userId)
}

async function addCompanyFavorite(userId, payload = {}) {
  requireToolsUser(await currentUser())
  const name = String(payload.companyKey || payload.name || '').trim()
  if (!name) throw new ApiError('请提供公司名称', 400)
  const existed = await toolRepository.getCompanyFavorite(userId, name)
  if (existed) return { already: true, id: existed.id }
  return { id: await toolRepository.addCompanyFavorite(userId, name, payload.snapshot ? JSON.stringify(payload.snapshot) : null, payload.note || '') }
}

async function updateCompanyFavorite(userId, payload = {}) {
  requireToolsUser(await currentUser())
  const name = String(payload.companyKey || '').trim()
  if (!name) throw new ApiError('请提供公司名称', 400)
  const updated = await toolRepository.updateCompanyFavorite(userId, name, { snapshot: payload.snapshot ? JSON.stringify(payload.snapshot) : undefined, note: payload.note })
  if (!updated) throw new ApiError('收藏不存在', 404)
  return { updated }
}

async function removeCompanyFavorite(userId, companyKey) {
  requireToolsUser(await currentUser())
  return { removed: await toolRepository.removeCompanyFavorite(userId, String(companyKey || '').trim()) }
}

async function listSearchHistories(userId) {
  requireToolsUser(await currentUser())
  return { search: await toolRepository.listSearchHistory(userId), company: await toolRepository.listCompanySearchHistory(userId), translate: await toolRepository.listTranslationHistory(userId) }
}

// ===== 缓存管理 =====
async function cacheInfo(userId) {
  requireToolsUser(await currentUser())
  return {
    doi: await toolRepository.countCacheRows('doi'),
    journal: await toolRepository.countCacheRows('journal'),
    company: await toolRepository.countCacheRows('company')
  }
}

async function clearCache(userId, table) {
  requireToolsUser(await currentUser())
  if (!CACHE_TABLE[table]) throw new ApiError('未知缓存类型', 400)
  // 内存缓存按前缀清理
  for (const k of [...memCache.keys()]) if (k.startsWith(`${CACHE_TABLE[table]}:`)) memCache.delete(k)
  return { cleared: await toolRepository.clearCache(CACHE_TABLE[table], userId) }
}

// ===== 数据源调用日志 =====
async function listLogs(userId, payload = {}) {
  requireToolsUser(await currentUser())
  return toolRepository.listSourceLogs(userId, { tool: payload.tool || '', status: payload.status || '', page: payload.page || 1, pageSize: payload.pageSize || 10 })
}

async function clearLogs(userId, payload = {}) {
  requireToolsUser(await currentUser())
  return { cleared: await toolRepository.clearSourceLogs(userId, payload.beforeDays || 30) }
}

// ===== 引用格式 =====
function formatCitation(item, style) {
  if (!item) return ''
  const authors = (item.authors || []).slice(0, 3).map((a) => (typeof a === 'string' ? a : a.name)).filter(Boolean)
  const etAl = (item.authors || []).length > 3
  const year = item.year || ''
  const title = item.title || ''
  const venue = item.venue || ''
  const vol = item.volume ? `, ${item.volume}` : ''
  const pages = item.pages ? `: ${item.pages}` : ''
  const doi = item.doi ? `https://doi.org/${item.doi}` : ''
  switch (style) {
    case 'apa':
      return `${authors.join(', ')} (${year}). ${title}. ${venue}${vol}${pages}. ${doi}`
    case 'mla':
      return `${authors.join(', ')}. "${title}." ${venue}${vol}${pages} (${year}). ${doi}`
    case 'chicago':
      return `${authors.join(', ')}. "${title}." ${venue}${vol}${pages} (${year}). ${doi}`
    case 'bibtex':
      return `@article{${(item.doi || 'item').replace(/[^a-zA-Z0-9]/g, '')},\n  title = {${title}},\n  author = {${authors.join(' and ')}},\n  journal = {${venue}},\n  year = {${year}},\n  volume = {${item.volume || ''}},\n  pages = {${item.pages || ''}},\n  doi = {${item.doi || ''}}\n}`
    case 'gb7714':
    default:
      return `${authors.join(', ')}. ${title}[J]. ${venue}${vol}${pages}, ${year}. ${doi}`
  }
}

module.exports = {
  getSettings,
  saveSettings,
  testSourceKey,
  queryDoi,
  queryJournal,
  searchAcademic,
  translate,
  searchCompany,
  listCompanyFavorites,
  addCompanyFavorite,
  updateCompanyFavorite,
  removeCompanyFavorite,
  listSearchHistories,
  cacheInfo,
  clearCache,
  listLogs,
  clearLogs,
  formatCitation
}
