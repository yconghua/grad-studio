/**
 * 课题仓库（Repository Layer）—— 对应 `subject` 表
 *
 * 课题按 group_id 隔离。写入字段统一走 pickWrite 白名单。导出单例。
 */
const BaseRepository = require('./BaseRepository')

const SAFE_COLUMNS = [
  'id',
  'group_id',
  'name',
  'code',
  'subject_type',
  'description',
  'leader_id',
  'status',
  'start_date',
  'end_date',
  'funding',
  'source',
  'remark',
  'created_at',
  'updated_at'
]

const WRITE_FIELDS = [
  'group_id',
  'name',
  'code',
  'subject_type',
  'description',
  'leader_id',
  'status',
  'start_date',
  'end_date',
  'funding',
  'source',
  'remark'
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

class SubjectRepository extends BaseRepository {
  constructor() {
    super('subject')
  }

  async create(data) {
    return super.create(pickWrite(data))
  }

  async update(id, data) {
    return super.update(id, pickWrite(data))
  }

  // 按课题组列出课题
  async listByGroup(groupId) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`subject\` WHERE group_id = ? AND is_deleted = 0 ORDER BY id DESC`
    const [rows] = await this._execute(sql, [groupId], 'listByGroup')
    return rows
  }
}

module.exports = new SubjectRepository()
