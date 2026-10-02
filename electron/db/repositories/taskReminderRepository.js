/**
 * 任务提醒仓库（Repository Layer）—— 对应 `task_reminder` 表
 *
 * 说明：定时扫描去重。同一任务 + 同一用户 + 同一提醒类型 + 同一日期唯一（表级 UNIQUE），
 * 扫描器用 INSERT IGNORE 写入，affectedRows=0 表示该轮已提醒过，静默跳过。
 */
class TaskReminderRepository {
  constructor() {
    this.tableName = 'task_reminder'
  }

  /** 统一 SQL 执行出口（复用 BaseRepository 的连接获取与日志） */
  async _execute(sql, params, action) {
    const BaseRepository = require('./BaseRepository')
    return new BaseRepository(this.tableName)._execute(sql, params, action)
  }

  /**
   * 幂等写入提醒记录：冲突（同日同人同类型）返回 0，不报错。
   * @param {number} taskId
   * @param {number} userId
   * @param {string} remindType due_soon / overdue / pending_review
   * @param {string} remindDate YYYY-MM-DD
   */
  async insertIgnore(taskId, userId, remindType, remindDate) {
    const sql =
      'INSERT IGNORE INTO `task_reminder` (task_id, user_id, remind_type, remind_date) VALUES (?, ?, ?, ?)'
    const [result] = await this._execute(
      sql,
      [Number(taskId), Number(userId), remindType, remindDate],
      'insertIgnore'
    )
    return result.affectedRows
  }

  /**
   * 写入后回填发送时间（通知成功写入后调用，纯记录）
   * @param {number} taskId
   * @param {number} userId
   * @param {string} remindType
   * @param {string} remindDate
   */
  async markSent(taskId, userId, remindType, remindDate) {
    const sql =
      'UPDATE `task_reminder` SET sent_at = NOW() WHERE task_id = ? AND user_id = ? AND remind_type = ? AND remind_date = ?'
    const [result] = await this._execute(sql, [Number(taskId), Number(userId), remindType, remindDate], 'markSent')
    return result.affectedRows
  }
}

module.exports = new TaskReminderRepository()
