/**
 * 组会仓库（Repository Layer）—— 对应 `meeting` 表
 *
 * 组会按 group_id 隔离，列表按开始时间倒序。
 * 写入字段统一走 pickWrite 白名单。导出单例。
 */
const BaseRepository = require('./BaseRepository')

const SAFE_COLUMNS = [
  'id',
  'group_id',
  'title',
  'meeting_type',
  'location',
  'start_time',
  'end_time',
  'host_id',
  'agenda',
  'status',
  'created_by',
  'created_at',
  'updated_at'
]

const WRITE_FIELDS = [
  'group_id',
  'title',
  'meeting_type',
  'location',
  'start_time',
  'end_time',
  'host_id',
  'agenda',
  'status',
  'created_by'
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

class MeetingRepository extends BaseRepository {
  constructor() {
    super('meeting')
  }

  async create(data) {
    return super.create(pickWrite(data))
  }

  async update(id, data) {
    return super.update(id, pickWrite(data))
  }

  // 按课题组列出组会，开始时间近的在前
  async listByGroup(groupId) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`meeting\` WHERE group_id = ? AND is_deleted = 0 ORDER BY start_time DESC, id DESC`
    const [rows] = await this._execute(sql, [groupId], 'listByGroup')
    return rows
  }
}

module.exports = new MeetingRepository()
