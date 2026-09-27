/**
 * 论文仓库（Repository Layer）—— 对应 `paper` 表
 *
 * 作为 achievement 的子模块，仅学生本人维护自己的论文记录。
 * 继承 BaseRepository；所有自定义查询均自带 AND is_deleted = 0。
 *
 * 导出单例：全局共用同一个仓库实例。
 */
const BaseRepository = require('./BaseRepository')
const { buildUpdateSet } = require('./queryHelpers')

const SAFE_COLUMNS = [
  'id',
  'achievement_id',
  'user_id',
  'title',
  'authors',
  'journal',
  'conference',
  'level_desc',
  'status',
  'is_first_author',
  'submit_date',
  'accept_date',
  'publish_date',
  'doi',
  'created_at',
  'updated_at'
]

// 学生可写字段白名单（user_id 由服务层注入）
const WRITE_FIELDS = [
  'achievement_id',
  'title',
  'authors',
  'journal',
  'conference',
  'level_desc',
  'status',
  'is_first_author',
  'submit_date',
  'accept_date',
  'publish_date',
  'doi'
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

class PaperRepository extends BaseRepository {
  constructor() {
    super('paper')
  }

  /**
   * 列出某学生全部论文
   * @param {number} userId
   * @returns {Object[]}
   */
  async listByUser(userId) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`paper\` WHERE user_id = ? AND is_deleted = 0 ORDER BY created_at DESC, id DESC`
    const [rows] = await this._execute(sql, [userId], 'listByUser')
    return rows
  }

  /**
   * 为指定学生新增论文
   * @param {number} userId
   * @param {Object} data
   * @returns {number} 新记录 id
   */
  async createForUser(userId, data) {
    const payload = pickWrite(data)
    payload.user_id = userId
    return this.create(payload)
  }

  /**
   * 更新本人论文（WHERE 同时限定 user_id，防止越权）
   * @param {number} id
   * @param {number} userId
   * @param {Object} data
   * @returns {number} 受影响行数
   */
  async updateOwned(id, userId, data) {
    const clean = pickWrite(data)
    const { clause, values } = buildUpdateSet(clean)
    if (!clause) return 0
    const sql = `UPDATE \`paper\` SET ${clause} WHERE id = ? AND user_id = ? AND is_deleted = 0`
    const [result] = await this._execute(sql, [...values, id, userId], 'updateOwned')
    return result.affectedRows
  }
}

module.exports = new PaperRepository()
