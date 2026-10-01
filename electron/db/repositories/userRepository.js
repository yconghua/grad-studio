/**
 * 用户仓库（Repository Layer）—— 对应 `users` 表
 *
 * 继承 BaseRepository 获得通用 create / _execute；本表为物理删除，
 * findById / update / delete 需自行实现（不带 is_deleted 条件）。
 * 登录 / 改密 / 用户管理等业务查询在此以裸 SQL 表达。
 *
 * 安全约定：
 *   - 返回给上层（进而返回前端）的字段统一走 SAFE_COLUMNS（不含 password_hash）；
 *   - 写入字段统一走白名单，username / password_hash / role / status / must_change_password
 *     只能由服务层显式传入，前端夹带的非法列名一律被丢弃。
 */
const BaseRepository = require('./BaseRepository')
const { buildWhereClause, buildUpdateSet, normalizePage, buildPageMeta } = require('./queryHelpers')
const { ACCOUNT_STATUS_ENABLED } = require('../../../shared/constants')

// 用户表安全返回列（不含 password_hash）：列表 / 详情 / 登录回填共用
const SAFE_COLUMNS = [
  'id', 'username', 'real_name', 'role', 'status', 'email', 'phone',
  'gender', 'avatar', 'group_id', 'mentor_id', 'must_change_password',
  'created_at', 'updated_at'
]

// 档案白名单：管理员「资料」Tab 可写字段（账号 / 密码 / 角色 / 状态由服务层显式处理）
const PROFILE_FIELDS = ['real_name', 'email', 'phone', 'gender', 'avatar', 'group_id', 'mentor_id']

// 列名拼接（反引号包裹，防与关键字冲突）
function cols(columns) {
  return columns.map((c) => `\`${c}\``).join(', ')
}

// 从输入对象中提取白名单内的档案字段
// - undefined：跳过（未传，不写入）；空字符串 ''：跳过（视为「未填写」）
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
    super('users')
  }

  /**
   * 按主键查询（返回安全列）
   * @param {number} id
   * @returns {Object|null}
   */
  async findById(id) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`users\` WHERE id = ?`
    const [rows] = await this._execute(sql, [id], 'findById')
    return rows[0] || null
  }

  /**
   * 按用户名查询（登录 / 改密 / 查重共用；username 列排序规则 utf8mb4_bin，区分大小写）
   * @param {string} username
   * @returns {Object|null} 含安全列 + password_hash（仅供服务层比对，不向上透传）
   */
  async findByUsername(username) {
    const sql = `SELECT ${cols([...SAFE_COLUMNS, 'password_hash'])} FROM \`users\` WHERE username = ?`
    const [rows] = await this._execute(sql, [username], 'findByUsername')
    return rows[0] || null
  }

  /**
   * 按角色统计用户数（超级管理员唯一性校验用）
   * @param {string} role
   * @returns {number}
   */
  async countByRole(role) {
    const sql = 'SELECT COUNT(*) AS total FROM `users` WHERE role = ?'
    const [rows] = await this._execute(sql, [role], 'countByRole')
    return Number(rows[0] && rows[0].total) || 0
  }

  /**
   * 用户分页列表：支持关键字（账号/真实姓名模糊）/ 角色 / 状态 / 课题组 / 导师过滤
   * @param {{ keyword?: string, role?: string, status?: number, groupId?: number, mentorId?: number, page?: number }} filters
   * @returns {{ list: Object[], total: number, page: number, pageSize: number, totalPages: number }}
   */
  async pagedList(filters = {}) {
    const conditions = []
    if (filters.role) conditions.push({ field: 'role', op: '=', value: filters.role })
    if (filters.roles && Array.isArray(filters.roles) && filters.roles.length) {
      conditions.push({ field: 'role', op: 'IN', value: filters.roles })
    }
    if (filters.status !== undefined && filters.status !== null && filters.status !== '') {
      conditions.push({ field: 'status', op: '=', value: Number(filters.status) })
    }
    if (filters.groupId) conditions.push({ field: 'group_id', op: '=', value: Number(filters.groupId) })
    if (filters.mentorId) conditions.push({ field: 'mentor_id', op: '=', value: Number(filters.mentorId) })
    if (filters.unassigned) conditions.push({ field: 'group_id', op: 'IS NULL', value: true })
    const { clause, values } = buildWhereClause(conditions)

    // 关键字（账号/真实姓名模糊）需与前缀条件 OR 连接：
    // 无前缀条件时以 WHERE 开头，有前缀条件时以 AND 衔接
    let keywordClause = ''
    let keywordValues = []
    if (filters.keyword && String(filters.keyword).trim()) {
      const kw = `%${String(filters.keyword).trim()}%`
      keywordClause = (clause ? ' AND ' : 'WHERE ') + '(username LIKE ? OR real_name LIKE ?)'
      keywordValues = [kw, kw]
    }

    const countSql = `SELECT COUNT(*) AS total FROM \`users\` ${clause} ${keywordClause}`
    const [countRows] = await this._execute(countSql, [...values, ...keywordValues], 'pagedList.count')
    const total = Number(countRows[0] && countRows[0].total) || 0

    const { page, pageSize, limit, offset } = normalizePage(filters.page)
    // LIMIT/OFFSET 直接内联整数值（normalizePage 已做 parseInt 归一化）：
    // 部分 MySQL 版本对 prepared statement 的 LIMIT ? 占位符报
    // 「Incorrect arguments to mysqld_stmt_execute」，改用文本协议参数更稳妥。
    const sql =
      `SELECT ${cols(SAFE_COLUMNS)} FROM \`users\` ${clause} ${keywordClause} ORDER BY id ASC LIMIT ${limit} OFFSET ${offset}`
    const [rows] = await this._execute(sql, [...values, ...keywordValues], 'pagedList')
    return { list: rows, ...buildPageMeta(total, page, pageSize) }
  }

  /**
   * 新增用户（密码需调用方先 bcrypt 哈希后传入）
   * @param {{ username: string, passwordHash: string, role: string, status?: number, mustChangePassword?: number, ...profile }} param
   * @returns {number} 新用户 id
   */
  async createUser({ username, passwordHash, role, ...profile }) {
    const data = pickProfile(profile)
    data.username = username
    data.password_hash = passwordHash
    data.role = role
    if (profile.status !== undefined && profile.status !== '') data.status = Number(profile.status)
    if (profile.mustChangePassword !== undefined) data.must_change_password = Number(profile.mustChangePassword)
    else data.must_change_password = 1
    return this.create(data)
  }

  /**
   * 按主键增量更新：白名单档案字段 + 服务层显式传入的 role / status / password_hash / must_change_password / username
   * @param {number} id
   * @param {Object} data 字段->值 映射
   * @returns {number} 受影响行数
   */
  async updateById(id, data) {
    const clean = pickProfile(data)
    for (const k of ['username', 'role', 'status', 'password_hash', 'must_change_password']) {
      if (data && data[k] !== undefined && data[k] !== '') clean[k] = data[k]
    }
    const { clause, values } = buildUpdateSet(clean)
    if (!clause) return 0
    const sql = `UPDATE \`users\` SET ${clause} WHERE id = ?`
    const [result] = await this._execute(sql, [...values, id], 'updateById')
    return result.affectedRows
  }

  /**
   * 物理删除用户（需求约定：用户删除为物理删除）
   * @param {number} id
   * @returns {number} 受影响行数
   */
  async deleteById(id) {
    const sql = 'DELETE FROM `users` WHERE id = ?'
    const [result] = await this._execute(sql, [id], 'deleteById')
    return result.affectedRows
  }

  /**
   * 导师名下学生列表（分页）：role=student 且 mentor_id=当前导师
   * @param {number} mentorId
   * @param {{ keyword?: string, page?: number }} filters
   */
  async pagedStudentsByMentor(mentorId, filters = {}) {
    return this._pagedByCondition(
      ['role = ?', 'mentor_id = ?', 'status = ?'],
      ['student', Number(mentorId), ACCOUNT_STATUS_ENABLED],
      filters,
      'pagedStudentsByMentor'
    )
  }

  /**
   * 课题组内学生列表（分页）：role=student 且 group_id=当前课题组
   * @param {number} groupId
   * @param {{ keyword?: string, page?: number }} filters
   */
  async pagedStudentsByGroup(groupId, filters = {}) {
    return this._pagedByCondition(
      ['role = ?', 'group_id = ?', 'status = ?'],
      ['student', Number(groupId), ACCOUNT_STATUS_ENABLED],
      filters,
      'pagedStudentsByGroup'
    )
  }

  /**
   * 课题组内导师列表（轻量，供「指定导师」下拉选人）
   * @param {number} groupId
   * @returns {Array<{ id: number, username: string, real_name: string }>}
   */
  async listMentorsByGroup(groupId) {
    const sql =
      'SELECT `id`, `username`, `real_name` FROM `users` WHERE role = ? AND group_id = ? AND status = ? ORDER BY id ASC'
    const [rows] = await this._execute(sql, ['mentor', Number(groupId), ACCOUNT_STATUS_ENABLED], 'listMentorsByGroup')
    return rows
  }

  /**
   * 按课题组统计在组导师/学生数（课题组删除前校验用；
   * 组管理员的绑定归属由 groups.admin_user_id 表达，不计入成员数）
   * @param {number} groupId
   * @returns {number}
   */
  async countByGroup(groupId) {
    const sql =
      `SELECT COUNT(*) AS total FROM \`users\` WHERE group_id = ? AND role IN ('mentor', 'student') AND status = ?`
    const [rows] = await this._execute(sql, [Number(groupId), ACCOUNT_STATUS_ENABLED], 'countByGroup')
    return Number(rows[0] && rows[0].total) || 0
  }

  /**
   * 导师/学生当前有效课题组（公告可见范围用）：
   * 实时查询、不读会话缓存——换组/离组立即生效；
   * 仅「启用状态 + 导师/学生角色 + 已入组」才算有效成员，脏数据一律不可见。
   * @param {number} userId
   * @returns {{ group_id: number }|null}
   */
  async findActiveGroupOfUser(userId) {
    const sql =
      `SELECT \`group_id\` FROM \`users\` WHERE id = ? AND role IN ('mentor', 'student') AND status = ? AND \`group_id\` IS NOT NULL`
    const [rows] = await this._execute(sql, [Number(userId), ACCOUNT_STATUS_ENABLED], 'findActiveGroupOfUser')
    return rows[0] || null
  }

  /**
   * 公告应读基数：该组启用状态的导师/学生人数（已读统计 totalMembers 专用，独立口径）
   * @param {number} groupId
   * @returns {number}
   */
  async countAudienceByGroup(groupId) {
    const sql =
      `SELECT COUNT(*) AS total FROM \`users\` WHERE \`group_id\` = ? AND role IN ('mentor', 'student') AND status = ?`
    const [rows] = await this._execute(sql, [Number(groupId), ACCOUNT_STATUS_ENABLED], 'countAudienceByGroup')
    return Number(rows[0] && rows[0].total) || 0
  }

  /**
   * 通用条件分页（内部复用）：固定条件 + 可选关键字（账号/真实姓名）
   */
  async _pagedByCondition(condArr, condValues, filters, action) {
    const where = condArr.map((c) => c).join(' AND ')
    const baseValues = condValues.slice()

    let keywordClause = ''
    let keywordValues = []
    if (filters.keyword && String(filters.keyword).trim()) {
      const kw = `%${String(filters.keyword).trim()}%`
      keywordClause = ' AND (username LIKE ? OR real_name LIKE ?)'
      keywordValues = [kw, kw]
    }

    const countSql = `SELECT COUNT(*) AS total FROM \`users\` WHERE ${where}${keywordClause}`
    const [countRows] = await this._execute(countSql, [...baseValues, ...keywordValues], `${action}.count`)
    const total = Number(countRows[0] && countRows[0].total) || 0

    const { page, pageSize, limit, offset } = normalizePage(filters.page)
    // LIMIT/OFFSET 直接内联整数值（normalizePage 已做 parseInt 归一化），规避
    // prepared statement 对 LIMIT ? 占位符的支持问题（见 pagedList 注释）。
    const sql =
      `SELECT ${cols(SAFE_COLUMNS)} FROM \`users\` WHERE ${where}${keywordClause} ORDER BY id ASC LIMIT ${limit} OFFSET ${offset}`
    const [rows] = await this._execute(sql, [...baseValues, ...keywordValues], action)
    return { list: rows, ...buildPageMeta(total, page, pageSize) }
  }
}

// 导出单例
module.exports = new UserRepository()
