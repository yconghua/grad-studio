/**
 * 操作日志仓库（Repository Layer）—— 对应 `operation_log` 表
 *
 * 只追加不修改：仅提供 create 与带过滤 / 分页的 list；不做业务层 update / delete。
 * 注意本表没有 updated_at 列。
 * 导出单例：全局共用同一个仓库实例。
 */
const BaseRepository = require('./BaseRepository')
const { buildWhereClause } = require('./queryHelpers')

// 安全返回列（本表无 updated_at）
const SAFE_COLUMNS = [
  'id',
  'operator_id',
  'operator_name',
  'action',
  'target_type',
  'target_id',
  'detail',
  'created_at',
  'is_deleted'
]

// 写入字段白名单（不含 id / created_at / is_deleted）
const WRITE_FIELDS = [
  'operator_id',
  'operator_name',
  'action',
  'target_type',
  'target_id',
  'detail'
]

function cols(columns) {
  return columns.map((c) => `\`${c}\``).join(', ')
}

// 从输入对象中提取白名单内的可写字段：undefined 与空字符串跳过
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

class OperationLogRepository extends BaseRepository {
  constructor() {
    super('operation_log')
  }

  /**
   * 追加一条操作日志（白名单过滤后写入）
   * @param {Object} data
   * @returns {number} 新记录 id
   */
  async createLog(data) {
    return this.create(pickWrite(data))
  }

  /**
   * 分页列出操作日志，按 created_at DESC 排序
   * @param {{ operatorId?: number, action?: string, targetType?: string, startDate?: string, endDate?: string, page?: number, pageSize?: number }} filters
   * @returns {{ list: Object[], total: number, page: number, pageSize: number }}
   */
  async list(filters = {}) {
    const conditions = [{ field: 'is_deleted', op: '=', value: 0 }]
    if (filters.operatorId) {
      conditions.push({ field: 'operator_id', op: '=', value: filters.operatorId })
    }
    if (filters.action) {
      conditions.push({ field: 'action', op: '=', value: filters.action })
    }
    if (filters.targetType) {
      conditions.push({ field: 'target_type', op: '=', value: filters.targetType })
    }
    if (filters.startDate) {
      conditions.push({ field: 'created_at', op: '>=', value: filters.startDate })
    }
    if (filters.endDate) {
      conditions.push({ field: 'created_at', op: '<=', value: filters.endDate })
    }
    const { clause, values } = buildWhereClause(conditions)

    const pageNo = Math.max(1, parseInt(filters.page, 10) || 1)
    const size = Math.max(1, parseInt(filters.pageSize, 10) || 50)
    const offset = (pageNo - 1) * size

    const countSql = `SELECT COUNT(*) AS total FROM \`operation_log\` ${clause}`
    const [countRows] = await this._execute(countSql, values, 'listCount')
    const total = countRows[0].total

    // LIMIT/OFFSET 直接内插数字（size/offset 已 parseInt + Math.max 校验，纯整数）：
    // mysql2 execute() 对 LIMIT 绑定参数在部分 MySQL 8.0 版本会报 ER_WRONG_ARGUMENTS。
    const listSql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`operation_log\` ${clause} ORDER BY created_at DESC LIMIT ${size} OFFSET ${offset}`
    const [rows] = await this._execute(listSql, values, 'list')
    return { list: rows, total, page: pageNo, pageSize: size }
  }
}

module.exports = new OperationLogRepository()
