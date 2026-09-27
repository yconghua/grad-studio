/**
 * 文献仓库（Repository Layer）—— 对应 `literature` 表
 *
 * 继承 BaseRepository；所有自定义查询均自带 AND is_deleted = 0。
 * 支持按阅读状态 / 来源类型 / 标题关键字过滤。
 *
 * 导出单例：全局共用同一个仓库实例。
 */
const BaseRepository = require('./BaseRepository')
const { buildWhereClause, buildUpdateSet } = require('./queryHelpers')

const SAFE_COLUMNS = [
  'id',
  'user_id',
  'title',
  'authors',
  'source',
  'source_type',
  'year',
  'doi',
  'url',
  'file_path',
  'tags',
  'abstract',
  'read_status',
  'rating',
  'created_at',
  'updated_at'
]

// 学生可写字段白名单（user_id 由服务层注入）
const WRITE_FIELDS = [
  'title',
  'authors',
  'source',
  'source_type',
  'year',
  'doi',
  'url',
  'file_path',
  'tags',
  'abstract',
  'read_status',
  'rating'
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

class LiteratureRepository extends BaseRepository {
  constructor() {
    super('literature')
  }

  /**
   * 列出某学生文献，支持按 read_status / source_type / 标题关键字过滤
   * @param {number} userId
   * @param {{ readStatus?: string, sourceType?: string, keyword?: string }} filters
   * @returns {Object[]}
   */
  async listByUser(userId, filters = {}) {
    const conditions = [
      { field: 'is_deleted', op: '=', value: 0 },
      { field: 'user_id', op: '=', value: userId }
    ]
    if (filters.readStatus) {
      conditions.push({ field: 'read_status', op: '=', value: filters.readStatus })
    }
    if (filters.sourceType) {
      conditions.push({ field: 'source_type', op: '=', value: filters.sourceType })
    }
    if (filters.keyword) {
      conditions.push({ field: 'title', op: 'LIKE', value: `%${filters.keyword}%` })
    }
    const { clause, values } = buildWhereClause(conditions)
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`literature\` ${clause} ORDER BY created_at DESC, id DESC`
    const [rows] = await this._execute(sql, values, 'listByUser')
    return rows
  }

  /**
   * 为指定学生新增文献
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
   * 更新本人文献（WHERE 同时限定 user_id，防止越权）
   * @param {number} id
   * @param {number} userId
   * @param {Object} data
   * @returns {number} 受影响行数
   */
  async updateOwned(id, userId, data) {
    const clean = pickWrite(data)
    const { clause, values } = buildUpdateSet(clean)
    if (!clause) return 0
    const sql = `UPDATE \`literature\` SET ${clause} WHERE id = ? AND user_id = ? AND is_deleted = 0`
    const [result] = await this._execute(sql, [...values, id, userId], 'updateOwned')
    return result.affectedRows
  }
}

module.exports = new LiteratureRepository()
