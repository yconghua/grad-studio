/**
 * 成果节点模板仓库（Repository Layer）—— 对应 `achievement_stage_templates` 表
 *
 * 与学业档案模板同模式：group_id=0 为超管全局模板，>0 为课题组快照；
 * 「删除节点」在服务层用 enabled=0 停用（保留学生已填历史）。
 */
const BaseRepository = require('./BaseRepository')

class AchievementStageTemplateRepository extends BaseRepository {
  constructor() {
    super('achievement_stage_templates')
  }

  // 某范围（组或全局）指定成果类型的启用节点，按 sort_order 升序
  async listEnabled(groupId, type) {
    const sql =
      `SELECT * FROM \`achievement_stage_templates\`
       WHERE group_id = ? AND type = ? AND enabled = 1 AND is_deleted = 0
       ORDER BY \`sort_order\` ASC, \`id\` ASC`
    const [rows] = await this._execute(sql, [Number(groupId), String(type)], 'listEnabled')
    return rows
  }

  // 某范围指定成果类型的全部模板（含停用，供管理界面展示）
  async listAll(groupId, type) {
    const sql =
      `SELECT * FROM \`achievement_stage_templates\`
       WHERE group_id = ? AND type = ? AND is_deleted = 0
       ORDER BY \`sort_order\` ASC, \`id\` ASC`
    const [rows] = await this._execute(sql, [Number(groupId), String(type)], 'listAll')
    return rows
  }

  // 按组 + 类型 + 节点标识查找（唯一约束 uk_group_type_node）
  async findByGroupTypeNode(groupId, type, nodeKey) {
    const sql =
      `SELECT * FROM \`achievement_stage_templates\`
       WHERE group_id = ? AND type = ? AND node_key = ? AND is_deleted = 0`
    const [rows] = await this._execute(sql, [Number(groupId), String(type), String(nodeKey)], 'findByGroupTypeNode')
    return rows[0] || null
  }
}

module.exports = new AchievementStageTemplateRepository()
