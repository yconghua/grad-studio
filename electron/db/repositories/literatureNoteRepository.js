/**
 * 文献笔记仓库（Repository Layer）—— 对应 `literature_note` 表
 *
 * 继承 BaseRepository；所有自定义查询均自带 AND is_deleted = 0。
 * 笔记行内冗余 user_id，更新 / 查询均限定本人，杜绝越权读取他人笔记。
 *
 * 导出单例：全局共用同一个仓库实例。
 */
const BaseRepository = require('./BaseRepository')
const { buildUpdateSet } = require('./queryHelpers')

const SAFE_COLUMNS = [
  'id',
  'literature_id',
  'user_id',
  'content',
  'created_at',
  'updated_at'
]

// 学生可写字段白名单（user_id 由服务层注入）
const WRITE_FIELDS = ['literature_id', 'content']

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

class LiteratureNoteRepository extends BaseRepository {
  constructor() {
    super('literature_note')
  }

  /**
   * 列出某篇文献下本人的笔记
   * @param {number} literatureId
   * @param {number} userId
   * @returns {Object[]}
   */
  async listByLiterature(literatureId, userId) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`literature_note\` WHERE literature_id = ? AND user_id = ? AND is_deleted = 0 ORDER BY created_at ASC, id ASC`
    const [rows] = await this._execute(sql, [literatureId, userId], 'listByLiterature')
    return rows
  }

  /**
   * 为指定学生新增笔记
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
   * 更新本人笔记（WHERE 同时限定 user_id，防止越权）
   * @param {number} id
   * @param {number} userId
   * @param {Object} data
   * @returns {number} 受影响行数
   */
  async updateOwned(id, userId, data) {
    const clean = pickWrite(data)
    const { clause, values } = buildUpdateSet(clean)
    if (!clause) return 0
    const sql = `UPDATE \`literature_note\` SET ${clause} WHERE id = ? AND user_id = ? AND is_deleted = 0`
    const [result] = await this._execute(sql, [...values, id, userId], 'updateOwned')
    return result.affectedRows
  }
}

module.exports = new LiteratureNoteRepository()
