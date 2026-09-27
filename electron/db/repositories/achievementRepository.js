/**
 * 成果仓库（Repository Layer）—— 对应 `achievement` 表
 *
 * 继承 BaseRepository 获得通用 CRUD；学生申报 / 教师审核的状态流转在此表达。
 * 所有自定义查询均自带 AND is_deleted = 0。
 *
 * 状态机：pending → approved / rejected
 *   - 学生仅在 pending 状态可编辑；
 *   - 审核（review）由 group_admin / mentor 执行，写 audit_by / audit_comment / audit_at。
 *
 * 导出单例：全局共用同一个仓库实例。
 */
const BaseRepository = require('./BaseRepository')
const { buildWhereClause, buildUpdateSet } = require('./queryHelpers')

const SAFE_COLUMNS = [
  'id',
  'user_id',
  'group_id',
  'ach_type',
  'title',
  'description',
  'status',
  'file_path',
  'submit_date',
  'audit_by',
  'audit_comment',
  'audit_at',
  'remark',
  'created_at',
  'updated_at'
]

// 学生可写字段白名单（status / audit_* 由审核接口显式写入）
const WRITE_FIELDS = [
  'ach_type',
  'title',
  'description',
  'file_path',
  'submit_date',
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
    out[k] = v
  }
  return out
}

class AchievementRepository extends BaseRepository {
  constructor() {
    super('achievement')
  }

  /**
   * 列出某学生全部成果
   * @param {number} userId
   * @returns {Object[]}
   */
  async listByUser(userId) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`achievement\` WHERE user_id = ? AND is_deleted = 0 ORDER BY submit_date DESC, id DESC`
    const [rows] = await this._execute(sql, [userId], 'listByUser')
    return rows
  }

  /**
   * 列出全部成果（供 group_admin / mentor 审核侧），可按 status / ach_type 过滤
   * @param {{ status?: string, achType?: string }} filters
   * @returns {Object[]}
   */
  async listAll(filters = {}) {
    const conditions = [{ field: 'is_deleted', op: '=', value: 0 }]
    if (filters.status) {
      conditions.push({ field: 'status', op: '=', value: filters.status })
    }
    if (filters.achType) {
      conditions.push({ field: 'ach_type', op: '=', value: filters.achType })
    }
    if (filters.groupId) {
      conditions.push({ field: 'group_id', op: '=', value: Number(filters.groupId) })
    }
    const { clause, values } = buildWhereClause(conditions)
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`achievement\` ${clause} ORDER BY created_at DESC, id DESC`
    const [rows] = await this._execute(sql, values, 'listAll')
    return rows
  }

  /**
   * 学生申报成果（初始状态 pending）
   * @param {number} userId
   * @param {Object} data
   * @returns {number} 新记录 id
   */
  async createForUser(userId, data) {
    const payload = pickWrite(data)
    payload.user_id = userId
    payload.status = 'pending'
    // 成果所属课题组由 service 按申报人所属组自动落（0 表示未分组）
    if (data && data.group_id) payload.group_id = Number(data.group_id)
    return this.create(payload)
  }

  /**
   * 更新本人待审核成果（仅 status=pending 时可改）
   * @param {number} id
   * @param {number} userId
   * @param {Object} data
   * @returns {number} 受影响行数
   */
  async updateOwnedPending(id, userId, data) {
    const clean = pickWrite(data)
    const { clause, values } = buildUpdateSet(clean)
    if (!clause) return 0
    const sql = `UPDATE \`achievement\` SET ${clause} WHERE id = ? AND user_id = ? AND status = 'pending' AND is_deleted = 0`
    const [result] = await this._execute(sql, [...values, id, userId], 'updateOwnedPending')
    return result.affectedRows
  }

  /**
   * 教师审核成果：写 status / audit_comment / audit_by / audit_at
   * @param {number} id
   * @param {{ status: string, auditComment?: string, auditBy: number }} param
   * @returns {number} 受影响行数
   */
  async review(id, { status, auditComment, auditBy }) {
    const sql = `UPDATE \`achievement\` SET status = ?, audit_comment = ?, audit_by = ?, audit_at = NOW() WHERE id = ? AND is_deleted = 0`
    const [result] = await this._execute(sql, [status, auditComment || '', auditBy, id], 'review')
    return result.affectedRows
  }
}

module.exports = new AchievementRepository()
