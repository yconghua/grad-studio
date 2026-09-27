/**
 * 任务仓库（Repository Layer）—— 对应 `task` 表
 *
 * 任务按 group_id 隔离；学生视角按 assignee_id 过滤。
 * 写入字段统一走 pickWrite 白名单。导出单例。
 */
const BaseRepository = require('./BaseRepository')

const SAFE_COLUMNS = [
  'id',
  'group_id',
  'subject_id',
  'title',
  'description',
  'assigner_id',
  'assignee_id',
  'priority',
  'status',
  'progress_percent',
  'deadline',
  'completed_at',
  'remark',
  'created_at',
  'updated_at'
]

const WRITE_FIELDS = [
  'group_id',
  'subject_id',
  'title',
  'description',
  'assigner_id',
  'assignee_id',
  'priority',
  'status',
  'progress_percent',
  'deadline',
  'completed_at',
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

class TaskRepository extends BaseRepository {
  constructor() {
    super('task')
  }

  async create(data) {
    return super.create(pickWrite(data))
  }

  async update(id, data) {
    return super.update(id, pickWrite(data))
  }

  // 组内管理视角：按 group_id 列出全部任务
  async listByGroup(groupId) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`task\` WHERE group_id = ? AND is_deleted = 0 ORDER BY id DESC`
    const [rows] = await this._execute(sql, [groupId], 'listByGroup')
    return rows
  }

  // 学生视角：列出指派给本人的任务
  async listByAssignee(assigneeId) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`task\` WHERE assignee_id = ? AND is_deleted = 0 ORDER BY id DESC`
    const [rows] = await this._execute(sql, [assigneeId], 'listByAssignee')
    return rows
  }
}

module.exports = new TaskRepository()
