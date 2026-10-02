/**
 * 任务动态仓库（Repository Layer）—— 对应 `task_dynamic` 表
 *
 * 说明：任务全生命周期动作留痕（创建/编辑/分配/移除参与人/提交进展/状态变更/验收/删除/恢复）。
 * 动态不可单独删除，随任务软删级联软删（is_deleted=1）保留。
 */
const BaseRepository = require('./BaseRepository')
const { normalizePage, buildPageMeta } = require('./queryHelpers')

class TaskDynamicRepository extends BaseRepository {
  constructor() {
    super('task_dynamic')
  }

  /**
   * 写一条动态
   * @param {number} taskId
   * @param {number} operatorId
   * @param {string} action
   * @param {{ fromStatus?: number|null, toStatus?: number|null, detail?: string }} [extra]
   */
  async create(taskId, operatorId, action, { fromStatus = null, toStatus = null, detail = null } = {}) {
    const data = {
      task_id: Number(taskId),
      operator_id: Number(operatorId),
      action,
      from_status: fromStatus === undefined || fromStatus === null ? null : Number(fromStatus),
      to_status: toStatus === undefined || toStatus === null ? null : Number(toStatus),
      detail: detail === undefined || detail === null ? null : String(detail).slice(0, 500)
    }
    return super.create(data)
  }

  /**
   * 某任务动态分页（倒序：最新在前）
   * @param {number} taskId
   * @param {{ page?: number }} filters
   */
  async listByTask(taskId, filters = {}) {
    const where = 'WHERE d.task_id = ? AND d.is_deleted = 0'
    const values = [Number(taskId)]

    const countSql = `SELECT COUNT(*) AS total FROM \`task_dynamic\` d ${where}`
    const [countRows] = await this._execute(countSql, values, 'listByTask.count')
    const total = Number(countRows[0] && countRows[0].total) || 0

    const { page, pageSize, limit, offset } = normalizePage(filters.page)
    const sql =
      `SELECT d.id, d.task_id, d.operator_id, d.action, d.from_status, d.to_status, d.detail, d.created_at,
        u.real_name AS operator_real_name, u.username AS operator_username
      FROM \`task_dynamic\` d
      LEFT JOIN \`users\` u ON u.id = d.operator_id
      ${where} ORDER BY d.id DESC LIMIT ${limit} OFFSET ${offset}`
    const [rows] = await this._execute(sql, values, 'listByTask')
    return { list: rows, ...buildPageMeta(total, page, pageSize) }
  }

  /** 任务软删时级联软删其全部动态 */
  async softDeleteByTask(taskId) {
    const sql = 'UPDATE `task_dynamic` SET is_deleted = 1 WHERE task_id = ? AND is_deleted = 0'
    const [result] = await this._execute(sql, [Number(taskId)], 'softDeleteByTask')
    return result.affectedRows
  }
}

// 导出单例
module.exports = new TaskDynamicRepository()
