/**
 * 周报仓库（Repository Layer）—— 对应 `report` 表
 *
 * 与 BaseRepository 的区别：report 表无 is_deleted 列（无软删：学生不可删，
 * 超管删除=物理删除），因此 findById / update / delete 全部自行实现，
 * 不继承通用 CRUD；分页统一走 queryHelpers.normalizePage（每页 8 条）。
 *
 * 状态流转约定：所有写操作带 version 乐观锁 + 状态前置条件，
 * 冲突返回 0，由服务层转换为「已被其他设备更新」提示。
 */
const BaseRepository = require('./BaseRepository')
const { normalizePage, buildPageMeta, buildUpdateSet, buildOrderBy } = require('./queryHelpers')

// 列表列（不含 content 大字段；摘要用 SUBSTRING 截取前 120 字）
const LIST_COLUMNS = [
  'id', 'user_id', 'group_id', 'week_key', 'title', 'status', 'is_late',
  'review_action', 'review_score', 'reviewed_by', 'reviewed_at',
  'submitted_at', 'version', 'created_at', 'updated_at'
]

// 周报明细排序白名单：语义字段名 → 可信 SQL 片段（联表带 r. / u. 前缀）
const REPORT_SORT_MAP = {
  studentName: 'u.real_name',
  studentUsername: 'u.username',
  weekKey: 'r.week_key',
  title: 'r.title',
  status: 'r.status',
  isLate: 'r.is_late',
  submittedAt: 'r.submitted_at',
  reviewedAt: 'r.reviewed_at'
}

// 各组排名排序白名单（GROUP BY 聚合结果：别名列）
const RANKING_SORT_MAP = {
  groupName: 'g.name',
  submitted: 'submitted',
  onTime: 'on_time'
}

// 列清单拼接；alias 非空时为每列加表前缀（JOIN 场景避免列名歧义）
function cols(columns, alias) {
  const p = alias ? `${alias}.` : ''
  return columns.map((c) => `${p}\`${c}\``).join(', ')
}

class ReportRepository extends BaseRepository {
  constructor() {
    super('report')
  }

  // 按主键查询（无 is_deleted 条件）
  async findById(id) {
    const sql = `SELECT * FROM \`report\` WHERE id = ?`
    const [rows] = await this._execute(sql, [Number(id)], 'findById')
    return rows[0] || null
  }

  // 学生某周周报（一人一周一份，唯一索引保证）
  async findByUserAndWeek(userId, weekKey) {
    const sql = `SELECT * FROM \`report\` WHERE user_id = ? AND week_key = ?`
    const [rows] = await this._execute(sql, [Number(userId), weekKey], 'findByUserAndWeek')
    return rows[0] || null
  }

  // 新建（user_id/group_id/week_key 服务端注入）
  async createReport(userId, groupId, weekKey, title, content, templateId) {
    const sql =
      'INSERT INTO `report` (`user_id`, `group_id`, `week_key`, `title`, `content`, `template_id`) VALUES (?, ?, ?, ?, ?, ?)'
    const [result] = await this._execute(
      sql,
      [Number(userId), Number(groupId), weekKey, title, content, templateId == null ? null : Number(templateId)],
      'createReport'
    )
    return result.insertId
  }

  // 乐观锁更新正文（仅草稿/打回态可编辑；created_at/user_id 不可改）
  async updateWithVersion(id, userId, patch, version) {
    const { clause, values } = buildUpdateSet(patch)
    if (!clause) return 0
    const sql =
      `UPDATE \`report\` SET ${clause} WHERE id = ? AND user_id = ? AND status IN ('draft', 'returned') AND version = ?`
    const [result] = await this._execute(sql, [...values, Number(id), Number(userId), Number(version)], 'updateWithVersion')
    return result.affectedRows
  }

  // 提交：draft/returned → submitted；写入提交时间与补交标记（服务端计算）
  async submit(id, userId, version, submittedAt, late) {
    const sql =
      `UPDATE \`report\` SET status = 'submitted', submitted_at = ?, is_late = ?,
       version = version + 1 WHERE id = ? AND user_id = ? AND status IN ('draft', 'returned') AND version = ?`
    const [result] = await this._execute(
      sql,
      [submittedAt, late ? 1 : 0, Number(id), Number(userId), Number(version)],
      'submit'
    )
    return result.affectedRows
  }

  // 学生撤回提交：submitted → draft（仅 1h 窗口内由服务层校验）；清空提交时间/补交标记
  async withdrawSubmit(id, userId, version) {
    const sql =
      `UPDATE \`report\` SET status = 'draft', submitted_at = NULL, is_late = 0,
       version = version + 1 WHERE id = ? AND user_id = ? AND status = 'submitted' AND version = ?`
    const [result] = await this._execute(sql, [Number(id), Number(userId), Number(version)], 'withdrawSubmit')
    return result.affectedRows
  }

  // 导师批阅：submitted → reviewed/returned；写入评语/评分/批阅人与时间（乐观锁）
  async review(id, reviewerId, { action, comment, score }, version) {
    // 状态值与动作值不同：打回写 status='returned'（学生可改后重交），review_action='return'
    const statusValue = action === 'return' ? 'returned' : 'reviewed'
    const sql =
      `UPDATE \`report\` SET status = ?, review_action = ?, review_comment = ?, review_score = ?,
       reviewed_by = ?, reviewed_at = NOW(), revoke_reason = NULL, revoked_at = NULL,
       version = version + 1 WHERE id = ? AND status = 'submitted' AND version = ?`
    const [result] = await this._execute(
      sql,
      [statusValue, action, comment, score == null ? null : Number(score), Number(reviewerId), Number(id), Number(version)],
      'review'
    )
    return result.affectedRows
  }

  // 导师撤回批阅：reviewed → submitted；清空批阅字段，记录撤回理由/时间（24h 窗口由服务层校验）
  async unreview(id, reviewerId, reason, version) {
    const sql =
      `UPDATE \`report\` SET status = 'submitted', review_action = NULL, review_comment = NULL,
       review_score = NULL, reviewed_by = NULL, reviewed_at = NULL,
       revoke_reason = ?, revoked_at = NOW(), version = version + 1
       WHERE id = ? AND reviewed_by = ? AND status = 'reviewed' AND version = ?`
    const [result] = await this._execute(
      sql,
      [reason, Number(id), Number(reviewerId), Number(version)],
      'unreview'
    )
    return result.affectedRows
  }

  // 我的周报历史：按周倒序分页
  async listMine(userId, page) {
    const { page: p, pageSize, limit, offset } = normalizePage(page)
    const countSql = 'SELECT COUNT(*) AS total FROM `report` WHERE user_id = ?'
    const [countRows] = await this._execute(countSql, [Number(userId)], 'listMine.count')
    const total = Number(countRows[0] && countRows[0].total) || 0
    const sql =
      `SELECT ${cols(LIST_COLUMNS)}, SUBSTRING(\`content\`, 1, 120) AS summary FROM \`report\`
       WHERE user_id = ? ORDER BY week_key DESC LIMIT ${limit} OFFSET ${offset}`
    const [rows] = await this._execute(sql, [Number(userId)], 'listMine')
    return { list: rows, ...buildPageMeta(total, p, pageSize) }
  }

  // 导师待批列表：名下学生（mentor_id 关系）的 submitted/returned；补交置顶、按提交时间升序
  async listToReview(mentorId, page) {
    const { page: p, pageSize, limit, offset } = normalizePage(page)
    const countSql =
      `SELECT COUNT(*) AS total FROM \`report\` r JOIN \`users\` u ON u.id = r.user_id
       WHERE u.mentor_id = ? AND r.status IN ('submitted', 'returned')`
    const [countRows] = await this._execute(countSql, [Number(mentorId)], 'listToReview.count')
    const total = Number(countRows[0] && countRows[0].total) || 0
    const sql =
      `SELECT ${cols(LIST_COLUMNS, 'r')}, SUBSTRING(r.\`content\`, 1, 120) AS summary,
              u.real_name AS student_name, u.username AS student_username
       FROM \`report\` r JOIN \`users\` u ON u.id = r.user_id
       WHERE u.mentor_id = ? AND r.status IN ('submitted', 'returned')
       ORDER BY r.is_late DESC, r.submitted_at ASC LIMIT ${limit} OFFSET ${offset}`
    const [rows] = await this._execute(sql, [Number(mentorId)], 'listToReview')
    return { list: rows, ...buildPageMeta(total, p, pageSize) }
  }

  // 组内列表（组管/导师只读）：可按周/状态过滤
  async listGroup(groupId, filters = {}) {
    const { page: p, pageSize, limit, offset } = normalizePage(filters.page)
    const where = ['r.group_id = ?']
    const values = [Number(groupId)]
    if (filters.weekKey) {
      where.push('r.week_key = ?')
      values.push(filters.weekKey)
    }
    if (filters.status && filters.status !== 'all') {
      where.push('r.status = ?')
      values.push(filters.status)
    }
    const whereSql = where.join(' AND ')
    const countSql = `SELECT COUNT(*) AS total FROM \`report\` r WHERE ${whereSql}`
    const [countRows] = await this._execute(countSql, values, 'listGroup.count')
    const total = Number(countRows[0] && countRows[0].total) || 0
    const sql =
      `SELECT ${cols(LIST_COLUMNS, 'r')}, SUBSTRING(r.\`content\`, 1, 120) AS summary,
              u.real_name AS student_name, u.username AS student_username
       FROM \`report\` r JOIN \`users\` u ON u.id = r.user_id
       WHERE ${whereSql} ${buildOrderBy(filters, REPORT_SORT_MAP, 'r.week_key DESC, r.user_id ASC')} LIMIT ${limit} OFFSET ${offset}`
    const [rows] = await this._execute(sql, values, 'listGroup')
    return { list: rows, ...buildPageMeta(total, p, pageSize) }
  }

  // 详情（含学生姓名；content 由服务层按权限裁剪）
  async getDetail(id) {
    const sql =
      `SELECT r.*, u.real_name AS student_name, u.username AS student_username,
              b.real_name AS reviewed_by_name
       FROM \`report\` r
       JOIN \`users\` u ON u.id = r.user_id
       LEFT JOIN \`users\` b ON b.id = r.reviewed_by
       WHERE r.id = ?`
    const [rows] = await this._execute(sql, [Number(id)], 'getDetail')
    return rows[0] || null
  }

  // 该周已提交学生 id 列表（status 至少 submitted；draft 不计）
  async listSubmittedUserIds(groupId, weekKey) {
    const sql =
      `SELECT DISTINCT user_id FROM \`report\`
       WHERE group_id = ? AND week_key = ? AND status IN ('submitted', 'returned', 'reviewed')`
    const [rows] = await this._execute(sql, [Number(groupId), weekKey], 'listSubmittedUserIds')
    return rows.map((r) => Number(r.user_id))
  }

  // 超管全局某周统计（不区分组，接口不返回任何内容字段）
  async globalStatsOfWeek(weekKey) {
    const sql =
      `SELECT
         COUNT(DISTINCT user_id) AS submitted,
         COUNT(DISTINCT CASE WHEN is_late = 0 THEN user_id END) AS on_time,
         SUM(CASE WHEN status = 'reviewed' THEN 1 ELSE 0 END) AS reviewed,
         AVG(CASE WHEN status = 'reviewed' AND review_score IS NOT NULL THEN review_score END) AS avg_score
       FROM \`report\` WHERE week_key = ? AND status IN ('submitted', 'returned', 'reviewed')`
    const [rows] = await this._execute(sql, [weekKey], 'globalStatsOfWeek')
    const r = rows[0] || {}
    return {
      submitted: Number(r.submitted) || 0,
      onTime: Number(r.on_time) || 0,
      reviewed: Number(r.reviewed) || 0,
      avgScore: r.avg_score == null ? null : Number(Number(r.avg_score).toFixed(2))
    }
  }

  // 超管全局近 N 周逐周统计（趋势；未提交周补 0）
  async globalRecentWeekStats(weekKeys) {
    if (!weekKeys || !weekKeys.length) return []
    const marks = weekKeys.map(() => '?').join(', ')
    const sql =
      `SELECT week_key,
         COUNT(DISTINCT user_id) AS submitted,
         COUNT(DISTINCT CASE WHEN is_late = 0 THEN user_id END) AS on_time,
         AVG(CASE WHEN status = 'reviewed' AND review_score IS NOT NULL THEN review_score END) AS avg_score
       FROM \`report\` WHERE week_key IN (${marks}) AND status IN ('submitted', 'returned', 'reviewed')
       GROUP BY week_key`
    const [rows] = await this._execute(sql, weekKeys, 'globalRecentWeekStats')
    const byWeek = {}
    for (const r of rows) {
      byWeek[r.week_key] = {
        submitted: Number(r.submitted) || 0,
        onTime: Number(r.on_time) || 0,
        avgScore: r.avg_score == null ? null : Number(Number(r.avg_score).toFixed(2))
      }
    }
    return weekKeys.map((k) => ({ weekKey: k, ...(byWeek[k] || { submitted: 0, onTime: 0, avgScore: null }) }))
  }

  // 各组某周提交排行（超管：按组排名）
  async groupRanking(weekKey, filters = {}) {
    const sql =
      `SELECT r.group_id, g.name AS group_name,
         COUNT(DISTINCT r.user_id) AS submitted,
         COUNT(DISTINCT CASE WHEN r.is_late = 0 THEN r.user_id END) AS on_time
       FROM \`report\` r LEFT JOIN \`groups\` g ON g.id = r.group_id
       WHERE r.week_key = ? AND r.status IN ('submitted', 'returned', 'reviewed')
       GROUP BY r.group_id, g.name ${buildOrderBy(filters, RANKING_SORT_MAP, 'submitted DESC, on_time DESC')}`
    const [rows] = await this._execute(sql, [weekKey], 'groupRanking')
    return rows.map((r) => ({
      groupId: Number(r.group_id),
      groupName: r.group_name || `组#${r.group_id}`,
      submitted: Number(r.submitted) || 0,
      onTime: Number(r.on_time) || 0
    }))
  }

  // 应提交学生 id 列表（启用 + 在组 + 有导师；统计分母）
  async expectedStudentIds(groupId) {
    const sql =
      'SELECT `id` FROM `users` WHERE role = ? AND status = 1 AND group_id = ? AND mentor_id IS NOT NULL'
    const [rows] = await this._execute(sql, ['student', Number(groupId)], 'expectedStudentIds')
    return rows.map((r) => Number(r.id))
  }

  // 全平台应提交学生数（超管统计分母）
  async expectedCountAll() {
    const sql =
      'SELECT COUNT(*) AS total FROM `users` WHERE role = ? AND status = 1 AND group_id IS NOT NULL AND mentor_id IS NOT NULL'
    const [rows] = await this._execute(sql, ['student'], 'expectedCountAll')
    return Number(rows[0] && rows[0].total) || 0
  }

  // 按 id 集合查学生基本信息（未交名单展示用）
  async studentsByIds(ids) {
    if (!ids || !ids.length) return []
    const marks = ids.map(() => '?').join(', ')
    const sql =
      'SELECT `id`, `username`, `real_name` FROM `users` WHERE id IN (' + marks + ')'
    const [rows] = await this._execute(sql, ids, 'studentsByIds')
    return rows
  }

  // 当周未提交学生列表（未交提醒用）：启用+在组+有导师，且该周无 ≥submitted 记录
  async listStudentsMissing(weekKey) {
    const sql =
      `SELECT u.id, u.group_id FROM \`users\` u
       WHERE u.role = 'student' AND u.status = 1 AND u.group_id IS NOT NULL AND u.mentor_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM \`report\` r
           WHERE r.user_id = u.id AND r.week_key = ? AND r.status IN ('submitted', 'returned', 'reviewed')
         )`
    const [rows] = await this._execute(sql, [weekKey], 'listStudentsMissing')
    return rows.map((r) => ({ id: Number(r.id), groupId: Number(r.group_id) }))
  }

  // 超时未批的待批周报：submitted 且提交时间早于 N 小时前（JOIN 学生取导师，JOIN 组取组管）
  async listReviewTimeout(hours) {
    const sql =
      `SELECT r.id, r.week_key, r.group_id, r.submitted_at, u.id AS student_id, u.real_name AS student_name,
              u.mentor_id, g.admin_user_id
       FROM \`report\` r
       JOIN \`users\` u ON u.id = r.user_id
       LEFT JOIN \`groups\` g ON g.id = r.group_id
       WHERE r.status = 'submitted' AND r.submitted_at IS NOT NULL
         AND r.submitted_at <= DATE_SUB(NOW(), INTERVAL ${Number(hours)} HOUR)`
    const [rows] = await this._execute(sql, [], 'listReviewTimeout')
    return rows
  }

  // 打回超时未重交：returned 且打回时间早于 N 天前（JOIN 学生取姓名）
  async listReturnedStale(days) {
    const sql =
      `SELECT r.id, r.week_key, r.group_id, r.reviewed_at, u.id AS student_id, u.real_name AS student_name
       FROM \`report\` r JOIN \`users\` u ON u.id = r.user_id
       WHERE r.status = 'returned' AND r.reviewed_at IS NOT NULL
         AND r.reviewed_at <= DATE_SUB(NOW(), INTERVAL ${Number(days)} DAY)`
    const [rows] = await this._execute(sql, [], 'listReturnedStale')
    return rows
  }

  // 组内某周统计：已提交数 / 按时数（is_late=0）/ 已批阅数 / 平均评分（仅 reviewed 且有分）
  async statsOfWeek(groupId, weekKey) {
    const sql =
      `SELECT
         COUNT(DISTINCT user_id) AS submitted,
         COUNT(DISTINCT CASE WHEN is_late = 0 THEN user_id END) AS on_time,
         SUM(CASE WHEN status = 'reviewed' THEN 1 ELSE 0 END) AS reviewed,
         AVG(CASE WHEN status = 'reviewed' AND review_score IS NOT NULL THEN review_score END) AS avg_score
       FROM \`report\` WHERE group_id = ? AND week_key = ?
         AND status IN ('submitted', 'returned', 'reviewed')`
    const [rows] = await this._execute(sql, [Number(groupId), weekKey], 'statsOfWeek')
    const r = rows[0] || {}
    return {
      submitted: Number(r.submitted) || 0,
      onTime: Number(r.on_time) || 0,
      reviewed: Number(r.reviewed) || 0,
      avgScore: r.avg_score == null ? null : Number(Number(r.avg_score).toFixed(2))
    }
  }

  // 组内近 N 周逐周统计（趋势图；未提交周补 0）
  async recentWeekStats(groupId, weekKeys) {
    if (!weekKeys || !weekKeys.length) return []
    const marks = weekKeys.map(() => '?').join(', ')
    const sql =
      `SELECT week_key,
         COUNT(DISTINCT user_id) AS submitted,
         COUNT(DISTINCT CASE WHEN is_late = 0 THEN user_id END) AS on_time,
         AVG(CASE WHEN status = 'reviewed' AND review_score IS NOT NULL THEN review_score END) AS avg_score
       FROM \`report\` WHERE group_id = ? AND week_key IN (${marks})
         AND status IN ('submitted', 'returned', 'reviewed')
       GROUP BY week_key`
    const [rows] = await this._execute(sql, [Number(groupId), ...weekKeys], 'recentWeekStats')
    const byWeek = {}
    for (const r of rows) {
      byWeek[r.week_key] = {
        submitted: Number(r.submitted) || 0,
        onTime: Number(r.on_time) || 0,
        avgScore: r.avg_score == null ? null : Number(Number(r.avg_score).toFixed(2))
      }
    }
    return weekKeys.map((k) => ({ weekKey: k, ...(byWeek[k] || { submitted: 0, onTime: 0, avgScore: null }) }))
  }

  // 超管/组管元数据列表（无 content / summary；按周过滤）
  async listMeta(groupId, filters = {}) {
    const { page: p, pageSize, limit, offset } = normalizePage(filters.page)
    const where = ['r.group_id = ?']
    const values = [Number(groupId)]
    if (filters.weekKey) {
      where.push('r.week_key = ?')
      values.push(filters.weekKey)
    }
    if (filters.status && filters.status !== 'all') {
      where.push('r.status = ?')
      values.push(filters.status)
    }
    const whereSql = where.join(' AND ')
    const countSql = `SELECT COUNT(*) AS total FROM \`report\` r WHERE ${whereSql}`
    const [countRows] = await this._execute(countSql, values, 'listMeta.count')
    const total = Number(countRows[0] && countRows[0].total) || 0
    const sql =
      `SELECT r.id, r.user_id, r.week_key, r.title, r.status, r.is_late, r.submitted_at,
              r.reviewed_at, r.created_at, r.updated_at, u.real_name AS student_name, u.username AS student_username
       FROM \`report\` r JOIN \`users\` u ON u.id = r.user_id
       WHERE ${whereSql} ${buildOrderBy(filters, REPORT_SORT_MAP, 'r.week_key DESC, r.user_id ASC')} LIMIT ${limit} OFFSET ${offset}`
    const [rows] = await this._execute(sql, values, 'listMeta')
    return { list: rows, ...buildPageMeta(total, p, pageSize) }
  }

  // 超管强制删除：物理删除（含附件由服务层先删）；返回受影响行数
  async purge(id) {
    const sql = 'DELETE FROM `report` WHERE id = ?'
    const [result] = await this._execute(sql, [Number(id)], 'purge')
    return result.affectedRows
  }

  // 物理删除某课题组全部周报（删除课题组事务内调用，附件先按组删）
  async deleteByGroupId(groupId) {
    const sql = 'DELETE FROM `report` WHERE group_id = ?'
    const [result] = await this._execute(sql, [Number(groupId)], 'deleteByGroupId')
    return result.affectedRows
  }

  // 某用户全部周报 id（删除用户事务内调用，用于级联清理其周报与关联通知）
  async listIdsByUser(userId) {
    const sql = 'SELECT id FROM `report` WHERE user_id = ?'
    const [rows] = await this._execute(sql, [Number(userId)], 'listIdsByUser')
    return rows.map((r) => Number(r.id))
  }

  // 物理删除某用户全部周报（删除用户事务内调用，附件先按用户删）
  async deleteByUser(userId) {
    const sql = 'DELETE FROM `report` WHERE user_id = ?'
    const [result] = await this._execute(sql, [Number(userId)], 'deleteByUser')
    return result.affectedRows
  }
}

module.exports = new ReportRepository()
