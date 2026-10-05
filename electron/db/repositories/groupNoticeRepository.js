/**
 * 课题组公告仓库（Repository Layer）—— 对应 `group_notice` 表
 *
 * 说明：公告属于课题组（group_id），本表为硬删除（无 is_deleted 条件）。
 * 列表 / 详情统一 LEFT JOIN `groups` 取组名、LEFT JOIN `users` 取发布人姓名，
 * 发布人被删除时姓名回退为「用户 #id」。
 */
const BaseRepository = require('./BaseRepository')
const { buildWhereClause, buildUpdateSet, buildOrderBy, normalizePage, buildPageMeta } = require('./queryHelpers')

// 公告表安全返回列（不含任何敏感字段）
const SAFE_COLUMNS = [
  'id', 'group_id', 'publisher_id', 'publisher_role', 'title', 'content',
  'is_top', 'status', 'publish_time', 'create_time', 'update_time'
]

// 公告列表排序白名单：语义字段名 → 可信 SQL 片段（联表带 n. / g. / pu. 前缀）
const NOTICE_SORT_MAP = {
  id: 'n.id',
  groupName: 'g.name',
  title: 'n.title',
  publisherName: 'pu.real_name',
  status: 'n.status',
  publishTime: 'n.publish_time'
}

// 列名拼接：JOIN groups/users 后须带 n. 前缀，避免 id/status 等列名歧义
function cols(columns) {
  return columns.map((c) => `n.\`${c}\``).join(', ')
}

// 列表/详情共用查询主体：公告 + 所属组名 + 发布人姓名
const BASE_SELECT = `SELECT ${cols(SAFE_COLUMNS)}, g.name AS group_name, pu.real_name AS publisher_real_name, pu.username AS publisher_username
  FROM \`group_notice\` n
  LEFT JOIN \`groups\` g ON g.id = n.group_id
  LEFT JOIN \`users\` pu ON pu.id = n.publisher_id`

class GroupNoticeRepository extends BaseRepository {
  constructor() {
    super('group_notice')
  }

  /**
   * 按主键查询公告（含组名与发布人）
   * @param {number} id
   * @returns {Object|null}
   */
  async findById(id) {
    const sql = `${BASE_SELECT} WHERE n.id = ?`
    const [rows] = await this._execute(sql, [Number(id)], 'findById')
    return rows[0] || null
  }

  /**
   * 公告分页列表：支持课题组 / 状态 / 标题关键字过滤；
   * 排序固定为置顶优先、发布时间倒序（后发的在前）。
   * WHERE 手写表前缀（n.）规避两处问题：buildWhereClause 会对字段名整体包反引号，
   * 带点的 `n.group_id` 会被当成字面列名；无前缀的 status 在 JOIN users 后存在歧义。
   * 列名均为代码内可信常量，值全部走 ? 占位符，无注入风险。
   * @param {{ groupId?: number, status?: number, keyword?: string, page?: number }} filters
   */
  async pagedList(filters = {}) {
    const where = []
    const values = []
    if (filters.groupId) {
      where.push('n.group_id = ?')
      values.push(Number(filters.groupId))
    }
    if (filters.status !== undefined && filters.status !== null && filters.status !== '') {
      where.push('n.status = ?')
      values.push(Number(filters.status))
    }
    if (filters.keyword && String(filters.keyword).trim()) {
      where.push('n.title LIKE ?')
      values.push(`%${String(filters.keyword).trim()}%`)
    }
    const clause = where.length ? 'WHERE ' + where.join(' AND ') : ''

    const countSql = `SELECT COUNT(*) AS total FROM \`group_notice\` n ${clause}`
    const [countRows] = await this._execute(countSql, values, 'pagedList.count')
    const total = Number(countRows[0] && countRows[0].total) || 0

    const { page, pageSize, limit, offset } = normalizePage(filters.page)
    // LIMIT/OFFSET 直接内联整数值（normalizePage 已做 parseInt 归一化），规避
    // prepared statement 对 LIMIT ? 占位符的支持问题（同 userRepository.pagedList）。
    const sql =
      `${BASE_SELECT} ${clause} ${buildOrderBy(filters, NOTICE_SORT_MAP, 'n.is_top DESC, n.publish_time DESC, n.id DESC')} LIMIT ${limit} OFFSET ${offset}`
    const [rows] = await this._execute(sql, values, 'pagedList')
    return { list: rows, ...buildPageMeta(total, page, pageSize) }
  }

  /**
   * 增量更新公告
   * @param {number} id
   * @param {Object} data 字段->值 映射
   */
  async updateById(id, data) {
    const { clause, values } = buildUpdateSet(data)
    if (!clause) return 0
    const sql = `UPDATE \`group_notice\` SET ${clause} WHERE id = ?`
    const [result] = await this._execute(sql, [...values, id], 'updateById')
    return result.affectedRows
  }

  /**
   * 物理删除公告（需求约定：公告删除为硬删除）
   * @param {number} id
   */
  async deleteById(id) {
    const sql = 'DELETE FROM `group_notice` WHERE id = ?'
    const [result] = await this._execute(sql, [Number(id)], 'deleteById')
    return result.affectedRows
  }

  /**
   * 按课题组物理删除全部公告（课题组删除时级联调用）
   * @param {number} groupId
   */
  async deleteByGroupId(groupId) {
    const sql = 'DELETE FROM `group_notice` WHERE group_id = ?'
    const [result] = await this._execute(sql, [Number(groupId)], 'deleteByGroupId')
    return result.affectedRows
  }

  /**
   * 用户在某课题组的未读公告数（未读口径：已发布 + 该用户没有已读记录）。
   * 下架（status=2）与已删除公告天然不计入；已读记录按用户级唯一键过滤。
   * @param {number} groupId 课题组 ID
   * @param {number} userId 用户 ID
   * @returns {Promise<number>} 未读公告条数
   */
  async countUnreadByGroup(groupId, userId) {
    const sql =
      'SELECT COUNT(*) AS total FROM `group_notice` n ' +
      'WHERE n.group_id = ? AND n.status = 1 ' +
      'AND n.id NOT IN (SELECT notice_id FROM `group_notice_read` WHERE user_id = ?)'
    const [rows] = await this._execute(sql, [Number(groupId), Number(userId)], 'countUnreadByGroup')
    return Number(rows[0] && rows[0].total) || 0
  }
}

// 导出单例
module.exports = new GroupNoticeRepository()
