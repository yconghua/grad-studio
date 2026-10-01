/**
 * 组会主表仓库（Repository Layer）—— 对应 `group_meeting` 表
 *
 * 说明：会议归属课题组（group_id），本表为硬删除（无 is_deleted 列，全部手写 SQL）。
 * 列表 / 详情统一 LEFT JOIN `groups` 取组名、LEFT JOIN `users` 取发起人姓名，
 * 并聚合参与人数量；列表不返回 content 全文，详情单独取。
 * 发起人被删除时姓名回退为「用户 #id」。
 */
const { buildUpdateSet, normalizePage, buildPageMeta } = require('./queryHelpers')

// 列表安全返回列（不含 content 全文）
const LIST_COLUMNS = [
  'id', 'group_id', 'title', 'meeting_time', 'location', 'host_id',
  'agenda', 'status', 'notice_id', 'create_time', 'update_time'
]

// 详情列（含 content 全文，供详情弹窗 / 编辑复用）
const DETAIL_COLUMNS = [...LIST_COLUMNS, 'content']

// 参与人数量聚合子查询（LEFT JOIN 单次聚合，避免与 users 双 JOIN 产生笛卡尔积）
const PARTICIPANT_SUB = '(SELECT meeting_id, COUNT(*) AS cnt FROM `group_meeting_participant` GROUP BY meeting_id)'

// 列表/详情共用查询主体：会议 + 所属组名 + 发起人姓名 + 参与人数量
function baseSelect(columns) {
  return `SELECT ${columns.map((c) => `m.\`${c}\``).join(', ')}, g.name AS group_name,
    h.real_name AS host_real_name, h.username AS host_username,
    COALESCE(p.cnt, 0) AS participant_count
    FROM \`group_meeting\` m
    LEFT JOIN \`groups\` g ON g.id = m.group_id
    LEFT JOIN \`users\` h ON h.id = m.host_id
    LEFT JOIN ${PARTICIPANT_SUB} p ON p.meeting_id = m.id`
}

// 组装 WHERE（带 m. 前缀规避 JOIN 后的列名歧义；值全部走 ? 占位符）
function buildWhere(filters = {}) {
  const where = []
  const values = []
  if (filters.groupId !== undefined && filters.groupId !== null && filters.groupId !== '') {
    where.push('m.group_id = ?')
    values.push(Number(filters.groupId))
  }
  if (filters.status !== undefined && filters.status !== null && filters.status !== '') {
    if (Array.isArray(filters.status)) {
      const marks = filters.status.map(() => '?').join(', ')
      where.push(`m.status IN (${marks})`)
      values.push(...filters.status.map(Number))
    } else {
      where.push('m.status = ?')
      values.push(Number(filters.status))
    }
  }
  if (filters.hostId !== undefined && filters.hostId !== null && filters.hostId !== '') {
    where.push('m.host_id = ?')
    values.push(Number(filters.hostId))
  }
  if (filters.participantUserId !== undefined && filters.participantUserId !== null && filters.participantUserId !== '') {
    where.push('m.id IN (SELECT meeting_id FROM `group_meeting_participant` WHERE user_id = ?)')
    values.push(Number(filters.participantUserId))
  }
  if (filters.keyword && String(filters.keyword).trim()) {
    where.push('m.title LIKE ?')
    values.push(`%${String(filters.keyword).trim()}%`)
  }
  if (filters.startTime) {
    where.push('m.meeting_time >= ?')
    values.push(filters.startTime)
  }
  if (filters.endTime) {
    where.push('m.meeting_time <= ?')
    values.push(filters.endTime)
  }
  return { clause: where.length ? 'WHERE ' + where.join(' AND ') : '', values }
}

class GroupMeetingRepository {
  constructor() {
    this.tableName = 'group_meeting'
  }

  /** 统一 SQL 执行出口（复用 BaseRepository 的连接获取与日志） */
  async _execute(sql, params, action) {
    const BaseRepository = require('./BaseRepository')
    return new BaseRepository(this.tableName)._execute(sql, params, action)
  }

  /** 按主键查询会议详情（含组名、发起人、参与人数量、content 全文） */
  async findById(id) {
    const sql = `${baseSelect(DETAIL_COLUMNS)} WHERE m.id = ?`
    const [rows] = await this._execute(sql, [Number(id)], 'findById')
    return rows[0] || null
  }

  /**
   * 会议分页列表：支持课题组 / 状态(单值或数组) / 发起人 / 参与人 /
   * 标题关键字 / 会议时间范围过滤；排序固定为会议时间倒序、id 倒序。
   * @param {Object} filters 同 buildWhere 支持的所有字段 + page
   */
  async pagedList(filters = {}) {
    const { clause, values } = buildWhere(filters)
    const countSql = `SELECT COUNT(*) AS total FROM \`group_meeting\` m ${clause}`
    const [countRows] = await this._execute(countSql, values, 'pagedList.count')
    const total = Number(countRows[0] && countRows[0].total) || 0

    const { page, pageSize, limit, offset } = normalizePage(filters.page)
    const sql =
      `${baseSelect(LIST_COLUMNS)} ${clause} ORDER BY m.meeting_time DESC, m.id DESC LIMIT ${limit} OFFSET ${offset}`
    const [rows] = await this._execute(sql, values, 'pagedList')
    return { list: rows, ...buildPageMeta(total, page, pageSize) }
  }

  /**
   * 指定用户参与的会议分页（导师/学生可见范围：当前有效组 + 自己参与）
   * @param {number} userId
   * @param {{ groupId?: number, status?: number|number[], page?: number }} filters
   */
  async listByParticipant(userId, filters = {}) {
    const { groupId, status, page } = filters
    return this.pagedList({
      groupId,
      status,
      page,
      participantUserId: userId
    })
  }

  /** 当前用户创建的草稿分页（我的草稿视图） */
  async listMyDrafts(hostId, filters = {}) {
    return this.pagedList({ hostId, status: 1, page: filters.page })
  }

  /** 某课题组全部草稿分页（本组草稿视图，只读） */
  async listGroupDrafts(groupId, filters = {}) {
    return this.pagedList({ groupId, status: 1, page: filters.page })
  }

  /** 新增会议，返回自增主键 id */
  async create(data) {
    const cols = Object.keys(data)
    const vals = Object.values(data)
    const placeholders = cols.map(() => '?').join(', ')
    const sql =
      `INSERT INTO \`group_meeting\` (${cols.map((c) => `\`${c}\``).join(', ')}) VALUES (${placeholders})`
    const [result] = await this._execute(sql, vals, 'create')
    return result.insertId
  }

  /** 按主键增量更新（只更新 data 中的字段） */
  async updateById(id, data) {
    const { clause, values } = buildUpdateSet(data)
    if (!clause) return 0
    const sql = `UPDATE \`group_meeting\` SET ${clause} WHERE id = ?`
    const [result] = await this._execute(sql, [...values, Number(id)], 'updateById')
    return result.affectedRows
  }

  /** 更新会议状态（发布 / 归档切换用） */
  async updateStatus(id, status) {
    const sql = 'UPDATE `group_meeting` SET status = ? WHERE id = ?'
    const [result] = await this._execute(sql, [Number(status), Number(id)], 'updateStatus')
    return result.affectedRows
  }

  /**
   * 回写公告 id（发布为公告用）：条件更新防并发重复，
   * 影响 0 行表示 notice_id 已存在（或会议不存在），由调用方拒绝。
   * @returns {number} affectedRows（0 = 已发布过公告）
   */
  async updateNoticeId(id, noticeId) {
    const sql = 'UPDATE `group_meeting` SET notice_id = ? WHERE id = ? AND notice_id IS NULL'
    const [result] = await this._execute(sql, [noticeId === undefined || noticeId === null ? null : Number(noticeId), Number(id)], 'updateNoticeId')
    return result.affectedRows
  }

  /** 物理删除会议 */
  async deleteById(id) {
    const sql = 'DELETE FROM `group_meeting` WHERE id = ?'
    const [result] = await this._execute(sql, [Number(id)], 'deleteById')
    return result.affectedRows
  }

  /** 按课题组物理删除全部会议（课题组删除时级联调用） */
  async deleteByGroupId(groupId) {
    const sql = 'DELETE FROM `group_meeting` WHERE group_id = ?'
    const [result] = await this._execute(sql, [Number(groupId)], 'deleteByGroupId')
    return result.affectedRows
  }

  /** 某课题组会议总数（任意状态） */
  async countByGroup(groupId) {
    const sql = 'SELECT COUNT(*) AS total FROM `group_meeting` WHERE group_id = ?'
    const [rows] = await this._execute(sql, [Number(groupId)], 'countByGroup')
    return Number(rows[0] && rows[0].total) || 0
  }

  /** 最近一次已发布会议（工作台卡片 / 统计用；groupId 为空表示全平台） */
  async latestByGroup(groupId) {
    const where = []
    const values = []
    if (groupId !== undefined && groupId !== null && groupId !== '') {
      where.push('m.group_id = ?')
      values.push(Number(groupId))
    }
    where.push('m.status = 2')
    const clause = 'WHERE ' + where.join(' AND ')
    const sql =
      `${baseSelect(LIST_COLUMNS)} ${clause} ORDER BY m.meeting_time DESC, m.id DESC LIMIT 1`
    const [rows] = await this._execute(sql, values, 'latestByGroup')
    return rows[0] || null
  }

  /** 指定用户参与的最近一次已发布会议（导师/学生工作台卡片用，限定当前组） */
  async latestParticipatedByGroup(userId, groupId) {
    const sql =
      `${baseSelect(LIST_COLUMNS)} WHERE m.group_id = ? AND m.status = 2
      AND m.id IN (SELECT meeting_id FROM \`group_meeting_participant\` WHERE user_id = ?)
      ORDER BY m.meeting_time DESC, m.id DESC LIMIT 1`
    const [rows] = await this._execute(sql, [Number(groupId), Number(userId)], 'latestParticipatedByGroup')
    return rows[0] || null
  }

  /**
   * 已发布会议统计（统计弹窗用；groupId 为空表示全平台）：
   * 会议总数 / 本月会议数 / 参与人次累计。
   * @param {number|null} groupId
   */
  async statsByGroup(groupId) {
    const where = []
    const values = []
    if (groupId !== undefined && groupId !== null && groupId !== '') {
      where.push('m.group_id = ?')
      values.push(Number(groupId))
    }
    where.push('m.status = 2')
    const clause = 'WHERE ' + where.join(' AND ')
    const sql =
      `SELECT COUNT(*) AS total,
        SUM(CASE WHEN DATE_FORMAT(m.meeting_time, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m') THEN 1 ELSE 0 END) AS month_total,
        COALESCE(SUM(COALESCE(p.cnt, 0)), 0) AS attend_sum
      FROM \`group_meeting\` m
      LEFT JOIN ${PARTICIPANT_SUB} p ON p.meeting_id = m.id
      ${clause}`
    const [rows] = await this._execute(sql, values, 'statsByGroup')
    return rows[0] || { total: 0, month_total: 0, attend_sum: 0 }
  }
}

module.exports = new GroupMeetingRepository()
