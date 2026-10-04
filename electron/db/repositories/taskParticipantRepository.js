/**
 * 任务参与人仓库（Repository Layer）—— 对应 `task_participant` 表
 *
 * 说明：同一任务同一用户仅一条（UNIQUE，插入用 INSERT IGNORE 幂等）。
 * 移除参与人为硬删除（先例同组会参与人），唯一约束不受历史记录影响。
 * 列表 JOIN `users` 取姓名/用户名/角色。
 */
class TaskParticipantRepository {
  constructor() {
    this.tableName = 'task_participant'
  }

  /** 统一 SQL 执行出口（复用 BaseRepository 的连接获取与日志） */
  async _execute(sql, params, action) {
    const BaseRepository = require('./BaseRepository')
    return new BaseRepository(this.tableName)._execute(sql, params, action)
  }

  /** 某任务参与人名单（JOIN users 取姓名/用户名/角色/账号状态） */
  async listByTask(taskId) {
    const sql =
      `SELECT p.user_id, p.status AS participant_status, p.finish_time, p.created_at,
        u.real_name, u.username, u.role, u.status AS user_status
      FROM \`task_participant\` p
      LEFT JOIN \`users\` u ON u.id = p.user_id
      WHERE p.task_id = ?
      ORDER BY p.id ASC`
    const [rows] = await this._execute(sql, [Number(taskId)], 'listByTask')
    return rows
  }

  /** 某任务参与人 id 列表 */
  async listUserIdsByTask(taskId) {
    const sql = 'SELECT user_id FROM `task_participant` WHERE task_id = ?'
    const [rows] = await this._execute(sql, [Number(taskId)], 'listUserIdsByTask')
    return rows.map((r) => Number(r.user_id))
  }

  /** 某任务参与人数量 */
  async countByTask(taskId) {
    const sql = 'SELECT COUNT(*) AS total FROM `task_participant` WHERE task_id = ?'
    const [rows] = await this._execute(sql, [Number(taskId)], 'countByTask')
    return Number(rows[0] && rows[0].total) || 0
  }

  /** 某用户参与过的全部任务 id 列表 */
  async listTaskIdsByUser(userId) {
    const sql = 'SELECT task_id FROM `task_participant` WHERE user_id = ?'
    const [rows] = await this._execute(sql, [Number(userId)], 'listTaskIdsByUser')
    return rows.map((r) => Number(r.task_id))
  }

  /** 查询某任务某用户的参与记录 */
  async findByTaskAndUser(taskId, userId) {
    const sql = 'SELECT * FROM `task_participant` WHERE task_id = ? AND user_id = ?'
    const [rows] = await this._execute(sql, [Number(taskId), Number(userId)], 'findByTaskAndUser')
    return rows[0] || null
  }

  /** 批量插入参与人（INSERT IGNORE：同人同任务重复静默跳过） */
  async createMany(taskId, userIds) {
    if (!Array.isArray(userIds) || userIds.length === 0) return 0
    const marks = userIds.map(() => '(?, ?)').join(', ')
    const values = []
    for (const uid of userIds) {
      values.push(Number(taskId), Number(uid))
    }
    const sql = `INSERT IGNORE INTO \`task_participant\` (task_id, user_id) VALUES ${marks}`
    const [result] = await this._execute(sql, values, 'createMany')
    return result.affectedRows
  }

  /** 移除指定参与人（硬删除） */
  async deleteByTaskAndUsers(taskId, userIds) {
    if (!Array.isArray(userIds) || userIds.length === 0) return 0
    const marks = userIds.map(() => '?').join(', ')
    const sql = `DELETE FROM \`task_participant\` WHERE task_id = ? AND user_id IN (${marks})`
    const [result] = await this._execute(sql, [Number(taskId), ...userIds.map(Number)], 'deleteByTaskAndUsers')
    return result.affectedRows
  }

  /** 物理删除某课题组全部任务的参与人记录（删除课题组事务内调用） */
  async deleteByGroupId(groupId) {
    const sql =
      'DELETE FROM `task_participant` WHERE task_id IN (SELECT id FROM `task` WHERE group_id = ?)'
    const [result] = await this._execute(sql, [Number(groupId)], 'deleteByGroupId')
    return result.affectedRows
  }

  /** 物理删除某用户创建的全部任务的参与人记录（删除用户事务内调用） */
  async deleteByCreator(creatorId) {
    const sql =
      'DELETE FROM `task_participant` WHERE task_id IN (SELECT id FROM `task` WHERE creator_id = ?)'
    const [result] = await this._execute(sql, [Number(creatorId)], 'deleteByCreator')
    return result.affectedRows
  }

  /** 物理删除某用户全部参与记录（删除用户事务内调用，仅清参与、不删任务本身） */
  async deleteByUser(userId) {
    const sql = 'DELETE FROM `task_participant` WHERE user_id = ?'
    const [result] = await this._execute(sql, [Number(userId)], 'deleteByUser')
    return result.affectedRows
  }

  /** 验收通过：将该任务全部参与人标记为已完成并写入完成时间 */
  async updateFinishByTask(taskId) {
    const sql =
      'UPDATE `task_participant` SET status = 2, finish_time = NOW() WHERE task_id = ? AND status = 1'
    const [result] = await this._execute(sql, [Number(taskId)], 'updateFinishByTask')
    return result.affectedRows
  }
}

module.exports = new TaskParticipantRepository()
