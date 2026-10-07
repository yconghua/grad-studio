/**
 * 学业阶段模板仓库（Repository Layer）—— 对应 `academic_stage_templates` 表
 *
 * 继承 BaseRepository 获得通用 findById / create / update / delete；
 * 模板以 group_id 区分：0 = 全局默认（超管维护），>0 = 某课题组自定义（组管维护）。
 * 「删除节点」在服务层用 update enabled=0 停用（保留学生已填历史），软删仅超管彻底移除用。
 */
const BaseRepository = require('./BaseRepository')

class AcademicTemplateRepository extends BaseRepository {
  constructor() {
    super('academic_stage_templates')
  }

  // 某范围（组或全局）指定培养类型的启用模板，按 sort_order 升序
  async listEnabled(groupId, stageType) {
    const sql =
      `SELECT * FROM \`academic_stage_templates\`
       WHERE group_id = ? AND stage_type = ? AND enabled = 1 AND is_deleted = 0
       ORDER BY \`sort_order\` ASC, \`id\` ASC`
    const [rows] = await this._execute(sql, [Number(groupId), String(stageType)], 'listEnabled')
    return rows
  }

  // 某范围指定培养类型的全部模板（含停用，供管理界面展示）
  async listAll(groupId, stageType) {
    const sql =
      `SELECT * FROM \`academic_stage_templates\`
       WHERE group_id = ? AND stage_type = ? AND is_deleted = 0
       ORDER BY \`sort_order\` ASC, \`id\` ASC`
    const [rows] = await this._execute(sql, [Number(groupId), String(stageType)], 'listAll')
    return rows
  }

  // 按组 + 类型 + 节点标识查找（唯一约束 uk_group_type_node）
  async findByGroupTypeNode(groupId, stageType, nodeKey) {
    const sql =
      `SELECT * FROM \`academic_stage_templates\`
       WHERE group_id = ? AND stage_type = ? AND node_key = ? AND is_deleted = 0`
    const [rows] = await this._execute(sql, [Number(groupId), String(stageType), String(nodeKey)], 'findByGroupTypeNode')
    return rows[0] || null
  }
}

module.exports = new AcademicTemplateRepository()
