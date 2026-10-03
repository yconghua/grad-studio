/**
 * 周报配置仓库（Repository Layer）—— report_template / report_holiday / report_remind_log
 *
 * 三张轻量表共用一个仓储：
 *   - 模板：系统内置（group_id NULL）+ 组模板（组内仅维护一条，覆盖默认）；学生新建时按组选用；
 *   - 免交周：组管设置，该周不计入应提交分母；
 *   - 提醒日志：定时扫描去重（当天/当周每类只提醒一次）。
 */
const BaseRepository = require('./BaseRepository')

class ReportConfigRepository extends BaseRepository {
  constructor() {
    super('report_template')
  }

  // ===== 模板 =====
  // 模板列表：系统内置（group_id IS NULL）+ 本组模板
  async listTemplates(groupId) {
    const sql =
      `SELECT * FROM \`report_template\` WHERE group_id IS NULL OR group_id = ? ORDER BY group_id ASC, id ASC`
    const [rows] = await this._execute(sql, [groupId == null ? -1 : Number(groupId)], 'listTemplates')
    return rows
  }

  // 默认模板：组模板优先，否则系统内置
  async getDefaultTemplate(groupId) {
    const sql =
      `SELECT * FROM \`report_template\` WHERE (group_id = ? OR group_id IS NULL) AND is_default = 1 ORDER BY group_id DESC, id ASC LIMIT 1`
    const [rows] = await this._execute(sql, [groupId == null ? -1 : Number(groupId)], 'getDefaultTemplate')
    return rows[0] || null
  }

  // 创建模板（组模板由组管维护）
  async createTemplate({ groupId, name, content, createdBy }) {
    const sql =
      'INSERT INTO `report_template` (`group_id`, `name`, `content`, `is_default`, `created_by`) VALUES (?, ?, ?, 1, ?)'
    const [result] = await this._execute(
      sql,
      [groupId == null ? null : Number(groupId), name, content, createdBy == null ? null : Number(createdBy)],
      'createTemplate'
    )
    return result.insertId
  }

  // 更新模板（name/content）
  async updateTemplate(id, { name, content }) {
    const sql = 'UPDATE `report_template` SET name = ?, content = ? WHERE id = ?'
    const [result] = await this._execute(sql, [name, content, Number(id)], 'updateTemplate')
    return result.affectedRows
  }

  // 删除模板
  async deleteTemplate(id) {
    const sql = 'DELETE FROM `report_template` WHERE id = ?'
    const [result] = await this._execute(sql, [Number(id)], 'deleteTemplate')
    return result.affectedRows
  }

  // ===== 免交周 =====
  async listHolidays(groupId) {
    const sql = 'SELECT * FROM `report_holiday` WHERE group_id = ? ORDER BY week_key DESC'
    const [rows] = await this._execute(sql, [Number(groupId)], 'listHolidays')
    return rows
  }

  async isHoliday(groupId, weekKey) {
    const sql = 'SELECT id FROM `report_holiday` WHERE group_id = ? AND week_key = ?'
    const [rows] = await this._execute(sql, [Number(groupId), weekKey], 'isHoliday')
    return rows.length > 0
  }

  // 新增或更新免交周（同组同周唯一）
  async upsertHoliday({ groupId, weekKey, reason, createdBy }) {
    const sql =
      `INSERT INTO \`report_holiday\` (\`group_id\`, \`week_key\`, \`reason\`, \`created_by\`) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE reason = ?, created_by = ?`
    const [result] = await this._execute(
      sql,
      [
        Number(groupId), weekKey, reason, createdBy == null ? null : Number(createdBy),
        reason, createdBy == null ? null : Number(createdBy)
      ],
      'upsertHoliday'
    )
    return result.affectedRows > 0
  }

  async removeHoliday(groupId, weekKey) {
    const sql = 'DELETE FROM `report_holiday` WHERE group_id = ? AND week_key = ?'
    const [result] = await this._execute(sql, [Number(groupId), weekKey], 'removeHoliday')
    return result.affectedRows
  }

  // ===== 提醒日志（当天去重） =====
  // 返回是否新插入（true=本次应发通知，false=当天已提醒过）
  async insertRemindLog({ weekKey, userId, type, date }) {
    const sql =
      'INSERT IGNORE INTO `report_remind_log` (`week_key`, `user_id`, `remind_type`, `remind_date`) VALUES (?, ?, ?, ?)'
    const [result] = await this._execute(sql, [weekKey, Number(userId), type, date], 'insertRemindLog')
    return result.affectedRows > 0
  }

  // 查询某类型当天的提醒记录数（调度器判断是否需要提醒）
  async countRemindLogs({ weekKey, type, date }) {
    const sql =
      'SELECT COUNT(*) AS total FROM `report_remind_log` WHERE week_key = ? AND remind_type = ? AND remind_date = ?'
    const [rows] = await this._execute(sql, [weekKey, type, date], 'countRemindLogs')
    return Number(rows[0] && rows[0].total) || 0
  }
}

module.exports = new ReportConfigRepository()
