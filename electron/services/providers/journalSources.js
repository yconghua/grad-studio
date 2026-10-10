/**
 * 期刊信息查询 · 数据源（ShowJCR 本地数据集 / 聚合数据 / Web of Science / 新锐学术）
 *
 *   - ShowJCR：开源数据集（GitHub 发布），随项目本地维护于 electron/data/jcr-data.json，
 *     数据文件缺失时该源标记不可用并提示导入路径（不编造数据）；
 *   - 聚合数据 JCR：需 Key（apis.juhe.cn/paper_info/search_jcr）；
 *   - Web of Science：需机构订阅/开发者 Key，无公开免 Key 端点，配置 Key 后仍可能不可用（降级提示）；
 *   - 新锐学术：需 Key（webapi.xr-scholar.com WebAPI 管理平台，开发者账号 + API Key）。
 * 统一返回 items：{ name, issn, eissn, publisher, impactFactor, jcrZone, casZone, casWarning, top, oa, ... }
 */
const fs = require('fs')
const path = require('path')
const { fetchJson } = require('./http')

const DATA_DIR = path.join(__dirname, '..', '..', 'data')
const JCR_FILE = path.join(DATA_DIR, 'jcr-data.json')

// 本地 ShowJCR 数据集加载（启动时读一次；文件缺失返回 null，不抛错）
let jcrData = null
try {
  if (fs.existsSync(JCR_FILE)) {
    const raw = fs.readFileSync(JCR_FILE, 'utf8')
    jcrData = JSON.parse(raw)
  }
} catch (e) {
  console.error('[tool] ShowJCR 数据文件解析失败:', e.message)
  jcrData = null
}

function normIssn(raw) {
  if (!raw) return ''
  return String(raw).replace(/[^0-9Xx]/g, '').toUpperCase()
}

const showJcr = {
  name: 'showJcr',
  label: 'ShowJCR（本地数据集）',
  requiresKey: false,
  async fetch(params) {
    if (!jcrData || !Array.isArray(jcrData) || !jcrData.length) {
      return { items: [], error: `本地数据集未导入（请将 ShowJCR 数据放入 ${JCR_FILE} 后重启）` }
    }
    const q = String(params.keyword || '').trim().toLowerCase()
    const issn = normIssn(params.issn || q)
    let list = jcrData
    if (issn) {
      list = jcrData.filter((j) => normIssn(j.issn) === issn || normIssn(j.eissn) === issn)
    } else if (q) {
      list = jcrData.filter((j) => String(j.name || '').toLowerCase().includes(q))
    }
    const items = list.slice(0, 8).map((j) => ({
      name: j.name || '',
      issn: j.issn || '',
      eissn: j.eissn || '',
      publisher: j.publisher || '',
      impactFactor: j.if2024 || j.if2023 || j.if2022 || null,
      if2022: j.if2022 || null,
      if2023: j.if2023 || null,
      if2024: j.if2024 || null,
      casZone: j.cas_zone_upgrade || j.cas_zone_base || '',
      casZoneBase: j.cas_zone_base || '',
      casWarning: !!j.cas_warning,
      top: !!j.top,
      oa: j.is_oa || '',
      source: 'ShowJCR'
    }))
    return { items }
  }
}

const juheJcr = {
  name: 'juheJcr',
  label: '聚合数据 JCR',
  requiresKey: true,
  keyName: 'juheJcr',
  async fetch(params, ctx) {
    const key = ctx && ctx.keys && ctx.keys.juheJcr
    if (!key) return { items: [], error: '未配置 Key' }
    const url = `https://apis.juhe.cn/paper_info/search_jcr?key=${encodeURIComponent(key)}&name=${encodeURIComponent(params.keyword)}`
    const r = await fetchJson(url)
    if (!r.ok) return { items: [], error: r.error }
    const body = r.data
    if (body.error_code !== 0) return { items: [], error: body.reason || '接口返回错误' }
    const list = (body.result && body.result.list) || (Array.isArray(body.result) ? body.result : [])
    const items = list.map((j) => ({
      name: j.name || j.journal_name || '',
      issn: j.issn || '',
      eissn: j.eissn || '',
      publisher: j.publisher || '',
      impactFactor: j.impact_factor || j.if || null,
      jcrZone: j.jcr_zone || j.zone || '',
      casZone: j.cas_zone || '',
      casWarning: !!j.warning,
      top: !!j.top,
      source: '聚合数据'
    }))
    return { items }
  }
}

const webOfScience = {
  name: 'webOfScience',
  label: 'Web of Science',
  requiresKey: true,
  keyName: 'webOfScience',
  async fetch() {
    // WoS 无公开免 Key 端点，需机构订阅/开发者 Key；已配置 Key 时仍可能受订阅范围限制
    return { items: [], error: 'Web of Science 需机构订阅或开发者访问权限，当前环境不可用（请以其他数据源结果为准）' }
  }
}

// 新锐学术 WebAPI 端点（webapi.xr-scholar.com 为 WebAPI 管理平台，需开发者账号与 API Key）。
// 接口鉴权与参数以开发者文档为准；如形态不同，调整下方端点常量与 query/header 拼装即可。
const XR_API_ENDPOINT = 'https://webapi.xr-scholar.com/api/journal'

const xrScholar = {
  name: 'xrScholar',
  label: '新锐学术（新锐分区）',
  requiresKey: true,
  keyName: 'xrScholar',
  async fetch(params, ctx) {
    const key = ctx && ctx.keys && ctx.keys.xrScholar
    if (!key) return { items: [], error: '未配置 Key' }
    const qs = []
    if (params.issn) qs.push(`issn=${encodeURIComponent(params.issn)}`)
    if (params.keyword) qs.push(`journal=${encodeURIComponent(params.keyword)}`)
    if (!qs.length) return { items: [], error: '缺少查询参数' }
    qs.push(`key=${encodeURIComponent(key)}`)
    const r = await fetchJson(`${XR_API_ENDPOINT}?${qs.join('&')}`, {
      headers: { Authorization: `Bearer ${key}` }
    })
    if (!r.ok) return { items: [], error: r.error }
    const body = r.data
    const list = (body && (body.result || body.data || body.list)) || []
    const arr = Array.isArray(list) ? list : [list]
    const items = arr.filter(Boolean).map((j) => ({
      name: j.name || j.journal_name || j.journal || '',
      issn: j.issn || j.print_issn || '',
      eissn: j.eissn || j.online_issn || '',
      publisher: j.publisher || '',
      impactFactor: j.impact_factor || j.if || j.if2026 || null,
      jcrZone: j.jcr_zone || '',
      casZone: j.zone || j.cas_zone || '',
      xrZone: j.zone || j.xr_zone || '',
      xrTop: !!(j.top || j.is_top),
      casWarning: !!(j.warning || j.is_warning),
      source: '新锐学术'
    }))
    if (!items.length) return { items: [], error: body.message || '未查询到期刊数据' }
    return { items }
  }
}

// DOAJ：开放获取期刊目录，免 Key；提供 OA 期刊元数据（无影响因子）
const doaj = {
  name: 'doaj',
  label: 'DOAJ（开放获取）',
  requiresKey: false,
  async fetch(params) {
    const q = params.issn ? `issn:${encodeURIComponent(params.issn)}` : encodeURIComponent(params.keyword || '')
    const url = `https://doaj.org/api/search/journals/${q}?pageSize=${params.limit || 8}`
    const r = await fetchJson(url)
    if (!r.ok) return { items: [], error: r.error }
    const items = ((r.data && r.data.results) || []).map((res) => {
      const b = res.bibjson || {}
      return {
        name: b.title || '',
        issn: b.issn || '',
        eissn: b.eissn || '',
        publisher: b.publisher || '',
        impactFactor: null,
        casZone: '',
        oa: 'oa',
        top: false,
        source: 'DOAJ'
      }
    })
    return { items }
  }
}

// Scimago SJR：无公开 JSON API（仅网页与数据文件），注册为源但提示不可用
const scimago = {
  name: 'scimago',
  label: 'Scimago SJR',
  requiresKey: false,
  async fetch() {
    return { items: [], error: 'Scimago 无公开 JSON API（仅网页查询与数据文件下载），当前环境不可用（请以其他数据源结果为准）' }
  }
}

// Scopus 期刊：Elsevier 期刊指标，付费（需 API Key，机构订阅范围受限）
const scopusJournal = {
  name: 'scopusJournal',
  label: 'Scopus（期刊）',
  requiresKey: true,
  keyName: 'scopus',
  async fetch(params, ctx) {
    const key = ctx && ctx.keys && ctx.keys.scopus
    if (!key) return { items: [], error: '未配置 Key' }
    const url = `https://api.elsevier.com/content/serial/title?title=${encodeURIComponent(params.keyword || '')}&apiKey=${encodeURIComponent(key)}`
    const r = await fetchJson(url, { headers: { 'X-ELS-APIKey': key } })
    if (!r.ok) return { items: [], error: r.error }
    const list = ((r.data && r.data['serial-response'] && r.data['serial-response'].entry) || []).filter(Boolean)
    const items = list.map((j) => {
      const cs = j.citeScoreYearInfoList || {}
      return {
        name: j['dc:title'] || '',
        issn: (j['prism:issn'] || '').replace(/-/g, ''),
        eissn: (j['prism:eIssn'] || '').replace(/-/g, ''),
        publisher: j.publisher || '',
        impactFactor: cs.citeScoreCurrentMetric || null,
        jcrZone: '',
        casZone: '',
        oa: j.openaccessArticle ? 'oa' : '',
        top: false,
        source: 'Scopus'
      }
    })
    return { items }
  }
}

module.exports = { journalSources: [showJcr, juheJcr, webOfScience, xrScholar, doaj, scimago, scopusJournal] }
