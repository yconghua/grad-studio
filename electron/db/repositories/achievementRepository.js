/**
 * 科研成果仓库（Repository Layer）—— 对应 `achievements` 表
 *
 * 继承 BaseRepository 获得通用 findById / create / update / delete；
 * 归属语义与学业档案一致：记录以 user_id 归属学生（服务层注入，客户端不可传），
 * group_id 仅为按组筛选的冗余；软删除约定与全项目一致（is_deleted 0/1）。
 */
const BaseRepository = require('./BaseRepository')
const { buildOrderBy, normalizePage } = require('./queryHelpers')

// 排序白名单：语义字段 → 可信 SQL 片段（a=achievements 别名，u=users 别名）
const SORT_MAP = {
  realName: 'u.real_name',
  userNo: 'u.user_no',
  title: 'a.title',
  type: 'a.type',
  level: 'a.level',
  venue: 'a.venue',
  publishDate: 'a.publish_date',
  status: 'a.status',
  createdAt: 'a.created_at'
}

class AchievementRepository extends BaseRepository {
  constructor() {
    super('achievements')
  }

  // 分页查询（列表统一：每页 8 条，后端排序）。
  // 范围条件：userId（学生本人）/ groupId（组管、超管按组）/ mentorId（导师名下学生）。
  // 过滤：type / status 精确；keyword 模糊搜 标题/载体/作者。
  async paged({ userId, groupId, mentorId, type, status, keyword, page, pageSize, sortField, sortOrder } = {}) {
    const whereParts = ['a.is_deleted = 0']
    const values = []
    if (userId) { whereParts.push('a.user_id = ?'); values.push(Number(userId)) }
    if (groupId) { whereParts.push('a.group_id = ?'); values.push(Number(groupId)) }
    if (type) { whereParts.push('a.type = ?'); values.push(String(type)) }
    if (status) { whereParts.push('a.status = ?'); values.push(String(status)) }
    if (mentorId) {
      whereParts.push('u.mentor_id = ?')
      whereParts.push('u.role = ?')
      values.push(Number(mentorId), 'student')
    }
    if (keyword) {
      const kw = `%${String(keyword).trim()}%`
      whereParts.push('(a.title LIKE ? OR a.venue LIKE ? OR a.authors LIKE ?)')
      values.push(kw, kw, kw)
    }
    const where = 'WHERE ' + whereParts.join(' AND ')
    const order = buildOrderBy({ sortField, sortOrder }, SORT_MAP, 'a.id DESC')
    const { limit, offset, page: cur, pageSize: size } = normalizePage(page, pageSize)

    const countSql =
      `SELECT COUNT(*) AS total FROM \`achievements\` a JOIN \`users\` u ON u.id = a.user_id ${where}`
    const [countRows] = await this._execute(countSql, values, 'paged.count')
    const total = Number(countRows[0] && countRows[0].total)

    const sql =
      `SELECT a.*, u.real_name, u.user_no, u.username
       FROM \`achievements\` a JOIN \`users\` u ON u.id = a.user_id ${where} ${order} LIMIT ${limit} OFFSET ${offset}`
    const [rows] = await this._execute(sql, values, 'paged')
    return { list: rows, total, page: cur, pageSize: size }
  }

  // 按主键查成果（含归属，供查看/操作前校验）
  async findByIdWithOwner(id) {
    const sql =
      `SELECT a.*, u.real_name, u.user_no, u.username
       FROM \`achievements\` a JOIN \`users\` u ON u.id = a.user_id
       WHERE a.id = ? AND a.is_deleted = 0`
    const [rows] = await this._execute(sql, [Number(id)], 'findByIdWithOwner')
    return rows[0] || null
  }

  // 更新状态（提交 / 确认 / 退回），带归属学生校验条件
  async updateStatus(id, userId, status, extra = {}) {
    const setParts = ['`status` = ?']
    const values = [status]
    for (const k of Object.keys(extra)) {
      setParts.push(`\`${k}\` = ?`)
      values.push(extra[k])
    }
    values.push(Number(id), Number(userId))
    const sql =
      `UPDATE \`achievements\` SET ${setParts.join(', ')} WHERE id = ? AND user_id = ? AND is_deleted = 0`
    const [result] = await this._execute(sql, values, 'updateStatus')
    return result.affectedRows
  }

  // 批量确认：某学生多条 submitted 成果一次确认（导师批量确认）
  async batchConfirm(userId, ids) {
    if (!ids || !ids.length) return 0
    const marks = ids.map(() => '?').join(', ')
    const sql =
      `UPDATE \`achievements\` SET \`status\` = 'confirmed', \`reject_reason\` = NULL
       WHERE user_id = ? AND id IN (${marks}) AND status = 'submitted' AND is_deleted = 0`
    const [result] = await this._execute(sql, [Number(userId), ...ids.map(Number)], 'batchConfirm')
    return result.affectedRows
  }

  // 导师名下全部已提交成果一次确认（导师页「全部确认」）
  async batchConfirmByMentor(mentorId) {
    const sql =
      `UPDATE \`achievements\` a JOIN \`users\` u ON u.id = a.user_id
       SET a.\`status\` = 'confirmed', a.\`reject_reason\` = NULL
       WHERE u.mentor_id = ? AND u.role = 'student' AND a.status = 'submitted' AND a.is_deleted = 0`
    const [result] = await this._execute(sql, [Number(mentorId)], 'batchConfirmByMentor')
    return result.affectedRows
  }

  // 范围全量（统计摘要 / Excel 导出用）：同 paged 的条件，不分页
  async listAll({ userId, groupId, mentorId, type, status } = {}) {
    const whereParts = ['a.is_deleted = 0']
    const values = []
    if (userId) { whereParts.push('a.user_id = ?'); values.push(Number(userId)) }
    if (groupId) { whereParts.push('a.group_id = ?'); values.push(Number(groupId)) }
    if (type) { whereParts.push('a.type = ?'); values.push(String(type)) }
    if (status) { whereParts.push('a.status = ?'); values.push(String(status)) }
    if (mentorId) {
      whereParts.push('u.mentor_id = ?')
      whereParts.push('u.role = ?')
      values.push(Number(mentorId), 'student')
    }
    const where = 'WHERE ' + whereParts.join(' AND ')
    const sql =
      `SELECT a.*, u.real_name, u.user_no, u.username
       FROM \`achievements\` a JOIN \`users\` u ON u.id = a.user_id ${where} ORDER BY a.id DESC`
    const [rows] = await this._execute(sql, values, 'listAll')
    return rows
  }

  // 学生删除时级联清理：该学生全部成果软删（用户删除事务内调用）
  async softDeleteByUser(userId) {
    return this.softDeleteByField('user_id', userId)
  }
}

module.exports = new AchievementRepository()
