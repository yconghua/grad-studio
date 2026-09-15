/**
 * 用户仓库（Repository Layer）—— 对应 `user` 表
 *
 * 继承 BaseRepository 获得通用 CRUD；
 * 登录 / 改密 / 用户管理等业务相关的查询在此以裸 SQL 表达（保留原生 SQL 的绝对可控性）。
 * 列表过滤演示 buildWhereClause 的用法。
 *
 * 导出单例：全局共用同一个仓库实例。
 */
const BaseRepository = require('./BaseRepository')
const { buildWhereClause } = require('./queryHelpers')

class UserRepository extends BaseRepository {
  constructor() {
    // 绑定到物理表 `user`
    super('user')
  }

  /**
   * 按用户名查询（登录 / 改密 / 重名校验共用）
   * @param {string} username
   * @returns {Object|null} 含 id/username/password/role/created_at
   */
  async findByUsername(username) {
    const { conn, release } = await this._acquire()
    try {
      const [rows] = await conn.execute(
        'SELECT id, username, password, role, created_at FROM `user` WHERE username = ?',
        [username]
      )
      return rows[0] || null
    } finally {
      release()
    }
  }

  /**
   * 用户列表（管理员视角），支持按角色 / 关键字过滤
   * @param {{ role?: string, keyword?: string }} filters
   * @returns {Object[]} 仅返回安全列（不含 password）
   */
  async list(filters = {}) {
    const conditions = []
    if (filters.role) {
      conditions.push({ field: 'role', op: '=', value: filters.role })
    }
    if (filters.keyword) {
      // 关键字模糊匹配账号（注意：value 经过 ? 占位，安全）
      conditions.push({ field: 'username', op: 'LIKE', value: `%${filters.keyword}%` })
    }
    const { clause, values } = buildWhereClause(conditions)
    const { conn, release } = await this._acquire()
    try {
      const [rows] = await conn.execute(
        `SELECT id, username, role, created_at FROM \`user\` ${clause} ORDER BY id ASC`,
        values
      )
      return rows
    } finally {
      release()
    }
  }

  /**
   * 新增用户（密码需调用方先 bcrypt 哈希后传入）
   * @param {{ username: string, passwordHash: string, role: string }} param
   * @returns {number} 新用户 id
   */
  async createUser({ username, passwordHash, role }) {
    return this.create({ username, password: passwordHash, role })
  }

  /**
   * 按用户名重置密码
   * @param {string} username
   * @param {string} passwordHash bcrypt 哈希后的密码
   */
  async updatePassword(username, passwordHash) {
    const { conn, release } = await this._acquire()
    try {
      await conn.execute('UPDATE `user` SET password = ? WHERE username = ?', [passwordHash, username])
    } finally {
      release()
    }
  }

  /**
   * 按主键增量更新（role / password 等），复用基类 update
   * @param {number} id
   * @param {Object} data
   * @returns {number} 受影响行数
   */
  async updateById(id, data) {
    return this.update(id, data)
  }
}

// 导出单例
module.exports = new UserRepository()
