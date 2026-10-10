/**
 * 工具箱仓库（Repository Layer）—— 26~34 号工具表
 *
 * 本仓库多为缓存 / 历史 / 设置类表，**不带 is_deleted 软删列**，
 * 因此只复用基类的 create / _execute，其余全部自定义裸 SQL；
 * 清理（日志、过期缓存、历史）为物理删除。
 *
 * 方法按表组织：doi / journal / company 缓存、搜索与翻译历史、
 * 用户设置（含 API Key 加密串）、公司收藏、数据源调用日志。
 */
const BaseRepository = require('./BaseRepository')
const { buildWhereClause, normalizePage, buildPageMeta } = require('./queryHelpers')

class ToolRepository extends BaseRepository {
  constructor() {
    super('tool_doi_cache')
  }

  // ===== 26 DOI 查询缓存（user_id + query_key 唯一） =====

  async getDoiCache(userId, queryKey) {
    const sql = 'SELECT payload, sources, updated_at FROM `tool_doi_cache` WHERE user_id = ? AND query_key = ? LIMIT 1'
    const [rows] = await this._execute(sql, [Number(userId), queryKey], 'getDoiCache')
    return rows[0] || null
  }

  async upsertDoiCache(userId, queryKey, queryType, payload, sources) {
    const sql = `INSERT INTO \`tool_doi_cache\` (user_id, query_key, query_type, payload, sources)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE payload = VALUES(payload), sources = VALUES(sources), query_type = VALUES(query_type)`
    const [result] = await this._execute(sql, [Number(userId), queryKey, queryType, payload, sources], 'upsertDoiCache')
    return result.affectedRows
  }

  // ===== 27 期刊查询缓存（全局共享） =====

  async getJournalCache(queryKey) {
    const sql = 'SELECT payload, sources, updated_at FROM `tool_journal_cache` WHERE query_key = ? LIMIT 1'
    const [rows] = await this._execute(sql, [queryKey], 'getJournalCache')
    return rows[0] || null
  }

  async upsertJournalCache(queryKey, payload, sources) {
    const sql = `INSERT INTO \`tool_journal_cache\` (query_key, payload, sources)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE payload = VALUES(payload), sources = VALUES(sources)`
    const [result] = await this._execute(sql, [queryKey, payload, sources], 'upsertJournalCache')
    return result.affectedRows
  }

  // ===== 30 公司搜索缓存（user_id + 公司名哈希 唯一） =====

  async getCompanyCache(userId, queryKey) {
    const sql = 'SELECT payload, sources, empty_hit, updated_at FROM `tool_company_cache` WHERE user_id = ? AND query_key = ? LIMIT 1'
    const [rows] = await this._execute(sql, [Number(userId), queryKey], 'getCompanyCache')
    return rows[0] || null
  }

  async upsertCompanyCache(userId, queryKey, payload, sources, emptyHit) {
    const sql = `INSERT INTO \`tool_company_cache\` (user_id, query_key, payload, sources, empty_hit)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE payload = VALUES(payload), sources = VALUES(sources), empty_hit = VALUES(empty_hit)`
    const [result] = await this._execute(sql, [Number(userId), queryKey, payload, sources, emptyHit ? 1 : 0], 'upsertCompanyCache')
    return result.affectedRows
  }

  // ===== 28 学术搜索历史（按用户） =====

  async addSearchHistory(userId, keyword, filters, resultCount) {
    const sql = 'INSERT INTO `tool_search_history` (user_id, keyword, filters, result_count) VALUES (?, ?, ?, ?)'
    const [result] = await this._execute(sql, [Number(userId), keyword, filters || null, Number(resultCount) || 0], 'addSearchHistory')
    return result.insertId
  }

  async listSearchHistory(userId, limit = 20) {
    const sql = 'SELECT id, keyword, filters, result_count, created_at FROM `tool_search_history` WHERE user_id = ? ORDER BY id DESC LIMIT ?'
    const [rows] = await this._execute(sql, [Number(userId), Number(limit)], 'listSearchHistory')
    return rows
  }

  // ===== 29 翻译历史（user_id + src_hash + target_lang + engine 唯一） =====

  async getTranslationHistory(userId, srcHash, targetLang, engine) {
    const sql = 'SELECT source_text, translated_text, engine FROM `tool_translation_history` WHERE user_id = ? AND src_hash = ? AND target_lang = ? AND engine = ? LIMIT 1'
    const [rows] = await this._execute(sql, [Number(userId), srcHash, targetLang, engine], 'getTranslationHistory')
    return rows[0] || null
  }

  async addTranslationHistory(userId, srcHash, srcLang, targetLang, engine, sourceText, translatedText) {
    const sql = `INSERT INTO \`tool_translation_history\` (user_id, src_hash, src_lang, target_lang, engine, source_text, translated_text)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE translated_text = VALUES(translated_text), src_lang = VALUES(src_lang)`
    const [result] = await this._execute(sql, [Number(userId), srcHash, srcLang, targetLang, engine, sourceText, translatedText], 'addTranslationHistory')
    return result.affectedRows
  }

  async listTranslationHistory(userId, limit = 30) {
    const sql = 'SELECT id, src_lang, target_lang, engine, source_text, translated_text, created_at FROM `tool_translation_history` WHERE user_id = ? ORDER BY id DESC LIMIT ?'
    const [rows] = await this._execute(sql, [Number(userId), Number(limit)], 'listTranslationHistory')
    return rows
  }

  // ===== 31 用户设置（user_id 唯一） =====

  async getSettings(userId) {
    const sql = 'SELECT default_citation, translate_engines, api_keys, favorites, recent_used, updated_at FROM `tool_user_settings` WHERE user_id = ? LIMIT 1'
    const [rows] = await this._execute(sql, [Number(userId)], 'getSettings')
    return rows[0] || null
  }

  async upsertSettings(userId, data = {}) {
    const sql = `INSERT INTO \`tool_user_settings\` (user_id, default_citation, translate_engines, api_keys, favorites, recent_used)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                   default_citation = VALUES(default_citation),
                   translate_engines = VALUES(translate_engines),
                   api_keys = VALUES(api_keys),
                   favorites = VALUES(favorites),
                   recent_used = VALUES(recent_used)`
    const [result] = await this._execute(sql, [
      Number(userId),
      data.defaultCitation || 'gb7714',
      data.translateEngines || null,
      data.apiKeys || null,
      data.favorites || null,
      data.recentUsed || null
    ], 'upsertSettings')
    return result.affectedRows
  }

  // ===== 33 公司收藏（user_id + company_key 唯一） =====

  async listCompanyFavorites(userId) {
    const sql = 'SELECT id, company_key, company_snapshot, note, created_at FROM `tool_company_favorites` WHERE user_id = ? ORDER BY id DESC'
    const [rows] = await this._execute(sql, [Number(userId)], 'listCompanyFavorites')
    return rows
  }

  async getCompanyFavorite(userId, companyKey) {
    const sql = 'SELECT id, note, company_snapshot FROM `tool_company_favorites` WHERE user_id = ? AND company_key = ? LIMIT 1'
    const [rows] = await this._execute(sql, [Number(userId), companyKey], 'getCompanyFavorite')
    return rows[0] || null
  }

  async addCompanyFavorite(userId, companyKey, snapshot, note) {
    const sql = 'INSERT INTO `tool_company_favorites` (user_id, company_key, company_snapshot, note) VALUES (?, ?, ?, ?)'
    const [result] = await this._execute(sql, [Number(userId), companyKey, snapshot || null, note || null], 'addCompanyFavorite')
    return result.insertId
  }

  async updateCompanyFavorite(userId, companyKey, data = {}) {
    const sql = 'UPDATE `tool_company_favorites` SET company_snapshot = ?, note = ? WHERE user_id = ? AND company_key = ?'
    const [result] = await this._execute(sql, [data.snapshot || null, data.note || null, Number(userId), companyKey], 'updateCompanyFavorite')
    return result.affectedRows
  }

  async removeCompanyFavorite(userId, companyKey) {
    const sql = 'DELETE FROM `tool_company_favorites` WHERE user_id = ? AND company_key = ?'
    const [result] = await this._execute(sql, [Number(userId), companyKey], 'removeCompanyFavorite')
    return result.affectedRows
  }

  // ===== 34 公司搜索历史（按用户） =====

  async addCompanySearchHistory(userId, keyword, city, resultCount) {
    const sql = 'INSERT INTO `tool_company_search_history` (user_id, keyword, city, result_count) VALUES (?, ?, ?, ?)'
    const [result] = await this._execute(sql, [Number(userId), keyword, city || null, Number(resultCount) || 0], 'addCompanySearchHistory')
    return result.insertId
  }

  async listCompanySearchHistory(userId, limit = 20) {
    const sql = 'SELECT id, keyword, city, result_count, created_at FROM `tool_company_search_history` WHERE user_id = ? ORDER BY id DESC LIMIT ?'
    const [rows] = await this._execute(sql, [Number(userId), Number(limit)], 'listCompanySearchHistory')
    return rows
  }

  // ===== 32 数据源调用日志（按用户，物理删除清理） =====

  async addSourceLog(userId, tool, querySnapshot, sourceName, status, costMs, resultCount, errorMsg) {
    const sql = 'INSERT INTO `tool_source_logs` (user_id, tool, query_snapshot, source_name, status, cost_ms, result_count, error_msg) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    const [result] = await this._execute(sql, [Number(userId), tool, querySnapshot || null, sourceName, status, Number(costMs) || 0, Number(resultCount) || 0, errorMsg || null], 'addSourceLog')
    return result.insertId
  }

  async listSourceLogs(userId, { tool = '', status = '', page = 1, pageSize = 10 } = {}) {
    const cond = ['user_id = ?']
    const params = [Number(userId)]
    if (tool) { cond.push('tool = ?'); params.push(tool) }
    if (status) { cond.push('status = ?'); params.push(status) }
    const where = cond.join(' AND ')
    const countSql = `SELECT COUNT(*) AS total FROM \`tool_source_logs\` WHERE ${where}`
    const [countRows] = await this._execute(countSql, params, 'listSourceLogs.count')
    const total = Number(countRows[0] && countRows[0].total) || 0
    const { limit, offset } = normalizePage(page, pageSize)
    const listSql = `SELECT id, tool, query_snapshot, source_name, status, cost_ms, result_count, error_msg, created_at
                     FROM \`tool_source_logs\` WHERE ${where} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`
    const [rows] = await this._execute(listSql, params, 'listSourceLogs')
    return { list: rows, ...buildPageMeta(total, page, pageSize) }
  }

  async clearSourceLogs(userId, beforeDays) {
    const days = Number(beforeDays) || 30
    const sql = 'DELETE FROM `tool_source_logs` WHERE user_id = ? AND created_at < (NOW() - INTERVAL ? DAY)'
    const [result] = await this._execute(sql, [Number(userId), days], 'clearSourceLogs')
    return result.affectedRows
  }

  // ===== 缓存清理（设置页缓存管理用，物理删除） =====

  async clearCache(table, userId) {
    let sql
    let params = []
    if (table === 'journal') {
      sql = 'DELETE FROM `tool_journal_cache`'
    } else if (userId) {
      sql = `DELETE FROM \`tool_${table}_cache\` WHERE user_id = ?`
      params = [Number(userId)]
    } else {
      sql = `DELETE FROM \`tool_${table}_cache\``
    }
    const [result] = await this._execute(sql, params, 'clearCache')
    return result.affectedRows
  }

  async countCacheRows(table) {
    const sql = `SELECT COUNT(*) AS total FROM \`tool_${table}_cache\``
    const [rows] = await this._execute(sql, [], 'countCacheRows')
    return Number(rows[0] && rows[0].total) || 0
  }
}

module.exports = new ToolRepository()
