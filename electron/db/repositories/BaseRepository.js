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
 */
const { acquireConn } = require('../connection')

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
   * 按主键查询单条
   * @param {number|string} id 主键值
   * @param {string[]} columns 返回列，默认全部
   * @returns {Object|null}
   */
  async findById(id, columns = ['*']) {
    const { conn, release } = await this._acquire()
    try {
      const [rows] = await conn.execute(
        `SELECT ${columns.map((c) => (c === '*' ? '*' : `\`${c}\``)).join(', ')} FROM \`${this.tableName}\` WHERE id = ?`,
        [id]
      )
      return rows[0] || null
    } finally {
      release()
    }
  }

  /**
   * 查询全部（可按列筛选，默认升序无过滤）
   * @param {string[]} columns 返回列，默认全部
   * @returns {Object[]}
   */
  async findAll(columns = ['*']) {
    const { conn, release } = await this._acquire()
    try {
      const [rows] = await conn.execute(
        `SELECT ${columns.map((c) => (c === '*' ? '*' : `\`${c}\``)).join(', ')} FROM \`${this.tableName}\``
      )
      return rows
    } finally {
      release()
    }
  }

  /**
   * 插入一条记录
   * @param {Object} data 字段->值 映射（键即列名，须可信）
   * @returns {number} 自增主键 id
   */
  async create(data) {
    const { conn, release } = await this._acquire()
    try {
      const cols = Object.keys(data)
      const vals = Object.values(data)
      const placeholders = cols.map(() => '?').join(', ')
      const [result] = await conn.execute(
        `INSERT INTO \`${this.tableName}\` (${cols.map((c) => `\`${c}\``).join(', ')}) VALUES (${placeholders})`,
        vals
      )
      return result.insertId
    } finally {
      release()
    }
  }

  /**
   * 按主键增量更新（只更新 data 中非 undefined 的字段）
   * @param {number|string} id 主键值
   * @param {Object} data 需要更新的字段->值 映射
   * @returns {number} 受影响行数
   */
  async update(id, data) {
    const { buildUpdateSet } = require('./queryHelpers')
    const { clause, values } = buildUpdateSet(data)
    if (!clause) return 0
    const { conn, release } = await this._acquire()
    try {
      const [result] = await conn.execute(
        `UPDATE \`${this.tableName}\` SET ${clause} WHERE id = ?`,
        [...values, id]
      )
      return result.affectedRows
    } finally {
      release()
    }
  }

  /**
   * 按主键删除
   * @param {number|string} id 主键值
   * @returns {number} 受影响行数
   */
  async delete(id) {
    const { conn, release } = await this._acquire()
    try {
      const [result] = await conn.execute(
        `DELETE FROM \`${this.tableName}\` WHERE id = ?`,
        [id]
      )
      return result.affectedRows
    } finally {
      release()
    }
  }
}

module.exports = BaseRepository
