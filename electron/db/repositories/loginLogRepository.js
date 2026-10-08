/**
 * 登录日志仓库（Repository Layer）—— 对应 `login_logs` 表
 *
 * 日志表只追加 + 定期清理，不使用软删除（is_deleted）约定：
 *  - 分页查询 / 导出直接查全表；
 *  - 清理按 login_time 物理删除过期记录（见 purgeOlderThan）。
 */
const BaseRepository = require('./BaseRepository')
const { buildOrderBy, normalizePage, buildPageMeta } = require('./queryHelpers')

// 排序白名单：语义字段名 → 可信 SQL 片段
const LOG_SORT_MAP = {
  loginTime: 'login_time',
  username: 'username',
  role: 'role',
  loginType: 'login_type',
  ip: 'ip',
  address: 'address',
  status: 'status'
}

class LoginLogRepository extends BaseRepository {
  constructor() {
    super('login_logs')
  }

  /**
   * 分页查询：关键字（用户名/地址模糊）+ 状态 + 登录方式 + 时间范围
   * @param {{ keyword?:string, status?:number|string, loginType?:string, dateFrom?:string, dateTo?:string, page?:number, pageSize?:number, sortField?:string, sortOrder?:string }} filters
   */
  async pagedList(filters = {}) {
    const where = []
    const params = []
    if (filters.keyword && String(filters.keyword).trim()) {
      const kw = `%${String(filters.keyword).trim()}%`
      where.push('(username LIKE ? OR address LIKE ? OR ip LIKE ?)')
      params.push(kw, kw, kw)
    }
    if (filters.status === 0 || filters.status === 1) {
      where.push('status = ?')
      params.push(Number(filters.status))
    }
    if (filters.loginType) {
      where.push('login_type = ?')
      params.push(String(filters.loginType))
    }
    if (filters.dateFrom) {
      // 只给日期时补当天 00:00:00 起点
      const from = /^\d{4}-\d{2}-\d{2}$/.test(filters.dateFrom) ? `${filters.dateFrom} 00:00:00` : filters.dateFrom
      where.push('login_time >= ?')
      params.push(String(from))
    }
    if (filters.dateTo) {
      // 只给日期时补当天 23:59:59 终点，保证包含当天全部记录
      const to = /^\d{4}-\d{2}-\d{2}$/.test(filters.dateTo) ? `${filters.dateTo} 23:59:59` : filters.dateTo
      where.push('login_time <= ?')
      params.push(String(to))
    }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : ''

    const countSql = `SELECT COUNT(*) AS total FROM \`login_logs\` ${whereSql}`
    const [countRows] = await this._execute(countSql, params, 'pagedList.count')
    const total = Number(countRows[0] && countRows[0].total) || 0

    const { page, pageSize, limit, offset } = normalizePage(filters.page, filters.pageSize)
    const sql =
      'SELECT * FROM `login_logs` ' +
      `${whereSql} ${buildOrderBy(filters, LOG_SORT_MAP, 'login_time DESC, id DESC')} LIMIT ${limit} OFFSET ${offset}`
    const [rows] = await this._execute(sql, params, 'pagedList.list')
    return { list: rows, ...buildPageMeta(total, page, pageSize) }
  }

  /**
   * 导出全量查询：与 pagedList 相同筛选，但不受分页大小上限约束
   * （最多取 5000 条，避免超大数据量导出卡死主进程）
   * @param {Object} filters 同 pagedList（不含分页）
   */
  async listForExport(filters = {}) {
    const where = []
    const params = []
    if (filters.keyword && String(filters.keyword).trim()) {
      const kw = `%${String(filters.keyword).trim()}%`
      where.push('(username LIKE ? OR address LIKE ? OR ip LIKE ?)')
      params.push(kw, kw, kw)
    }
    if (filters.status === 0 || filters.status === 1) {
      where.push('status = ?')
      params.push(Number(filters.status))
    }
    if (filters.loginType) {
      where.push('login_type = ?')
      params.push(String(filters.loginType))
    }
    if (filters.dateFrom) {
      const from = /^\d{4}-\d{2}-\d{2}$/.test(filters.dateFrom) ? `${filters.dateFrom} 00:00:00` : filters.dateFrom
      where.push('login_time >= ?')
      params.push(String(from))
    }
    if (filters.dateTo) {
      const to = /^\d{4}-\d{2}-\d{2}$/.test(filters.dateTo) ? `${filters.dateTo} 23:59:59` : filters.dateTo
      where.push('login_time <= ?')
      params.push(String(to))
    }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const sql =
      'SELECT * FROM `login_logs` ' +
      `${whereSql} ORDER BY login_time DESC, id DESC LIMIT 5000`
    const [rows] = await this._execute(sql, params, 'listForExport')
    return rows
  }

  /**
   * 清理过期日志：按 login_time 物理删除早于「现在 - N 天」的记录
   * @param {number} days 保留天数
   * @returns {number} 删除条数
   */
  async purgeOlderThan(days) {
    const d = Math.max(1, Number(days) || 90)
    const sql = 'DELETE FROM `login_logs` WHERE login_time < (NOW() - INTERVAL ? DAY)'
    const [result] = await this._execute(sql, [d], 'purgeOlderThan')
    return result.affectedRows
  }
}

// 导出单例
module.exports = new LoginLogRepository()
