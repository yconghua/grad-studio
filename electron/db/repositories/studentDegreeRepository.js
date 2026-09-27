/**
 * 学生学位记录仓库（Repository Layer）—— 对应 `student_degree` 表
 *
 * 每个学生在每个学位节点上一条记录（唯一索引 student_id + node_id）。
 * 写入字段统一走 pickWrite 白名单；upsert 以 (student_id, node_id) 为键。
 * 导出单例。
 */
const BaseRepository = require('./BaseRepository')

const SAFE_COLUMNS = [
  'id',
  'student_id',
  'node_id',
  'group_id',
  'status',
  'complete_date',
  'score',
  'remark',
  'updated_by',
  'created_at',
  'updated_at'
]

const WRITE_FIELDS = [
  'student_id',
  'node_id',
  'group_id',
  'status',
  'complete_date',
  'score',
  'remark',
  'updated_by'
]

function cols(columns) {
  return columns.map((c) => `\`${c}\``).join(', ')
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

class StudentDegreeRepository extends BaseRepository {
  constructor() {
    super('student_degree')
  }

  async create(data) {
    return super.create(pickWrite(data))
  }

  async update(id, data) {
    return super.update(id, pickWrite(data))
  }

  // 按课题组列出学生学位记录，可按 student_id 过滤
  async listByGroup(groupId, studentId) {
    let sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`student_degree\` WHERE group_id = ? AND is_deleted = 0`
    const params = [groupId]
    if (studentId) {
      sql += ` AND student_id = ?`
      params.push(studentId)
    }
    sql += ` ORDER BY student_id ASC, node_id ASC`
    const [rows] = await this._execute(sql, params, 'listByGroup')
    return rows
  }

  // 按一组学生 id 列出学位记录（导师「名下学生」视角用）
  async listByStudents(groupId, studentIds) {
    if (!Array.isArray(studentIds) || !studentIds.length) return []
    const marks = studentIds.map(() => '?').join(', ')
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`student_degree\`
      WHERE group_id = ? AND student_id IN (${marks}) AND is_deleted = 0
      ORDER BY student_id ASC, node_id ASC`
    const [rows] = await this._execute(sql, [groupId, ...studentIds], 'listByStudents')
    return rows
  }

  // 按 学生 + 节点 定位唯一记录（唯一索引 uk_student_node）
  async findByStudentNode(studentId, nodeId) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`student_degree\` WHERE student_id = ? AND node_id = ? AND is_deleted = 0`
    const [rows] = await this._execute(sql, [studentId, nodeId], 'findByStudentNode')
    return rows[0] || null
  }

  // 新增或更新记录：(student_id, node_id) 已存在则更新，否则创建
  async upsert(data) {
    const existing = await this.findByStudentNode(data.student_id, data.node_id)
    const write = pickWrite(data)
    if (existing) {
      await this.update(existing.id, write)
      return existing.id
    }
    return this.create(write)
  }
}

module.exports = new StudentDegreeRepository()
