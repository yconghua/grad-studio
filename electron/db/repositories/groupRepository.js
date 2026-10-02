/**
 * 课题组仓库（Repository Layer）—— 对应 `groups` 表
 *
 * 说明：`groups` 为 MySQL 保留字，所有 SQL 中表名统一反引号包裹。
 * 本表为物理删除，findById / update / delete 自行实现（不带 is_deleted 条件）。
 */
const BaseRepository = require('./BaseRepository')
const { buildWhereClause, buildUpdateSet, normalizePage, buildPageMeta } = require('./queryHelpers')

// 课题组表安全返回列
const SAFE_COLUMNS = ['id', 'name', 'code', 'description', 'admin_user_id', 'status', 'created_at', 'updated_at']

function cols(columns) {
  return columns.map((c) => `\`${c}\``).join(', ')
}

class GroupRepository extends BaseRepository {
  constructor() {
    super('groups')
  }

  /**
   * 按主键查询
   * @param {number} id
   * @returns {Object|null}
   */
  async findById(id) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`groups\` WHERE id = ?`
    const [rows] = await this._execute(sql, [id], 'findById')
    return rows[0] || null
  }

  /**
   * 按唯一标识号查询（UUID）
   * @param {string} code
   * @returns {Object|null}
   */
  async findByCode(code) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`groups\` WHERE code = ?`
    const [rows] = await this._execute(sql, [code], 'findByCode')
    return rows[0] || null
  }

  /**
   * 按课题组管理员用户ID查询（唯一绑定校验用）
   * @param {number} adminUserId
   * @returns {Object|null}
   */
  async findByAdminUserId(adminUserId) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`groups\` WHERE admin_user_id = ?`
    const [rows] = await this._execute(sql, [Number(adminUserId)], 'findByAdminUserId')
    return rows[0] || null
  }

  /**
   * 按名称精确匹配启用中的课题组（批量导入按名称解析用）
   * name 无唯一约束，可能返回多行；调用方须自行处理重名
   * @param {string} name
   * @returns {Array<Object>}
   */
  async findByName(name) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`groups\` WHERE name = ? AND status = 1`
    const [rows] = await this._execute(sql, [name], 'findByName')
    return rows || []
  }

  /**
   * 启用中的课题组全量列表（超管任务总览按课题组分类用）
   * @returns {Array<Object>}
   */
  async listAllEnabled() {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`groups\` WHERE status = 1 ORDER BY id ASC`
    const [rows] = await this._execute(sql, [], 'listAllEnabled')
    return rows || []
  }

  /**
   * 课题组分页列表：支持关键字（名称/标识号模糊）过滤
   * @param {{ keyword?: string, page?: number }} filters
   */
  async pagedList(filters = {}) {
    const conditions = []
    if (filters.keyword && String(filters.keyword).trim()) {
      const kw = `%${String(filters.keyword).trim()}%`
      conditions.push({ field: 'name', op: 'LIKE', value: kw })
    }
    const { clause, values } = buildWhereClause(conditions)

    const countSql = `SELECT COUNT(*) AS total FROM \`groups\`${clause}`
    const [countRows] = await this._execute(countSql, values, 'pagedList.count')
    const total = Number(countRows[0] && countRows[0].total) || 0

    const { page, pageSize, limit, offset } = normalizePage(filters.page)
    // LIMIT/OFFSET 直接内联整数值（normalizePage 已做 parseInt 归一化），规避
    // prepared statement 对 LIMIT ? 占位符的支持问题（部分 MySQL 版本报
    // 「Incorrect arguments to mysqld_stmt_execute」）。
    const sql =
      `SELECT ${cols(SAFE_COLUMNS)} FROM \`groups\`${clause} ORDER BY id ASC LIMIT ${limit} OFFSET ${offset}`
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
    const sql = `UPDATE \`groups\` SET ${clause} WHERE id = ?`
    const [result] = await this._execute(sql, [...values, id], 'updateById')
    return result.affectedRows
  }

  /**
   * 物理删除课题组
   * @param {number} id
   */
  async deleteById(id) {
    const sql = 'DELETE FROM `groups` WHERE id = ?'
    const [result] = await this._execute(sql, [id], 'deleteById')
    return result.affectedRows
  }
}

// 导出单例
module.exports = new GroupRepository()
