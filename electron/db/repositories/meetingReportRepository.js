/**
 * 组会汇报仓库（Repository Layer）—— 对应 `meeting_report` 表
 *
 * 汇报本身不存 group_id，组内管理员按组查看时通过 JOIN meeting 关联 group_id。
 * 写入字段统一走 pickWrite 白名单。导出单例。
 */
const BaseRepository = require('./BaseRepository')

const SAFE_COLUMNS = [
  'id',
  'meeting_id',
  'student_id',
  'topic',
  'content',
  'file_path',
  'status',
  'review_comment',
  'reviewed_by',
  'reviewed_at',
  'created_at',
  'updated_at'
]

const WRITE_FIELDS = [
  'meeting_id',
  'student_id',
  'topic',
  'content',
  'file_path',
  'status',
  'review_comment',
  'reviewed_by',
  'reviewed_at'
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

class MeetingReportRepository extends BaseRepository {
  constructor() {
    super('meeting_report')
  }

  async create(data) {
    return super.create(pickWrite(data))
  }

  async update(id, data) {
    return super.update(id, pickWrite(data))
  }

  // 组内管理视角：按 group_id 经 meeting 关联列出全部汇报
  async listByGroup(groupId) {
    const sql = `SELECT r.* FROM \`meeting_report\` r INNER JOIN \`meeting\` m ON r.meeting_id = m.id WHERE m.group_id = ? AND r.is_deleted = 0 AND m.is_deleted = 0 ORDER BY r.id DESC`
    const [rows] = await this._execute(sql, [groupId], 'listByGroup')
    return rows
  }

  // 学生视角：仅列出本人提交的汇报
  async listByStudent(studentId) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`meeting_report\` WHERE student_id = ? AND is_deleted = 0 ORDER BY id DESC`
    const [rows] = await this._execute(sql, [studentId], 'listByStudent')
    return rows
  }
}

module.exports = new MeetingReportRepository()
