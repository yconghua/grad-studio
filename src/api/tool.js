// 工具箱模块接口（tool:*）：仅导师/学生可见可用
// 统一封装：IPC 返回 { success, code, message, data }，此处解包 data；业务失败抛 Error
// 多源并行查询结果统一为 { item|list, sources, from, states, warnings }

async function unwrap(promise) {
  const res = await promise
  if (res && res.success === false) throw new Error(res.message || '操作失败')
  return res && res.data
}

// ===== 设置与 API Key =====
// 读取设置：返回 { defaultCitation, translateEngines, apiKeys:{源:已配置}, favorites, recentUsed }
export function getToolSettings() {
  return unwrap(window.api.tool.getSettings())
}
// 保存设置：apiKeys 传明文（仅未传的源保留原值）；返回更新后的设置（不含明文 Key）
export function saveToolSettings(payload) {
  return unwrap(window.api.tool.saveSettings(payload))
}
// 测试单个数据源 Key：{ source, value } → { ok, message }
export function testToolKey(source, value) {
  return unwrap(window.api.tool.testKey({ source, value }))
}

// ===== 学术工具 =====
// DOI 文献信息查询：{ doi | title | pmid } → { item, sources, from, states, warnings }
export function queryDoi(payload) {
  return unwrap(window.api.tool.doiQuery(payload))
}
// 期刊信息查询：{ keyword | issn } → { list, sources, from, states, warnings }
export function queryJournal(payload) {
  return unwrap(window.api.tool.journalQuery(payload))
}
// 学术搜索聚合：{ keyword, limit, yearFrom, yearTo, oaOnly } → { list, states, warnings }
export function searchAcademic(payload) {
  return unwrap(window.api.tool.search(payload))
}
// 在线翻译：{ text, srcLang, targetLang } → { results:[{engine,label,translatedText,from}], states, warnings }
export function translateText(payload) {
  return unwrap(window.api.tool.translate(payload))
}

// ===== 就业工具：公司搜索 =====
// 公司搜索：{ keyword, city } → { list, sources, from, states, warnings }
export function searchCompany(payload) {
  return unwrap(window.api.tool.companySearch(payload))
}
// 收藏列表
export function listCompanyFavorites() {
  return unwrap(window.api.tool.companyFavorites())
}
// 添加收藏：{ companyKey, snapshot?, note? } → { id | already }
export function addCompanyFavorite(payload) {
  return unwrap(window.api.tool.companyFavoriteAdd(payload))
}
// 更新收藏备注：{ companyKey, note?, snapshot? }
export function updateCompanyFavorite(payload) {
  return unwrap(window.api.tool.companyFavoriteUpdate(payload))
}
// 取消收藏：companyKey
export function removeCompanyFavorite(companyKey) {
  return unwrap(window.api.tool.companyFavoriteRemove({ companyKey }))
}

// ===== 历史 =====
// 搜索/翻译历史：{ search:[], company:[], translate:[] }
export function getToolHistories() {
  return unwrap(window.api.tool.histories())
}

// ===== 缓存管理 =====
// 各缓存行数：{ doi, journal, company }
export function getToolCacheInfo() {
  return unwrap(window.api.tool.cacheInfo())
}
// 清理指定缓存：table=doi|journal|company
export function clearToolCache(table) {
  return unwrap(window.api.tool.cacheClear({ table }))
}

// ===== 数据源调用日志 =====
// 分页日志：{ tool, status, page, pageSize } → { list, total, page, pageSize, totalPages }
export function getToolLogs(payload) {
  return unwrap(window.api.tool.logs(payload))
}
// 清理日志：{ beforeDays } 默认 30 天
export function clearToolLogs(beforeDays) {
  return unwrap(window.api.tool.logsClear({ beforeDays }))
}

// ===== 引用格式 =====
// 生成引用：{ item, style? } → 字符串；style 缺省用用户默认格式
export function formatCitation(item, style) {
  return unwrap(window.api.tool.citation({ item, style }))
}
