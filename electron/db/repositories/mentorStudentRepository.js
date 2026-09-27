/**
 * 导师-学生关系仓库（Repository Layer）—— 对应 `mentor_student` 表
 *
 * 一条记录表示「某导师指导某学生」。列表联 user / user_profile 取学生账号与姓名。
 * 唯一索引 (mentor_id, student_id)。
 * 导出单例。
 */
const BaseRepository = require('./BaseRepository')

const SAFE_COLUMNS = [
  'id', 'group_id', 'mentor_id', 'student_id', 'status', 'remark'
]

const WRITE_FIELDS = [
  'group_id', 'mentor_id', 'student_id', 'status', 'remark'
]

function cols(columns) {
  return columns.map((c) => `\`ms\`.\`${c}\``).join(', ')
}

function pickWrite(data) {
  const out = {}
  for (const k of WRITE_FIELDS) {
    const v = data ? data[k] : undefined
    if (v === undefined) continue
    if (typeof v === 'string' && v.trim() === '') continue
    out[k] = v
  }
  return out
}

class MentorStudentRepository extends BaseRepository {
  constructor() {
    super('mentor_student')
  }

  // 联表取学生账号 / 姓名的公共字段
  _joinSelect() {
    return `${cols(SAFE_COLUMNS)},
      \`su\`.\`username\` AS \`student_username\`,
      \`sp\`.\`real_name\` AS \`student_real_name\`,
      \`mu\`.\`username\` AS \`mentor_username\``
  }

  _joinFrom() {
    return `FROM \`mentor_student\` AS \`ms\`
      LEFT JOIN \`user\` AS \`su\` ON \`su\`.\`id\` = \`ms\`.\`student_id\` AND \`su\`.\`is_deleted\` = 0
      LEFT JOIN \`user_profile\` AS \`sp\` ON \`sp\`.\`user_id\` = \`ms\`.\`student_id\` AND \`sp\`.\`is_deleted\` = 0
      LEFT JOIN \`user\` AS \`mu\` ON \`mu\`.\`id\` = \`ms\`.\`mentor_id\` AND \`mu\`.\`is_deleted\` = 0`
  }

  /**
   * 按导师列出学生（导师「我的学生」）
   * @param {number} mentorId
   * @param {string?} status 默认 active
   * @returns {Object[]}
   */
  async listByMentor(mentorId, status = 'active') {
    const params = [mentorId]
    let statusSql = ''
    if (status) {
      statusSql = ' AND `ms`.`status` = ?'
      params.push(status)
    }
    const sql = `SELECT ${this._joinSelect()} ${this._joinFrom()}
      WHERE \`ms\`.\`mentor_id\` = ? AND \`ms\`.\`is_deleted\` = 0${statusSql}
      ORDER BY \`ms\`.\`id\` DESC`
    const [rows] = await this._execute(sql, params, 'listByMentor')
    return rows
  }

  /**
   * 按课题组列出全部师生关系（group_admin 视角）
   * @param {number} groupId
   * @param {string?} status
   * @returns {Object[]}
   */
  async listByGroup(groupId, status) {
    const params = [groupId]
    let statusSql = ''
    if (status) {
      statusSql = ' AND `ms`.`status` = ?'
      params.push(status)
    }
    const sql = `SELECT ${this._joinSelect()} ${this._joinFrom()}
      WHERE \`ms\`.\`group_id\` = ? AND \`ms\`.\`is_deleted\` = 0${statusSql}
      ORDER BY \`ms\`.\`id\` DESC`
    const [rows] = await this._execute(sql, params, 'listByGroup')
    return rows
  }

  /**
   * 按 (mentor_id, student_id) 查重（唯一索引）
   * @param {number} mentorId
   * @param {number} studentId
   * @returns {Object|null}
   */
  async findByMentorAndStudent(mentorId, studentId) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`mentor_student\` AS \`ms\`
      WHERE \`ms\`.\`mentor_id\` = ? AND \`ms\`.\`student_id\` = ? AND \`ms\`.\`is_deleted\` = 0`
    const [rows] = await this._execute(sql, [mentorId, studentId], 'findByMentorAndStudent')
    return rows[0] || null
  }

  // 白名单提取可写入字段
  pick(data) {
    return pickWrite(data)
  }
}

module.exports = new MentorStudentRepository()
