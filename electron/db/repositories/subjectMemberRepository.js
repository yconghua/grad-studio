/**
 * 课题成员仓库（Repository Layer）—— 对应 `subject_member` 表
 *
 * 同一用户在同一课题只保留一条记录（唯一索引 subject_id + user_id）。
 * 写入字段统一走 pickWrite 白名单。导出单例。
 */
const BaseRepository = require('./BaseRepository')

const SAFE_COLUMNS = [
  'id',
  'subject_id',
  'user_id',
  'role_in_subject',
  'join_date',
  'quit_date',
  'status',
  'created_at',
  'updated_at'
]

const WRITE_FIELDS = [
  'subject_id',
  'user_id',
  'role_in_subject',
  'join_date',
  'quit_date',
  'status'
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

class SubjectMemberRepository extends BaseRepository {
  constructor() {
    super('subject_member')
  }

  async create(data) {
    return super.create(pickWrite(data))
  }

  async update(id, data) {
    return super.update(id, pickWrite(data))
  }

  // 按课题列出成员
  async listBySubject(subjectId) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`subject_member\` WHERE subject_id = ? AND is_deleted = 0 ORDER BY id ASC`
    const [rows] = await this._execute(sql, [subjectId], 'listBySubject')
    return rows
  }

  // 按 课题 + 用户 定位成员记录（唯一索引 uk_subject_user）
  async findBySubjectUser(subjectId, userId) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`subject_member\` WHERE subject_id = ? AND user_id = ? AND is_deleted = 0`
    const [rows] = await this._execute(sql, [subjectId, userId], 'findBySubjectUser')
    return rows[0] || null
  }
}

module.exports = new SubjectMemberRepository()
