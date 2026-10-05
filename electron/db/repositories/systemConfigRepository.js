/**
 * 系统参数仓库（Repository Layer）—— 对应 `system_configs` 表
 *
 * 全局键值配置（超级管理员「系统配置」页维护），config_type 预留类型字段。
 * 本表为物理删除，findById / update / remove 自行实现（不带 is_deleted 条件）。
 */
const BaseRepository = require('./BaseRepository')
const { buildUpdateSet, buildOrderBy, normalizePage, buildPageMeta } = require('./queryHelpers')

// 系统参数排序白名单：语义字段名 → 可信 SQL 片段
const CONFIG_SORT_MAP = {
  id: 'id',
  configKey: 'config_key',
  configValue: 'config_value',
  configType: 'config_type',
  description: 'description',
  createdAt: 'created_at'
}

// 系统参数表安全返回列
const SAFE_COLUMNS = ['id', 'config_key', 'config_value', 'config_type', 'description', 'created_at', 'change_ts']

function cols(columns) {
  return columns.map((c) => `\`${c}\``).join(', ')
}

class SystemConfigRepository extends BaseRepository {
  constructor() {
    super('system_configs')
  }

  /**
   * 按主键查询
   * @param {number} id
   * @returns {Object|null}
   */
  async findById(id) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`system_configs\` WHERE id = ?`
    const [rows] = await this._execute(sql, [id], 'findById')
    return rows[0] || null
  }

  /**
   * 按参数键查询（系统简介 / 系统名称等公共读取）
   * @param {string} configKey
   * @returns {Object|null}
   */
  async findByKey(configKey) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`system_configs\` WHERE config_key = ?`
    const [rows] = await this._execute(sql, [configKey], 'findByKey')
    return rows[0] || null
  }

  /**
   * 系统参数分页列表：支持关键字（参数键/描述模糊）过滤
   * @param {{ keyword?: string, page?: number }} filters
   */
  async pagedList(filters = {}) {
    let where = ''
    let values = []
    if (filters.keyword && String(filters.keyword).trim()) {
      const kw = `%${String(filters.keyword).trim()}%`
      where = 'WHERE config_key LIKE ? OR description LIKE ?'
      values = [kw, kw]
    }

    const countSql = `SELECT COUNT(*) AS total FROM \`system_configs\` ${where}`
    const [countRows] = await this._execute(countSql, values, 'pagedList.count')
    const total = Number(countRows[0] && countRows[0].total) || 0

    const { page, pageSize, limit, offset } = normalizePage(filters.page)
    // LIMIT/OFFSET 直接内联整数值（normalizePage 已做 parseInt 归一化），规避
    // prepared statement 对 LIMIT ? 占位符的支持问题（部分 MySQL 版本报
    // 「Incorrect arguments to mysqld_stmt_execute」）。
    const sql =
      `SELECT ${cols(SAFE_COLUMNS)} FROM \`system_configs\` ${where} ${buildOrderBy(filters, CONFIG_SORT_MAP, 'id ASC')} LIMIT ${limit} OFFSET ${offset}`
    const [rows] = await this._execute(sql, values, 'pagedList')
    return { list: rows, ...buildPageMeta(total, page, pageSize) }
  }

  /**
   * 增量更新（不含 is_deleted 条件）
   * @param {number} id
   * @param {Object} data 字段->值 映射
   */
  async updateById(id, data) {
    const { clause, values } = buildUpdateSet(data)
    if (!clause) return 0
    const sql = `UPDATE \`system_configs\` SET ${clause} WHERE id = ?`
    const [result] = await this._execute(sql, [...values, id], 'updateById')
    return result.affectedRows
  }

  /**
   * 物理删除系统参数
   * @param {number} id
   */
  async deleteById(id) {
    const sql = 'DELETE FROM `system_configs` WHERE id = ?'
    const [result] = await this._execute(sql, [id], 'deleteById')
    return result.affectedRows
  }
}

// 导出单例
module.exports = new SystemConfigRepository()
