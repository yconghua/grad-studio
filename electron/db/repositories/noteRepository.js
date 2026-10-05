/**
 * 笔记仓库（Repository Layer）—— 对应 `note` 表
 *
 * 继承 BaseRepository 获得通用 create / _execute；本表所有权语义特殊：
 * 所有读、写、删、恢复都强制带 user_id 条件（笔记私有，user_id 由服务层注入）。
 * 软删除约定与全项目一致（is_deleted 0/1 + deleted_at），回收站即 is_deleted=1。
 */
const BaseRepository = require('./BaseRepository')
const { buildUpdateSet, normalizePage, buildPageMeta } = require('./queryHelpers')

// 列表安全返回列（不含 content 大字段，列表页不需要；详情单独取全列）
const LIST_COLUMNS = ['id', 'title', 'category', 'version', 'created_at', 'change_ts', 'deleted_at']

// 列名拼接（反引号包裹，防与关键字冲突）
function cols(columns) {
  return columns.map((c) => `\`${c}\``).join(', ')
}

class NoteRepository extends BaseRepository {
  constructor() {
    super('note')
  }

  /**
   * 按主键查自己的正常笔记（id + user_id 双条件，所有权在 SQL 层兜底）
   * @param {number} id
   * @param {number} userId
   * @returns {Object|null}
   */
  async findOwnById(id, userId) {
    const sql =
      `SELECT * FROM \`note\` WHERE id = ? AND user_id = ? AND is_deleted = 0`
    const [rows] = await this._execute(sql, [Number(id), Number(userId)], 'findOwnById')
    return rows[0] || null
  }

  /**
   * 按主键查自己的回收站笔记（供恢复 / 彻底删除使用）
   * @param {number} id
   * @param {number} userId
   * @returns {Object|null}
   */
  async findOwnInTrashById(id, userId) {
    const sql =
      `SELECT * FROM \`note\` WHERE id = ? AND user_id = ? AND is_deleted = 1`
    const [rows] = await this._execute(sql, [Number(id), Number(userId)], 'findOwnInTrashById')
    return rows[0] || null
  }

  /**
   * 笔记分页列表（本人可见范围）：固定 user_id + is_deleted，类别可选过滤，按更新时间倒序
   * @param {{ userId: number, isDeleted: number, category?: string, page?: number }} filters
   * @returns {{ list: Object[], total: number, page: number, pageSize: number, totalPages: number }}
   */
  async pagedList(filters = {}) {
    const where = 'WHERE user_id = ? AND is_deleted = ?'
    const values = [Number(filters.userId), Number(filters.isDeleted)]
    if (filters.category) {
      values.push(filters.category)
    }
    const categoryClause = filters.category ? ' AND category = ?' : ''

    const countSql = `SELECT COUNT(*) AS total FROM \`note\` ${where}${categoryClause}`
    const [countRows] = await this._execute(countSql, values, 'pagedList.count')
    const total = Number(countRows[0] && countRows[0].total) || 0

    const { page, pageSize, limit, offset } = normalizePage(filters.page)
    // LIMIT/OFFSET 直接内联整数值（normalizePage 已做 parseInt 归一化），规避
    // prepared statement 对 LIMIT ? 占位符的支持问题（与 userRepository.pagedList 一致）。
    // summary：截取 content 前 120 字供列表摘要，避免大字段（LONGTEXT）整列回传。
    const sql =
      `SELECT ${cols(LIST_COLUMNS)}, SUBSTRING(\`content\`, 1, 120) AS summary FROM \`note\` ${where}${categoryClause}
       ORDER BY change_ts DESC LIMIT ${limit} OFFSET ${offset}`
    const [rows] = await this._execute(sql, values, 'pagedList')
    return { list: rows, ...buildPageMeta(total, page, pageSize) }
  }

  /**
   * 新建笔记：自定义 INSERT（不走 BaseRepository.create 的空串→NULL 归一，
   * note.content 为 NOT NULL，空内容必须写 '' 而不是 NULL）
   * @param {number} userId
   * @param {string} title
   * @param {string} category
   * @param {string} content
   * @returns {number} 新笔记 id
   */
  async createNote(userId, title, category, content) {
    const sql =
      'INSERT INTO `note` (`user_id`, `title`, `category`, `content`) VALUES (?, ?, ?, ?)'
    const [result] = await this._execute(
      sql,
      [Number(userId), title, category, content],
      'createNote'
    )
    return result.insertId
  }

  /**
   * 乐观锁更新：WHERE 带 user_id + version + 未删除条件，冲突返回 0
   * 由服务层转成「笔记已被其他设备更新，请刷新」
   * @param {number} id
   * @param {number} userId
   * @param {Object} data 更新字段（title/category/content）
   * @param {number} version 期望版本号
   * @returns {number} 受影响行数
   */
  async updateWithVersion(id, userId, data, version) {
    const { clause, values } = buildUpdateSet(data)
    if (!clause) return 0
    const sql =
      `UPDATE \`note\` SET ${clause}, version = version + 1
       WHERE id = ? AND user_id = ? AND version = ? AND is_deleted = 0`
    const [result] = await this._execute(sql, [...values, Number(id), Number(userId), Number(version)], 'updateWithVersion')
    return result.affectedRows
  }

  /**
   * 软删除（进回收站）：is_deleted=1 且写入删除时间
   * @param {number} id
   * @param {number} userId
   * @returns {number}
   */
  async softDelete(id, userId) {
    const sql =
      'UPDATE `note` SET is_deleted = 1, deleted_at = NOW() WHERE id = ? AND user_id = ? AND is_deleted = 0'
    const [result] = await this._execute(sql, [Number(id), Number(userId)], 'softDelete')
    return result.affectedRows
  }

  /**
   * 恢复：从回收站恢复为正常，删除时间清零
   * @param {number} id
   * @param {number} userId
   * @returns {number}
   */
  async restore(id, userId) {
    const sql =
      'UPDATE `note` SET is_deleted = 0, deleted_at = NULL WHERE id = ? AND user_id = ? AND is_deleted = 1'
    const [result] = await this._execute(sql, [Number(id), Number(userId)], 'restore')
    return result.affectedRows
  }

  /**
   * 彻底删除：物理删除（仅回收站中的笔记可彻底删除）
   * @param {number} id
   * @param {number} userId
   * @returns {number}
   */
  async purge(id, userId) {
    const sql = 'DELETE FROM `note` WHERE id = ? AND user_id = ? AND is_deleted = 1'
    const [result] = await this._execute(sql, [Number(id), Number(userId)], 'purge')
    return result.affectedRows
  }

  /**
   * 物理删除某用户全部笔记（删除用户事务内调用，含回收站；用户已删除，软删无意义）
   * @param {number} userId
   */
  async deleteByUser(userId) {
    const sql = 'DELETE FROM `note` WHERE user_id = ?'
    const [result] = await this._execute(sql, [Number(userId)], 'deleteByUser')
    return result.affectedRows
  }
}

// 导出单例
module.exports = new NoteRepository()
