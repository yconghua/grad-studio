/**
 * 通用 CRUD 基类（Repository Layer 基础）
 *
 * 干掉重复的增删改查样板：子类只需在构造时传入 tableName，
 * 即可直接复用 findById / findAll / create / update / delete。
 *
 * 连接获取统一走 connection.acquireConn()：
 *   - 事务上下文内自动复用同一连接；
 *   - 否则从连接池取，执行完在 finally 中归还。
 * 子类自定义复杂查询时，也可调用 this._acquire() 复用同一套连接机制。
 *
 * 日志说明：
 *   所有 SQL 执行统一走 this._execute()，每次操作输出
 *   `[SQL] 表名:动作 → 耗时ms rows=影响行数`；执行失败时额外打印 SQL、
 *   参数与错误信息，方便在 Electron 终端里精确定位到表和操作。
 */
const { acquireConn } = require('../connection')

// 写入前清洗：空字符串统一转 null。
// 原因：前端表单留空的数值/日期/时间字段（如报名上限、关联设备ID、开始时间）会以 '' 提交，
// MySQL 严格模式下直接报 "Incorrect integer/date/datetime value: ''"，导致保存失败。
// 统一在此转 null 后，可空列安全写入 NULL；必填列（如 title）前端已做必填校验，不会走到这里。
function sanitizeForWrite(data = {}) {
  const out = {}
  for (const [k, v] of Object.entries(data)) {
    out[k] = (typeof v === 'string' && v.trim() === '') ? null : v
  }
  return out
}

class BaseRepository {
  /**
   * @param {string} tableName 表名（对应数据库中的物理表）
   */
  constructor(tableName) {
    this.tableName = tableName
  }

  // 取连接（统一出口，事务内自动复用）
  async _acquire() {
    return acquireConn()
  }

  /**
   * 统一 SQL 执行出口：执行 + 日志 + 异常定位
   * @param {string} sql SQL 语句
   * @param {Array} params 参数（默认 []）
   * @param {string} action 动作名（findById / findAll / create / update / delete / 自定义）
   * @returns {[rowsOrResult, fields]} 与 conn.execute 返回一致的结构
   */
  async _execute(sql, params, action) {
    const { conn, release } = await this._acquire()
    const t0 = Date.now()
    try {
      const result = await conn.execute(sql, params || [])
      const head = result[0]
      // SELECT 返回数组；写操作返回 ResultSetHeader（取 affectedRows / insertId）
      const rows = Array.isArray(head)
        ? head.length
        : (head && head.affectedRows != null ? head.affectedRows : (head && head.insertId != null ? 1 : 0))
      console.log(`[SQL] ${this.tableName}:${action} → ${Date.now() - t0}ms rows=${rows}`)
      return result
    } catch (err) {
      console.error(`[SQL✗] ${this.tableName}:${action} 执行失败:`)
      console.error('  SQL:', sql)
      console.error('  参数:', params)
      console.error('  错误:', err.message)
      throw err
    } finally {
      release()
    }
  }

  /**
   * 按主键查询单条
   * @param {number|string} id 主键值
   * @param {string[]} columns 返回列，默认全部
   * @returns {Object|null}
   */
  async findById(id, columns = ['*']) {
    const sql = `SELECT ${columns.map((c) => (c === '*' ? '*' : `\`${c}\``)).join(', ')} FROM \`${this.tableName}\` WHERE id = ?`
    const [rows] = await this._execute(sql, [id], 'findById')
    return rows[0] || null
  }

  /**
   * 查询全部（可按列筛选，默认升序无过滤）
   * @param {string[]} columns 返回列，默认全部
   * @returns {Object[]}
   */
  async findAll(columns = ['*']) {
    const sql = `SELECT ${columns.map((c) => (c === '*' ? '*' : `\`${c}\``)).join(', ')} FROM \`${this.tableName}\``
    const [rows] = await this._execute(sql, [], 'findAll')
    return rows
  }

  /**
   * 插入一条记录
   * @param {Object} data 字段->值 映射（键即列名，须可信）
   * @returns {number} 自增主键 id
   */
  async create(data) {
    const clean = sanitizeForWrite(data)
    const cols = Object.keys(clean)
    const vals = Object.values(clean)
    const placeholders = cols.map(() => '?').join(', ')
    const sql = `INSERT INTO \`${this.tableName}\` (${cols.map((c) => `\`${c}\``).join(', ')}) VALUES (${placeholders})`
    const [result] = await this._execute(sql, vals, 'create')
    return result.insertId
  }

  /**
   * 按主键增量更新（只更新 data 中非 undefined 的字段）
   * @param {number|string} id 主键值
   * @param {Object} data 需要更新的字段->值 映射
   * @returns {number} 受影响行数
   */
  async update(id, data) {
    const { buildUpdateSet } = require('./queryHelpers')
    const clean = sanitizeForWrite(data)
    const { clause, values } = buildUpdateSet(clean)
    if (!clause) return 0
    const sql = `UPDATE \`${this.tableName}\` SET ${clause} WHERE id = ?`
    const [result] = await this._execute(sql, [...values, id], 'update')
    return result.affectedRows
  }

  /**
   * 按主键删除
   * @param {number|string} id 主键值
   * @returns {number} 受影响行数
   */
  async delete(id) {
    const sql = `DELETE FROM \`${this.tableName}\` WHERE id = ?`
    const [result] = await this._execute(sql, [id], 'delete')
    return result.affectedRows
  }
}

module.exports = BaseRepository
