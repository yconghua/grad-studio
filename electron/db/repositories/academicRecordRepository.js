/**
 * 学业档案记录仓库（Repository Layer）—— 对应 `academic_records` 表
 *
 * 继承 BaseRepository 获得通用 findById / create / update / delete；
 * 本表所有权语义特殊：记录以 user_id 归属学生（服务层注入，客户端不可传），
 * group_id 仅为按组筛选的冗余；同一学生同一节点唯一（uk_user_node）。
 * 软删除约定与全项目一致（is_deleted 0/1）。
 */
const BaseRepository = require('./BaseRepository')

// 列表安全返回列（不含 content 大字段时列表页不需要；时间线详情按需取全列）
const LIST_COLUMNS = [
  'id', 'user_id', 'group_id', 'stage_type', 'node_key', 'node_name',
  'plan_date', 'happen_date', 'end_date', 'status', 'reject_reason', 'created_at'
]

function cols(columns) {
  return columns.map((c) => `\`${c}\``).join(', ')
}

class AcademicRecordRepository extends BaseRepository {
  constructor() {
    super('academic_records')
  }

  // 某学生的全部记录（按节点标识排序，前端再按模板顺序渲染）
  async listByUser(userId) {
    const sql =
      `SELECT * FROM \`academic_records\` WHERE user_id = ? AND is_deleted = 0 ORDER BY node_key`
    const [rows] = await this._execute(sql, [Number(userId)], 'listByUser')
    return rows
  }

  // 某学生的单节点记录（不存在返回 null）
  async findByUserAndNode(userId, nodeKey) {
    const sql =
      `SELECT * FROM \`academic_records\` WHERE user_id = ? AND node_key = ? AND is_deleted = 0`
    const [rows] = await this._execute(sql, [Number(userId), String(nodeKey)], 'findByUserAndNode')
    return rows[0] || null
  }

  // 按主键查记录（含归属学生，供查看/操作前校验归属）
  async findByIdWithOwner(id) {
    const sql =
      `SELECT * FROM \`academic_records\` WHERE id = ? AND is_deleted = 0`
    const [rows] = await this._execute(sql, [Number(id)], 'findByIdWithOwner')
    return rows[0] || null
  }

  // 批量查多条记录（统计 / 导出用；IN 列表由服务层传入可信 id 数组）
  async listByIds(ids) {
    if (!ids || !ids.length) return []
    const marks = ids.map(() => '?').join(', ')
    const sql =
      `SELECT * FROM \`academic_records\` WHERE id IN (${marks}) AND is_deleted = 0`
    const [rows] = await this._execute(sql, ids.map(Number), 'listByIds')
    return rows
  }

  // 某课题组全部学生的记录（统计：JOIN 由服务层用 user 列表完成，本方法按组直接取）
  async listByGroup(groupId) {
    const sql =
      `SELECT * FROM \`academic_records\` WHERE group_id = ? AND is_deleted = 0`
    const [rows] = await this._execute(sql, [Number(groupId)], 'listByGroup')
    return rows
  }

  // 写入或更新学生某节点记录（uk_user_node 冲突时更新）
  // data 中的 user_id/group_id/node_key/node_name/plan_date 为模板快照与归属，
  // 业务字段（happen_date/end_date/content/attachment_path/status/reject_reason/created_by）按需更新
  async upsertByUserNode(userId, nodeKey, data = {}) {
    const colsSet = Object.keys(data)
    if (!colsSet.length) return null
    const updateClause = colsSet.map((c) => `\`${c}\` = VALUES(\`${c}\`)`).join(', ')
    const sql =
      `INSERT INTO \`academic_records\` (\`user_id\`, \`node_key\`, ${colsSet.map((c) => `\`${c}\``).join(', ')})
       VALUES (?, ?, ${colsSet.map(() => '?').join(', ')})
       ON DUPLICATE KEY UPDATE ${updateClause}`
    const [result] = await this._execute(
      sql,
      [Number(userId), String(nodeKey), ...colsSet.map((c) => data[c])],
      'upsertByUserNode'
    )
    // 插入返回 insertId；更新返回 lastInsertId（同键）
    return result.insertId
  }

  // 更新节点状态（确认 / 退回 / 提交），带归属学生校验条件
  async updateStatus(id, userId, status, extra = {}) {
    const setParts = ['`status` = ?']
    const values = [status]
    for (const k of Object.keys(extra)) {
      setParts.push(`\`${k}\` = ?`)
      values.push(extra[k])
    }
    values.push(Number(id), Number(userId))
    const sql =
      `UPDATE \`academic_records\` SET ${setParts.join(', ')} WHERE id = ? AND user_id = ? AND is_deleted = 0`
    const [result] = await this._execute(sql, values, 'updateStatus')
    return result.affectedRows
  }

  // 批量确认：某学生多个节点一次性置为 confirmed（导师批量确认）
  async batchConfirm(userId, nodeKeys) {
    if (!nodeKeys || !nodeKeys.length) return 0
    const marks = nodeKeys.map(() => '?').join(', ')
    const sql =
      `UPDATE \`academic_records\` SET \`status\` = 'confirmed', \`reject_reason\` = NULL
       WHERE user_id = ? AND node_key IN (${marks}) AND status = 'submitted' AND is_deleted = 0`
    const [result] = await this._execute(sql, [Number(userId), ...nodeKeys], 'batchConfirm')
    return result.affectedRows
  }

  // 提醒扫描：临近（≤7天）或已逾期且未完成（happen_date 为空）的记录；
  // remind_at 为空或距今 ≥7 天时纳入本轮（remind_at 去重由服务层写回）
  async listRemindable(now = new Date()) {
    const in7d = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    const today = now.toISOString().slice(0, 10)
    const sql =
      `SELECT * FROM \`academic_records\`
       WHERE is_deleted = 0 AND happen_date IS NULL
         AND plan_date IS NOT NULL AND plan_date <= ?
         AND (remind_at IS NULL OR remind_at < DATE_SUB(NOW(), INTERVAL 7 DAY))`
    const [rows] = await this._execute(sql, [in7d], 'listRemindable')
    return rows
  }

  // 写回提醒时间（去重）
  async markReminded(id) {
    const sql =
      `UPDATE \`academic_records\` SET \`remind_at\` = NOW() WHERE id = ? AND is_deleted = 0`
    const [result] = await this._execute(sql, [Number(id)], 'markReminded')
    return result.affectedRows
  }

  // 学生删除时级联清理：该学生全部记录软删（用户删除事务内调用）
  async softDeleteByUser(userId) {
    return this.softDeleteByField('user_id', userId)
  }
}

module.exports = new AcademicRecordRepository()
