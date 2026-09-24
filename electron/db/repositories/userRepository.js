/**
 * 用户仓库（Repository Layer）—— 对应 `user` 表
 *
 * 继承 BaseRepository 获得通用 CRUD；
 * 登录 / 改密 / 用户管理等业务相关的查询在此以裸 SQL 表达（保留原生 SQL 的绝对可控性）。
 * 列表过滤演示 buildWhereClause 的用法。
 *
 * 安全约定：
 *   - 返回给上层（进而返回前端）的字段统一走 SAFE_COLUMNS（不含 password）；
 *   - 写入字段统一走 pickProfile 白名单，username / password / role 只能由服务层显式传入，
 *     前端夹带的非法列名或敏感列（password / username / id）一律被丢弃，杜绝注入与越权。
 *
 * 导出单例：全局共用同一个仓库实例。
 */
const BaseRepository = require('./BaseRepository')
const { buildWhereClause } = require('./queryHelpers')

// 用户表安全返回列（不含 password）：列表 / 详情 / 登录回填共用
const SAFE_COLUMNS = [
  'id',
  'username',
  'role',
  'real_name',
  'gender',
  'student_no',
  'email',
  'phone',
  'avatar',
  'bio',
  'college',
  'department',
  'major',
  'grade',
  'degree_type',
  'position',
  'advisor_id',
  'status',
  'must_change_password',
  'join_date',
  'last_login_at',
  'created_at',
  'updated_at'
]

// 档案字段白名单：管理员可读写的用户档案列。
// 注意：不含 username / password / role / id —— 这些由服务层显式处理，防止前端越权改写。
const PROFILE_FIELDS = [
  'real_name',
  'gender',
  'student_no',
  'email',
  'phone',
  'avatar',
  'bio',
  'college',
  'department',
  'major',
  'grade',
  'degree_type',
  'position',
  'advisor_id',
  'status',
  'join_date'
]

// 列名拼接（反引号包裹，防与关键字冲突）
function cols(columns) {
  return columns.map((c) => `\`${c}\``).join(', ')
}

// 从输入对象中提取白名单内的档案字段。
// - undefined：跳过（未传，不写入）；
// - 空字符串 ''：跳过（视为「未填写」）。关键：gender / degree_type 是 ENUM 列，
//   前端下拉框未选时会是 ''，直接写入会触发 MySQL「Data truncated for column」，
//   跳过后由数据库取 DEFAULT（NULL）即可；对 NOT NULL DEFAULT 列（如 status）也安全。
// - null：保留（显式清空语义，写入 NULL）。
function pickProfile(data) {
  const out = {}
  for (const k of PROFILE_FIELDS) {
    const v = data ? data[k] : undefined
    if (v === undefined) continue
    if (typeof v === 'string' && v.trim() === '') continue
    out[k] = v
  }
  return out
}

class UserRepository extends BaseRepository {
  constructor() {
    // 绑定到物理表 `user`
    super('user')
  }

  /**
   * 按用户名查询（登录 / 改密 / 重名校验共用）
   * @param {string} username
   * @returns {Object|null} 含安全列 + password（password 仅供服务层比对哈希，不向上透传）
   */
  async findByUsername(username) {
    const sql = `SELECT ${cols([...SAFE_COLUMNS, 'password'])} FROM \`user\` WHERE username = ?`
    const [rows] = await this._execute(sql, [username], 'findByUsername')
    return rows[0] || null
  }

  /**
   * 用户列表，支持按角色 / 状态 / 关键字 / 导师过滤
   * @param {{ role?: string, status?: string, keyword?: string, advisor_id?: number }} filters
   * @returns {Object[]} 仅返回安全列（不含 password）
   */
  async list(filters = {}) {
    const conditions = []
    if (filters.role) {
      conditions.push({ field: 'role', op: '=', value: filters.role })
    }
    if (filters.status) {
      conditions.push({ field: 'status', op: '=', value: filters.status })
    }
    if (filters.advisor_id) {
      conditions.push({ field: 'advisor_id', op: '=', value: filters.advisor_id })
    }
    if (filters.keyword) {
      conditions.push({ field: 'username', op: 'LIKE', value: `%${filters.keyword}%` })
    }
    const { clause, values } = buildWhereClause(conditions)
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`user\` ${clause} ORDER BY id ASC`
    const [rows] = await this._execute(sql, values, 'list')
    return rows
  }

  /**
   * 新增用户（密码需调用方先 bcrypt 哈希后传入）
   * @param {{ username: string, passwordHash: string, role: string, ...profile }} param
   *        除 username/passwordHash/role 外，其余档案字段经白名单过滤后一并写入
   * @returns {number} 新用户 id
   */
  async createUser({ username, passwordHash, role, ...profile }) {
    const data = pickProfile(profile)
    data.username = username
    data.password = passwordHash
    data.role = role
    return this.create(data)
  }

  /**
   * 按用户名重置密码
   * @param {string} username
   * @param {string} passwordHash bcrypt 哈希后的密码
   */
  async updatePassword(username, passwordHash) {
    const sql = 'UPDATE `user` SET password = ? WHERE username = ?'
    await this._execute(sql, [passwordHash, username], 'updatePassword')
  }

  /**
   * 按主键增量更新：仅白名单内的档案字段 + 服务层显式传入的 role / password / must_change_password 会被写入。
   * @param {number} id
   * @param {Object} data 字段->值 映射（role / password / must_change_password 由服务层显式设置，档案字段白名单过滤）
   * @returns {number} 受影响行数
   */
  async updateById(id, data) {
    const profile = pickProfile(data)
    if (data && data.role !== undefined) profile.role = data.role
    if (data && data.password !== undefined) profile.password = data.password
    if (data && data.must_change_password !== undefined) profile.must_change_password = data.must_change_password
    return this.update(id, profile)
  }
}

// 导出单例
module.exports = new UserRepository()
