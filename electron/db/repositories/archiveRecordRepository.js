/**
 * 档案记录仓库（Repository Layer）—— 对应 `archive_record` 表
 *
 * 学生个人档案的统一归档表（日志 / 周报 / 成果 / 任务 / 会议 / 自定义）。
 * 继承 BaseRepository；所有自定义查询均自带 AND is_deleted = 0。
 *
 * 导出单例：全局共用同一个仓库实例。
 */
const BaseRepository = require('./BaseRepository')
const { buildUpdateSet } = require('./queryHelpers')

const SAFE_COLUMNS = [
  'id',
  'user_id',
  'record_type',
  'title',
  'content',
  'record_date',
  'attachment',
  'created_at',
  'updated_at'
]

// 学生可写字段白名单（user_id 由服务层注入）
const WRITE_FIELDS = ['record_type', 'title', 'content', 'record_date', 'attachment']

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

class ArchiveRecordRepository extends BaseRepository {
  constructor() {
    super('archive_record')
  }

  /**
   * 列出某学生全部档案记录，按记录日期倒序
   * @param {number} userId
   * @returns {Object[]}
   */
  async listByUser(userId) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`archive_record\` WHERE user_id = ? AND is_deleted = 0 ORDER BY record_date DESC, id DESC`
    const [rows] = await this._execute(sql, [userId], 'listByUser')
    return rows
  }

  /**
   * 为指定学生新增档案记录
   * @param {number} userId
   * @param {Object} data
   * @returns {number} 新记录 id
   */
  async createForUser(userId, data) {
    const payload = pickWrite(data)
    payload.user_id = userId
    return this.create(payload)
  }
}

module.exports = new ArchiveRecordRepository()
