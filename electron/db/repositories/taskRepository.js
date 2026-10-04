/**
 * 任务仓库（Repository Layer）—— 对应 `task` 表
 *
 * 说明：任务属于课题组（group_id），软删除（is_deleted + deleted_at，恢复可继续使用）。
 * 列表 / 详情统一 LEFT JOIN `groups` 取组名、LEFT JOIN `users` 取创建人姓名，
 * 创建人被删除时姓名回退「用户 #id」（由服务层 DTO 处理）。
 * 所有写操作走 updateWithVersion（乐观锁）：WHERE 带 version 条件，冲突返回 0，
 * 由服务层转成「任务已被他人更新，请刷新」。
 */
const BaseRepository = require('./BaseRepository')
const { buildUpdateSet, normalizePage, buildPageMeta } = require('./queryHelpers')

// 任务表安全返回列（不含 description 等大字段，详情单独取全列）
const LIST_COLUMNS = [
  'id', 'group_id', 'title', 'creator_id', 'creator_role',
  'status', 'priority', 'start_time', 'due_time', 'finish_time',
  'progress', 'sort_order', 'version', 'created_at', 'updated_at'
]

function cols(columns, prefix = 't') {
  return columns.map((c) => `${prefix}.\`${c}\``).join(', ')
}

// 任务列表排序（方案约定）：
//   1. 逾期优先（有截止时间且已过截止、且仍处于待办/进行中）；
//   2. 截止时间升序（无截止时间排最后）；
//   3. 优先级降序（紧急在前）；
//   4. 创建时间降序、ID 降序兜底。
const ORDER_BY =
  '(t.due_time IS NOT NULL AND t.due_time < NOW() AND t.status IN (1, 2)) DESC,' +
  ' t.due_time IS NULL ASC, t.due_time ASC, t.priority DESC, t.created_at DESC, t.id DESC'

/**
 * 按角色可见范围 + 筛选条件拼 WHERE（scope 在服务层收敛，本方法只负责拼接）。
 * @param {{ groupId?:number, creatorId?:number, participantUserId?:number, mentorId?:number,
 *           status?:number, statuses?:number[], priority?:number, keyword?:string,
 *           creatorRoles?:string[] }} p
 * @returns {{ where:string, values:any[] }}
 */
function buildScopeWhere(p = {}) {
  const where = ['t.is_deleted = 0']
  const values = []
  if (Array.isArray(p.creatorRoles) && p.creatorRoles.length > 0) {
    const marks = p.creatorRoles.map(() => '?').join(', ')
    where.push(`t.creator_role IN (${marks})`)
    values.push(...p.creatorRoles)
  }
  if (p.groupId) {
    where.push('t.group_id = ?')
    values.push(Number(p.groupId))
  }
  if (p.creatorId) {
    where.push('t.creator_id = ?')
    values.push(Number(p.creatorId))
  }
  if (p.participantUserId) {
    where.push('EXISTS (SELECT 1 FROM `task_participant` tp WHERE tp.task_id = t.id AND tp.user_id = ?)')
    values.push(Number(p.participantUserId))
  }
  if (p.mentorId) {
    // 名下学生参与的任务：参与人列表中存在 mentor_id = 当前导师 的学生
    where.push(
      'EXISTS (SELECT 1 FROM `task_participant` tp JOIN `users` u ON u.id = tp.user_id ' +
      'WHERE tp.task_id = t.id AND u.mentor_id = ?)'
    )
    values.push(Number(p.mentorId))
  }
  if (p.status !== undefined && p.status !== null && p.status !== '') {
    where.push('t.status = ?')
    values.push(Number(p.status))
  }
  if (Array.isArray(p.statuses) && p.statuses.length > 0) {
    const marks = p.statuses.map(() => '?').join(', ')
    where.push(`t.status IN (${marks})`)
    values.push(...p.statuses.map(Number))
  }
  if (p.priority !== undefined && p.priority !== null && p.priority !== '') {
    where.push('t.priority = ?')
    values.push(Number(p.priority))
  }
  if (p.keyword && String(p.keyword).trim()) {
    where.push('t.title LIKE ?')
    values.push(`%${String(p.keyword).trim()}%`)
  }
  return { where: where.join(' AND '), values }
}

class TaskRepository extends BaseRepository {
  constructor() {
    super('task')
  }

  /**
   * 任务详情（含组名、创建人姓名、参与人数）
   * @param {number} id
   */
  async findById(id) {
    const sql =
      `SELECT t.*, g.name AS group_name,
        u.real_name AS creator_real_name, u.username AS creator_username,
        (SELECT COUNT(*) FROM \`task_participant\` tp WHERE tp.task_id = t.id) AS participant_count
      FROM \`task\` t
      LEFT JOIN \`groups\` g ON g.id = t.group_id
      LEFT JOIN \`users\` u ON u.id = t.creator_id
      WHERE t.id = ? AND t.is_deleted = 0`
    const [rows] = await this._execute(sql, [Number(id)], 'findById')
    return rows[0] || null
  }

  /**
   * 任务分页列表：按角色范围 + 筛选条件 + 方案排序。
   * @param {{ groupId?:number, creatorId?:number, participantUserId?:number, mentorId?:number,
   *           status?:number, priority?:number, keyword?:string, page?:number }} filters
   */
  async pagedList(filters = {}) {
    const { where, values } = buildScopeWhere(filters)

    const countSql = `SELECT COUNT(*) AS total FROM \`task\` t WHERE ${where}`
    const [countRows] = await this._execute(countSql, values, 'pagedList.count')
    const total = Number(countRows[0] && countRows[0].total) || 0

    const { page, pageSize, limit, offset } = normalizePage(filters.page)
    // LIMIT/OFFSET 直接内联整数值（normalizePage 已归一化），规避预编译占位符问题
    const sql =
      `SELECT ${cols(LIST_COLUMNS)}, g.name AS group_name,
        u.real_name AS creator_real_name, u.username AS creator_username
      FROM \`task\` t
      LEFT JOIN \`groups\` g ON g.id = t.group_id
      LEFT JOIN \`users\` u ON u.id = t.creator_id
      WHERE ${where} ORDER BY ${ORDER_BY} LIMIT ${limit} OFFSET ${offset}`
    const [rows] = await this._execute(sql, values, 'pagedList')
    return { list: rows, ...buildPageMeta(total, page, pageSize) }
  }

  /**
   * 通用计数：按角色范围统计任务数（统计看板 / 工作台摘要用）
   * @param {Object} filters 同 buildScopeWhere
   */
  async countByFilter(filters = {}) {
    const { where, values } = buildScopeWhere(filters)
    const sql = `SELECT COUNT(*) AS total FROM \`task\` t WHERE ${where}`
    const [rows] = await this._execute(sql, values, 'countByFilter')
    return Number(rows[0] && rows[0].total) || 0
  }

  /**
   * 状态分布：按状态分组计数（统计看板 / 工作台摘要用）
   * @param {Object} filters 同 buildScopeWhere
   */
  async statusDistribution(filters = {}) {
    const { where, values } = buildScopeWhere(filters)
    const sql =
      `SELECT t.status AS status, COUNT(*) AS cnt FROM \`task\` t WHERE ${where} GROUP BY t.status`
    const [rows] = await this._execute(sql, values, 'statusDistribution')
    const dist = {}
    for (const r of rows || []) dist[Number(r.status)] = Number(r.cnt)
    return dist
  }

  /**
   * 逾期任务数：有截止时间且已过截止、且仍处于待办/进行中
   * @param {Object} filters 同 buildScopeWhere
   */
  async countOverdue(filters = {}) {
    const { where, values } = buildScopeWhere(filters)
    const sql =
      `SELECT COUNT(*) AS total FROM \`task\` t WHERE ${where} AND t.due_time IS NOT NULL AND t.due_time < NOW() AND t.status IN (1, 2)`
    const [rows] = await this._execute(sql, values, 'countOverdue')
    return Number(rows[0] && rows[0].total) || 0
  }

  /**
   * 即将到期任务数：截止时间在 [now, now+hours]，且处于待办/进行中
   * @param {number} hours
   * @param {Object} filters 同 buildScopeWhere
   */
  async countDueSoon(hours, filters = {}) {
    const { where, values } = buildScopeWhere(filters)
    const sql =
      `SELECT COUNT(*) AS total FROM \`task\` t WHERE ${where} AND t.due_time IS NOT NULL AND t.due_time > NOW() AND t.due_time <= DATE_ADD(NOW(), INTERVAL ? HOUR) AND t.status IN (1, 2)`
    values.push(Number(hours))
    const [rows] = await this._execute(sql, values, 'countDueSoon')
    return Number(rows[0] && rows[0].total) || 0
  }

  /**
   * 乐观锁更新：仅当版本号一致且未删除时更新，并把 version +1。
   * @param {number} id
   * @param {Object} data 字段->值 映射
   * @param {number} version 读到的旧版本号
   * @returns {number} affectedRows（0 = 版本冲突或已删除）
   */
  async updateWithVersion(id, data, version) {
    const { clause, values } = buildUpdateSet(data)
    if (!clause) return 0
    const sql =
      `UPDATE \`task\` SET ${clause}, version = version + 1 WHERE id = ? AND version = ? AND is_deleted = 0`
    const [result] = await this._execute(sql, [...values, Number(id), Number(version)], 'updateWithVersion')
    return result.affectedRows
  }

  /**
   * 软删除：is_deleted=1 且写入删除时间
   * @param {number} id
   */
  async softDelete(id) {
    const sql = 'UPDATE `task` SET is_deleted = 1, deleted_at = NOW() WHERE id = ? AND is_deleted = 0'
    const [result] = await this._execute(sql, [Number(id)], 'softDelete')
    return result.affectedRows
  }

  /**
   * 恢复：is_deleted=0 且清空删除时间
   * @param {number} id
   */
  async restore(id) {
    const sql = 'UPDATE `task` SET is_deleted = 0, deleted_at = NULL WHERE id = ? AND is_deleted = 1'
    const [result] = await this._execute(sql, [Number(id)], 'restore')
    return result.affectedRows
  }

  /**
   * 物理删除某课题组全部任务（删除课题组事务内调用；子表先按组删）
   * @param {number} groupId
   */
  async deleteByGroupId(groupId) {
    const sql = 'DELETE FROM `task` WHERE group_id = ?'
    const [result] = await this._execute(sql, [Number(groupId)], 'deleteByGroupId')
    return result.affectedRows
  }

  /**
   * 某用户创建的全部任务 id（删除用户事务内调用，用于级联清理其创建的任务与关联通知）
   * @param {number} creatorId
   */
  async listIdsByCreator(creatorId) {
    const sql = 'SELECT id FROM `task` WHERE creator_id = ?'
    const [rows] = await this._execute(sql, [Number(creatorId)], 'listIdsByCreator')
    return rows.map((r) => Number(r.id))
  }

  /**
   * 物理删除某用户创建的全部任务（删除用户事务内调用；子表先按创建者删）
   * @param {number} creatorId
   */
  async deleteByCreator(creatorId) {
    const sql = 'DELETE FROM `task` WHERE creator_id = ?'
    const [result] = await this._execute(sql, [Number(creatorId)], 'deleteByCreator')
    return result.affectedRows
  }

  /**
   * 扫描：即将到期任务（截止时间在 [now, now+hours]，待办/进行中）
   * @param {number} hours
   */
  async dueSoonTasks(hours) {
    const sql =
      `SELECT t.id, t.title, t.group_id, t.creator_id, t.due_time
      FROM \`task\` t
      WHERE t.is_deleted = 0 AND t.due_time IS NOT NULL AND t.due_time > NOW()
        AND t.due_time <= DATE_ADD(NOW(), INTERVAL ? HOUR) AND t.status IN (1, 2)`
    const [rows] = await this._execute(sql, [Number(hours)], 'dueSoonTasks')
    return rows
  }

  /**
   * 扫描：已逾期任务（截止时间已过，待办/进行中）
   */
  async overdueTasks() {
    const sql =
      `SELECT t.id, t.title, t.group_id, t.creator_id, t.due_time
      FROM \`task\` t
      WHERE t.is_deleted = 0 AND t.due_time IS NOT NULL AND t.due_time < NOW() AND t.status IN (1, 2)`
    const [rows] = await this._execute(sql, [], 'overdueTasks')
    return rows
  }

  /**
   * 扫描：待验收超时任务（进入待验收超过 hours 小时，提醒创建者）。
   * 进入待验收时间以任务动态表「最后一次 status_change → 3」的创建时间为准。
   * @param {number} hours
   */
  async pendingReviewTasks(hours) {
    const sql =
      `SELECT t.id, t.title, t.group_id, t.creator_id
      FROM \`task\` t
      WHERE t.is_deleted = 0 AND t.status = 3
        AND t.id IN (
          SELECT d.task_id FROM \`task_dynamic\` d
          WHERE d.is_deleted = 0 AND d.action = 'status_change' AND d.to_status = 3
          GROUP BY d.task_id
          HAVING MAX(d.created_at) <= DATE_SUB(NOW(), INTERVAL ? HOUR)
        )`
    const [rows] = await this._execute(sql, [Number(hours)], 'pendingReviewTasks')
    return rows
  }

  /**
   * 全量列表（超管总览按成员展开用，不分页；按方案排序）
   * @param {Object} filters 同 buildScopeWhere
   */
  async listAll(filters = {}) {
    const { where, values } = buildScopeWhere(filters)
    const sql =
      `SELECT ${cols(LIST_COLUMNS)}, g.name AS group_name,
        u.real_name AS creator_real_name, u.username AS creator_username
      FROM \`task\` t
      LEFT JOIN \`groups\` g ON g.id = t.group_id
      LEFT JOIN \`users\` u ON u.id = t.creator_id
      WHERE ${where} ORDER BY ${ORDER_BY}`
    const [rows] = await this._execute(sql, values, 'listAll')
    return rows
  }

  /**
   * 查已软删除的任务（恢复操作前定位用）
   * @param {number} id
   */
  async findDeletedById(id) {
    const sql =
      `SELECT t.*, g.name AS group_name,
        u.real_name AS creator_real_name, u.username AS creator_username
      FROM \`task\` t
      LEFT JOIN \`groups\` g ON g.id = t.group_id
      LEFT JOIN \`users\` u ON u.id = t.creator_id
      WHERE t.id = ? AND t.is_deleted = 1`
    const [rows] = await this._execute(sql, [Number(id)], 'findDeletedById')
    return rows[0] || null
  }

  /**
   * 仅递增版本号（参与人增删等不改主表字段、但需刷新并发感知的操作用）
   * @param {number} id
   * @param {number} version
   */
  async bumpVersion(id, version) {
    const sql =
      'UPDATE `task` SET version = version + 1 WHERE id = ? AND version = ? AND is_deleted = 0'
    const [result] = await this._execute(sql, [Number(id), Number(version)], 'bumpVersion')
    return result.affectedRows
  }

  /**
   * 按创建角色分布计数（超管总览统计用）
   */
  async creatorRoleDistribution() {
    const sql =
      `SELECT t.creator_role AS creator_role, COUNT(*) AS cnt FROM \`task\` t
      WHERE t.is_deleted = 0 GROUP BY t.creator_role`
    const [rows] = await this._execute(sql, [], 'creatorRoleDistribution')
    const dist = {}
    for (const r of rows || []) dist[r.creator_role] = Number(r.cnt)
    return dist
  }
}

// 导出单例
module.exports = new TaskRepository()
