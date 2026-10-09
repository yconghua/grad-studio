/**
 * 待办仓库（Repository Layer）—— 对应 `todos` 表
 *
 * 继承 BaseRepository 获得通用 findById / create / update / delete；
 * 归属语义：owner_id 为归属核心（服务层注入，客户端不可传），group_id 仅为按组筛选冗余；
 * 软删除约定与全项目一致（is_deleted 0/1）。
 */
const BaseRepository = require('./BaseRepository')
const { buildOrderBy, normalizePage } = require('./queryHelpers')

// 排序白名单：语义字段 → 可信 SQL 片段（t=todos 别名，u=users 别名）
const SORT_MAP = {
  owner: 'u.real_name',
  title: 't.title',
  priority: 't.priority',
  dueTime: 't.due_time',
  sourceType: 't.source_type',
  status: 't.status',
  createdAt: 't.created_at'
}

class TodoRepository extends BaseRepository {
  constructor() {
    super('todos')
  }

  // 分页查询（列表统一：每页 8 条，后端排序）
  // 范围条件：ownerId（本人）/ groupId（组管、超管按组）；超管不传范围 = 全平台。
  // 过滤：status / priority / sourceType / ownerId 精确；dueFrom/dueTo 截止时间范围；
  // keyword 模糊搜 名称/备注/标签/归属人姓名/用户名/学号。
  async paged({ ownerId, groupId, status, priority, sourceType, filterOwnerId, keyword, dueFrom, dueTo, page, pageSize, sortField, sortOrder } = {}) {
    const whereParts = ['t.is_deleted = 0']
    const values = []
    if (ownerId) { whereParts.push('t.owner_id = ?'); values.push(Number(ownerId)) }
    if (groupId) { whereParts.push('t.group_id = ?'); values.push(Number(groupId)) }
    if (status) { whereParts.push('t.status = ?'); values.push(String(status)) }
    if (priority) { whereParts.push('t.priority = ?'); values.push(String(priority)) }
    if (sourceType === 'manual') { whereParts.push('t.source_type IS NULL') }
    else if (sourceType) { whereParts.push('t.source_type = ?'); values.push(String(sourceType)) }
    if (filterOwnerId) { whereParts.push('t.owner_id = ?'); values.push(Number(filterOwnerId)) }
    if (dueFrom) { whereParts.push('t.due_time >= ?'); values.push(String(dueFrom)) }
    if (dueTo) { whereParts.push('t.due_time <= ?'); values.push(String(dueTo)) }
    if (keyword) {
      const kw = `%${String(keyword).trim()}%`
      whereParts.push('(t.title LIKE ? OR t.note LIKE ? OR t.tag LIKE ? OR u.real_name LIKE ? OR u.username LIKE ? OR u.user_no LIKE ?)')
      values.push(kw, kw, kw, kw, kw, kw)
    }
    const where = 'WHERE ' + whereParts.join(' AND ')
    const order = buildOrderBy({ sortField, sortOrder }, SORT_MAP, 't.id DESC')
    const { limit, offset, page: cur, pageSize: size } = normalizePage(page, pageSize)

    const countSql =
      `SELECT COUNT(*) AS total FROM \`todos\` t JOIN \`users\` u ON u.id = t.owner_id ${where}`
    const [countRows] = await this._execute(countSql, values, 'paged.count')
    const total = Number(countRows[0] && countRows[0].total)

    const sql =
      `SELECT t.*, u.real_name, u.username, u.user_no
       FROM \`todos\` t JOIN \`users\` u ON u.id = t.owner_id ${where} ${order} LIMIT ${limit} OFFSET ${offset}`
    const [rows] = await this._execute(sql, values, 'paged')
    return { list: rows, total, page: cur, pageSize: size }
  }

  // 按主键查待办（含归属人信息，供查看/操作前校验）
  async findByIdWithOwner(id) {
    const sql =
      `SELECT t.*, u.real_name, u.username, u.user_no
       FROM \`todos\` t JOIN \`users\` u ON u.id = t.owner_id
       WHERE t.id = ? AND t.is_deleted = 0`
    const [rows] = await this._execute(sql, [Number(id)], 'findByIdWithOwner')
    return rows[0] || null
  }

  // 按来源判重：同一人同一来源只能转一次（唯一索引兜底，此查询用于友好提示）
  async findBySource(ownerId, sourceType, sourceId) {
    if (!sourceType || sourceId == null) return null
    const sql =
      `SELECT t.*, u.real_name, u.username, u.user_no
       FROM \`todos\` t JOIN \`users\` u ON u.id = t.owner_id
       WHERE t.owner_id = ? AND t.source_type = ? AND t.source_id = ? AND t.is_deleted = 0`
    const [rows] = await this._execute(sql, [Number(ownerId), String(sourceType), Number(sourceId)], 'findBySource')
    return rows[0] || null
  }

  // 标记完成 / 取消完成（仅归属人可操作，带归属校验条件）
  async updateStatus(id, ownerId, status) {
    const sql =
      `UPDATE \`todos\` SET \`status\` = ?, \`done_at\` = IF(? = 'done', NOW(), NULL)
       WHERE id = ? AND owner_id = ? AND is_deleted = 0`
    const [result] = await this._execute(sql, [String(status), String(status), Number(id), Number(ownerId)], 'updateStatus')
    return result.affectedRows
  }

  // 标记已提醒（调度器去重）
  async markReminded(id) {
    const sql =
      `UPDATE \`todos\` SET \`reminded_at\` = NOW() WHERE id = ? AND is_deleted = 0`
    const [result] = await this._execute(sql, [Number(id)], 'markReminded')
    return result.affectedRows
  }

  // 待提醒扫描：设了提醒、未提醒过、未完成、且提醒时间已到（reminded_at 为 NULL 即为未提醒过）
  async listRemindable(now) {
    const sql =
      `SELECT t.*, u.real_name, u.username, u.user_no
       FROM \`todos\` t JOIN \`users\` u ON u.id = t.owner_id
       WHERE t.is_deleted = 0 AND t.status = 'pending'
         AND t.remind != 'none' AND t.reminded_at IS NULL
         AND t.due_time IS NOT NULL
         AND t.due_time <= DATE_ADD(?, INTERVAL (CASE t.remind WHEN '1h' THEN 1 WHEN '1d' THEN 1440 ELSE 0 END) MINUTE)`
    const [rows] = await this._execute(sql, [now], 'listRemindable')
    return rows
  }

  // 范围统计（总览统计卡 / 本人页统计卡共用）：总数 / 未完成 / 已完成 / 逾期
  async summary({ ownerId, groupId } = {}) {
    const whereParts = ['t.is_deleted = 0']
    const values = []
    if (ownerId) { whereParts.push('t.owner_id = ?'); values.push(Number(ownerId)) }
    if (groupId) { whereParts.push('t.group_id = ?'); values.push(Number(groupId)) }
    const where = 'WHERE ' + whereParts.join(' AND ')
    const sql =
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS done,
         SUM(CASE WHEN t.status = 'pending' AND t.due_time IS NOT NULL AND t.due_time < NOW() THEN 1 ELSE 0 END) AS overdue
       FROM \`todos\` t ${where}`
    const [rows] = await this._execute(sql, values, 'summary')
    const r = rows[0] || {}
    return {
      total: Number(r.total) || 0,
      pending: Number(r.pending) || 0,
      done: Number(r.done) || 0,
      overdue: Number(r.overdue) || 0
    }
  }

  // 指定时间范围内某人的待办（日历视图取数）
  async listByOwnerRange(ownerId, start, end) {
    const sql =
      `SELECT t.*, u.real_name, u.username, u.user_no
       FROM \`todos\` t JOIN \`users\` u ON u.id = t.owner_id
       WHERE t.owner_id = ? AND t.is_deleted = 0
         AND t.due_time IS NOT NULL
         AND t.due_time >= ? AND t.due_time < ?`
    const [rows] = await this._execute(sql, [Number(ownerId), start, end], 'listByOwnerRange')
    return rows
  }

  // 用户删除时级联清理：该用户全部待办软删（用户删除事务内调用）
  async softDeleteByUser(userId) {
    return this.softDeleteByField('owner_id', userId)
  }
}

module.exports = new TodoRepository()
