/**
 * 科研日志仓库（Repository Layer）—— 对应 `research_log` 表
 *
 * 继承 BaseRepository 获得通用 CRUD；学生本人的日志列表 / 写入 / 归属校验在此表达。
 * 所有自定义查询均自带 AND is_deleted = 0。
 *
 * 安全约定：
 *   - 写入字段统一走 WRITE_FIELDS 白名单，student_id 由服务层强制注入，前端无法伪造他人 id；
 *   - 更新 / 删除前在 WHERE 中同时限定 student_id，杜绝越权改写他人日志。
 *
 * 导出单例：全局共用同一个仓库实例。
 */
const BaseRepository = require('./BaseRepository')
const { buildUpdateSet } = require('./queryHelpers')

// 安全返回列（业务全字段，不含 is_deleted）
const SAFE_COLUMNS = [
  'id',
  'student_id',
  'log_date',
  'content',
  'tags',
  'attachment',
  'created_at',
  'updated_at'
]

// 学生可写字段白名单（student_id 由服务层注入，不进白名单）
const WRITE_FIELDS = ['log_date', 'content', 'tags', 'attachment']

function cols(columns) {
  return columns.map((c) => `\`${c}\``).join(', ')
}

// 白名单过滤：undefined 跳过，空字符串保留（由 BaseRepository 统一转 NULL）
function pickWrite(data) {
  const out = {}
  for (const k of WRITE_FIELDS) {
    const v = data ? data[k] : undefined
    if (v === undefined) continue
    out[k] = v
  }
  return out
}

class ResearchLogRepository extends BaseRepository {
  constructor() {
    super('research_log')
  }

  /**
   * 列出某学生全部日志，按日期倒序
   * @param {number} studentId
   * @returns {Object[]}
   */
  async listByStudent(studentId) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`research_log\` WHERE student_id = ? AND is_deleted = 0 ORDER BY log_date DESC, id DESC`
    const [rows] = await this._execute(sql, [studentId], 'listByStudent')
    return rows
  }

  /**
   * 为指定学生新增日志
   * @param {number} studentId
   * @param {Object} data 学生提交的字段（白名单过滤后写入）
   * @returns {number} 新记录 id
   */
  async createForStudent(studentId, data) {
    const payload = pickWrite(data)
    payload.student_id = studentId
    return this.create(payload)
  }

  /**
   * 更新本人日志（WHERE 同时限定 student_id，防止越权）
   * @param {number} id
   * @param {number} studentId
   * @param {Object} data 待更新字段
   * @returns {number} 受影响行数
   */
  async updateOwned(id, studentId, data) {
    const clean = pickWrite(data)
    const { clause, values } = buildUpdateSet(clean)
    if (!clause) return 0
    const sql = `UPDATE \`research_log\` SET ${clause} WHERE id = ? AND student_id = ? AND is_deleted = 0`
    const [result] = await this._execute(sql, [...values, id, studentId], 'updateOwned')
    return result.affectedRows
  }
}

module.exports = new ResearchLogRepository()
