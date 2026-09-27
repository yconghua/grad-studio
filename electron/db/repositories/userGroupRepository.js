/**
 * 成员归属仓库（Repository Layer）—— 对应 `user_group` 表
 *
 * 记录用户在课题组内的归属与组内角色。列表联 user 表取 username / role，
 * 供「成员管理」页面展示。唯一索引 (user_id, group_id)。
 * 导出单例。
 */
const BaseRepository = require('./BaseRepository')

// 本表业务列（联表字段另在列表 SQL 中显式取出）
const SAFE_COLUMNS = [
  'id', 'user_id', 'group_id', 'role_in_group', 'status',
  'joined_at', 'left_at', 'remark'
]

const WRITE_FIELDS = [
  'user_id', 'group_id', 'role_in_group', 'status',
  'joined_at', 'left_at', 'remark'
]

function cols(columns) {
  return columns.map((c) => `\`ug\`.\`${c}\``).join(', ')
}

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

class UserGroupRepository extends BaseRepository {
  constructor() {
    super('user_group')
  }

  /**
   * 按课题组列出成员（联 user 表取 username / role），可按组内角色 / 状态过滤
   * @param {{ group_id: number, role_in_group?: string, status?: string }} filters
   * @returns {Object[]}
   */
  async listByGroup(filters = {}) {
    const conditions = [
      { field: 'ug.is_deleted', op: '=', value: 0 },
      { field: 'ug.group_id', op: '=', value: filters.group_id }
    ]
    if (filters.role_in_group) {
      conditions.push({ field: 'ug.role_in_group', op: '=', value: filters.role_in_group })
    }
    if (filters.status) {
      conditions.push({ field: 'ug.status', op: '=', value: filters.status })
    }
    const where = conditions
      .map((c) => `${c.field} ${c.op} ?`)
      .join(' AND ')
    const values = conditions.map((c) => c.value)
    const sql = `SELECT ${cols(SAFE_COLUMNS)}, \`u\`.\`username\`, \`u\`.\`role\` AS \`user_role\`
      FROM \`user_group\` AS \`ug\`
      LEFT JOIN \`user\` AS \`u\` ON \`u\`.\`id\` = \`ug\`.\`user_id\` AND \`u\`.\`is_deleted\` = 0
      WHERE ${where}
      ORDER BY \`ug\`.\`id\` ASC`
    const [rows] = await this._execute(sql, values, 'listByGroup')
    return rows
  }

  /**
   * 按 (user_id, group_id) 查归属记录（唯一索引，幂等判断用）
   * @param {number} userId
   * @param {number} groupId
   * @returns {Object|null}
   */
  async findByUserAndGroup(userId, groupId) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`user_group\` AS \`ug\`
      WHERE \`ug\`.\`user_id\` = ? AND \`ug\`.\`group_id\` = ? AND \`ug\`.\`is_deleted\` = 0`
    const [rows] = await this._execute(sql, [userId, groupId], 'findByUserAndGroup')
    return rows[0] || null
  }

  /**
   * 按用户列出所属课题组（联 group 表取组信息，含组内角色）。
   * 仅返回用户「在组中」且「课题组可用」的记录：ug.status = active、group 未软删且未停用。
   * @param {number} userId
   * @returns {Object[]}
   */
  async listGroupsByUser(userId) {
    const sql = `SELECT \`g\`.\`id\`, \`g\`.\`name\`, \`g\`.\`code\`, \`g\`.\`status\`,
        \`ug\`.\`role_in_group\`, \`ug\`.\`joined_at\`
      FROM \`user_group\` AS \`ug\`
      JOIN \`group\` AS \`g\` ON \`g\`.\`id\` = \`ug\`.\`group_id\` AND \`g\`.\`is_deleted\` = 0 AND \`g\`.\`status\` = 'active'
      WHERE \`ug\`.\`user_id\` = ? AND \`ug\`.\`is_deleted\` = 0 AND \`ug\`.\`status\` = 'active'
      ORDER BY \`g\`.\`id\` ASC`
    const [rows] = await this._execute(sql, [userId], 'listGroupsByUser')
    return rows
  }

  // 白名单提取可写入字段
  pick(data) {
    return pickWrite(data)
  }
}

module.exports = new UserGroupRepository()
