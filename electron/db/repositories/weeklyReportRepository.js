/**
 * 周报仓库（Repository Layer）—— 对应 `weekly_report` 表
 *
 * 继承 BaseRepository 获得通用 CRUD；学生提交 / 教师批阅的状态流转在此表达。
 * 所有自定义查询均自带 AND is_deleted = 0。
 *
 * 状态机：draft → submitted → reviewed
 *   - 学生仅在 draft 状态可编辑；
 *   - 提交（submit）将 draft 置为 submitted 并写 submitted_at；
 *   - 批阅（review）将 submitted 置为 reviewed 并写批阅人 / 评语 / 时间。
 *
 * 导出单例：全局共用同一个仓库实例。
 */
const BaseRepository = require('./BaseRepository')
const { buildWhereClause, buildUpdateSet } = require('./queryHelpers')

const SAFE_COLUMNS = [
  'id',
  'student_id',
  'week_start',
  'week_end',
  'work_content',
  'plan_content',
  'problem_content',
  'attachment',
  'status',
  'submitted_at',
  'reviewed_by',
  'review_comment',
  'reviewed_at',
  'created_at',
  'updated_at'
]

// 学生可写字段白名单（status / submitted_at / reviewed_* 由状态流转接口显式写入）
const WRITE_FIELDS = [
  'week_start',
  'week_end',
  'work_content',
  'plan_content',
  'problem_content',
  'attachment'
]

function cols(columns) {
  return columns.map((c) => `\`${c}\``).join(', ')
}

function pickWrite(data) {
  const out = {}
  for (const k of WRITE_FIELDS) {
    const v = data ? data[k] : undefined
    if (v === undefined) continue
    out[k] = v
  }
  return out
}

class WeeklyReportRepository extends BaseRepository {
  constructor() {
    super('weekly_report')
  }

  /**
   * 列出某学生周报，按周起始日倒序
   * @param {number} studentId
   * @returns {Object[]}
   */
  async listByStudent(studentId) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`weekly_report\` WHERE student_id = ? AND is_deleted = 0 ORDER BY week_start DESC, id DESC`
    const [rows] = await this._execute(sql, [studentId], 'listByStudent')
    return rows
  }

  /**
   * 列出全部学生周报（供 group_admin / mentor 批阅侧），可按 studentIds 集合或单个 student_id 过滤
   * 联 user / user_profile 返回学生账号姓名，联 reviewed_by 返回批阅人账号姓名。
   * 注意：本查询多表 JOIN，WHERE 条件必须带 `wr` 前缀，避免 is_deleted / student_id 列歧义。
   * @param {{ studentIds?: number[], studentId?: number }} filters
   * @returns {Object[]}
   */
  async listAll(filters = {}) {
    const conditions = ['`wr`.`is_deleted` = ?']
    const values = [0]
    if (filters.studentIds && filters.studentIds.length) {
      conditions.push(`\`wr\`.\`student_id\` IN (${filters.studentIds.map(() => '?').join(', ')})`)
      values.push(...filters.studentIds)
    } else if (filters.studentId) {
      conditions.push('`wr`.`student_id` = ?')
      values.push(filters.studentId)
    }
    const where = 'WHERE ' + conditions.join(' AND ')
    const selectCols = SAFE_COLUMNS.map((c) => `\`wr\`.\`${c}\``).join(', ')
    const sql = `SELECT ${selectCols},
        \`u\`.\`username\` AS \`student_username\`,
        \`up\`.\`real_name\` AS \`student_real_name\`,
        \`ru\`.\`username\` AS \`reviewer_username\`,
        \`rp\`.\`real_name\` AS \`reviewer_real_name\`
      FROM \`weekly_report\` AS \`wr\`
      LEFT JOIN \`user\` AS \`u\` ON \`u\`.\`id\` = \`wr\`.\`student_id\` AND \`u\`.\`is_deleted\` = 0
      LEFT JOIN \`user_profile\` AS \`up\` ON \`up\`.\`user_id\` = \`wr\`.\`student_id\` AND \`up\`.\`is_deleted\` = 0
      LEFT JOIN \`user\` AS \`ru\` ON \`ru\`.\`id\` = \`wr\`.\`reviewed_by\` AND \`ru\`.\`is_deleted\` = 0
      LEFT JOIN \`user_profile\` AS \`rp\` ON \`rp\`.\`user_id\` = \`wr\`.\`reviewed_by\` AND \`rp\`.\`is_deleted\` = 0
      ${where} ORDER BY \`wr\`.\`week_start\` DESC, \`wr\`.\`id\` DESC`
    const [rows] = await this._execute(sql, values, 'listAll')
    return rows
  }

  /**
   * 新增周报（初始状态 draft）
   * @param {number} studentId
   * @param {Object} data
   * @returns {number} 新记录 id
   */
  async createForStudent(studentId, data) {
    const payload = pickWrite(data)
    payload.student_id = studentId
    payload.status = 'draft'
    return this.create(payload)
  }

  /**
   * 更新本人草稿（仅 status=draft 时可改）
   * @param {number} id
   * @param {number} studentId
   * @param {Object} data
   * @returns {number} 受影响行数
   */
  async updateOwnedDraft(id, studentId, data) {
    const clean = pickWrite(data)
    const { clause, values } = buildUpdateSet(clean)
    if (!clause) return 0
    const sql = `UPDATE \`weekly_report\` SET ${clause} WHERE id = ? AND student_id = ? AND status = 'draft' AND is_deleted = 0`
    const [result] = await this._execute(sql, [...values, id, studentId], 'updateOwnedDraft')
    return result.affectedRows
  }

  /**
   * 学生提交周报：draft → submitted，写 submitted_at
   * @param {number} id
   * @param {number} studentId
   * @returns {number} 受影响行数
   */
  async submit(id, studentId) {
    const sql = `UPDATE \`weekly_report\` SET status = 'submitted', submitted_at = NOW() WHERE id = ? AND student_id = ? AND status = 'draft' AND is_deleted = 0`
    const [result] = await this._execute(sql, [id, studentId], 'submit')
    return result.affectedRows
  }

  /**
   * 教师批阅：submitted → reviewed，写批阅人 / 评语 / 时间
   * @param {number} id
   * @param {{ reviewedBy: number, reviewComment: string }} param
   * @returns {number} 受影响行数
   */
  async review(id, { reviewedBy, reviewComment }) {
    const sql = `UPDATE \`weekly_report\` SET status = 'reviewed', review_comment = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ? AND status = 'submitted' AND is_deleted = 0`
    const [result] = await this._execute(sql, [reviewComment || '', reviewedBy, id], 'review')
    return result.affectedRows
  }
}

module.exports = new WeeklyReportRepository()
