/**
 * 任务进展仓库（Repository Layer）—— 对应 `task_progress` 表
 *
 * 每次提交一条进展记录；写入字段统一走 pickWrite 白名单。导出单例。
 */
const BaseRepository = require('./BaseRepository')

const SAFE_COLUMNS = [
  'id',
  'task_id',
  'user_id',
  'content',
  'progress_percent',
  'attachment',
  'created_at',
  'updated_at'
]

const WRITE_FIELDS = [
  'task_id',
  'user_id',
  'content',
  'progress_percent',
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
    if (typeof v === 'string' && v.trim() === '') continue
    out[k] = v
  }
  return out
}

class TaskProgressRepository extends BaseRepository {
  constructor() {
    super('task_progress')
  }

  async create(data) {
    return super.create(pickWrite(data))
  }

  // 按任务列出全部进展记录（时间正序）
  async listByTask(taskId) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`task_progress\` WHERE task_id = ? AND is_deleted = 0 ORDER BY id ASC`
    const [rows] = await this._execute(sql, [taskId], 'listByTask')
    return rows
  }
}

module.exports = new TaskProgressRepository()
