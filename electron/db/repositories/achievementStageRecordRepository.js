/**
 * 成果节点时间记录仓库（Repository Layer）—— 对应 `achievement_stage_records` 表
 *
 * 与学业档案记录同模式：成果 × 节点 唯一（uk_achievement_node）；
 * 学生填写（created_by=学生本人，防与成果代填人混淆）、导师审核；
 * 级联：删成果 / 删学生时物理删除本表记录。
 */
const BaseRepository = require('./BaseRepository')

class AchievementStageRecordRepository extends BaseRepository {
  constructor() {
    super('achievement_stage_records')
  }

  // 某成果的全部节点记录
  async listByAchievement(achievementId) {
    const sql =
      `SELECT * FROM \`achievement_stage_records\` WHERE achievement_id = ? ORDER BY node_key`
    const [rows] = await this._execute(sql, [Number(achievementId)], 'listByAchievement')
    return rows
  }

  // 批量取多成果的全部节点记录（导出用，一次往返）
  async listByAchievements(ids) {
    const arr = (ids || []).map(Number).filter((n) => n > 0)
    if (!arr.length) return []
    const sql =
      `SELECT * FROM \`achievement_stage_records\` WHERE achievement_id IN (${arr.map(() => '?').join(',')}) ORDER BY achievement_id, node_key`
    const [rows] = await this._execute(sql, arr, 'listByAchievements')
    return rows
  }

  // 按主键查记录（供查看/操作前校验归属）
  async findByIdWithOwner(id) {
    const sql = `SELECT * FROM \`achievement_stage_records\` WHERE id = ?`
    const [rows] = await this._execute(sql, [Number(id)], 'findByIdWithOwner')
    return rows[0] || null
  }

  // 某成果的单节点记录（不存在返回 null）
  async findByAchievementNode(achievementId, nodeKey) {
    const sql =
      `SELECT * FROM \`achievement_stage_records\` WHERE achievement_id = ? AND node_key = ?`
    const [rows] = await this._execute(sql, [Number(achievementId), String(nodeKey)], 'findByAchievementNode')
    return rows[0] || null
  }

  // 写入或更新某成果某节点记录（uk_achievement_node 冲突时更新）
  async upsertByAchievementNode(achievementId, nodeKey, data = {}) {
    const colsSet = Object.keys(data)
    if (!colsSet.length) return null
    const updateClause = colsSet.map((c) => `\`${c}\` = VALUES(\`${c}\`)`).join(', ')
    const sql =
      `INSERT INTO \`achievement_stage_records\` (\`achievement_id\`, \`node_key\`, ${colsSet.map((c) => `\`${c}\``).join(', ')})
       VALUES (?, ?, ${colsSet.map(() => '?').join(', ')})
       ON DUPLICATE KEY UPDATE ${updateClause}`
    const [result] = await this._execute(
      sql,
      [Number(achievementId), String(nodeKey), ...colsSet.map((c) => data[c])],
      'upsertByAchievementNode'
    )
    return result.insertId
  }

  // 更新节点状态（提交 / 确认 / 退回），带成果归属校验条件
  async updateStatus(id, achievementId, status, extra = {}) {
    const setParts = ['`status` = ?']
    const values = [status]
    for (const k of Object.keys(extra)) {
      setParts.push(`\`${k}\` = ?`)
      values.push(extra[k])
    }
    values.push(Number(id), Number(achievementId))
    const sql =
      `UPDATE \`achievement_stage_records\` SET ${setParts.join(', ')} WHERE id = ? AND achievement_id = ?`
    const [result] = await this._execute(sql, values, 'updateStatus')
    return result.affectedRows
  }

  // 删除某成果全部节点记录（删除成果事务内级联清理）
  async deleteByAchievement(achievementId) {
    const sql = 'DELETE FROM `achievement_stage_records` WHERE achievement_id = ?'
    const [result] = await this._execute(sql, [Number(achievementId)], 'deleteByAchievement')
    return result.affectedRows
  }

  // 删除某学生全部成果的节点记录（删除用户事务内级联清理，按成果归属定位）
  async deleteByUser(userId) {
    const sql =
      'DELETE FROM `achievement_stage_records` WHERE achievement_id IN (SELECT id FROM `achievements` WHERE user_id = ?)'
    const [result] = await this._execute(sql, [Number(userId)], 'deleteByUser')
    return result.affectedRows
  }
}

module.exports = new AchievementStageRecordRepository()
