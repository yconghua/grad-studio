/**
 * 全局搜索仓库（Repository Layer）—— 各业务模块的模糊查询
 *
 * 每个方法接收关键词（已拼好 % 通配）与可见范围：
 *   - groupIds 为 null 表示不限组（超级管理员）；
 *   - 个人数据查询（文献 / 日志 / 周报 / 档案）按 user_id 限定。
 * 所有查询只读，统一走 BaseRepository._execute。
 */
const BaseRepository = require('./BaseRepository')

const MAX_PER_MODULE = 8 // 每个模块最多返回条数

// 关键词 → LIKE 参数（转义 % _ 通配符，避免用户输入干扰匹配）
function likeParam(kw) {
  return `%${kw.replace(/[\\%_]/g, (m) => '\\' + m)}%`
}

// 生成 IN (?,?,...) 占位符（execute 预编译不支持数组参数，需显式展开）
function inSql(ids) {
  return ids.map(() => '?').join(',')
}

class SearchRepository extends BaseRepository {
  constructor() {
    super('user')
  }

  // 课题组（按名称/编号）
  async searchGroups(kw) {
    const [rows] = await this._execute(
      `SELECT g.id, g.name, g.code, g.status
         FROM \`group\` AS g
        WHERE g.is_deleted = 0 AND (g.name LIKE ? OR g.code LIKE ?)
        ORDER BY g.id ASC LIMIT ${MAX_PER_MODULE}`,
      [likeParam(kw), likeParam(kw)],
      'search:groups'
    )
    return rows
  }

  // 成员（按账号/姓名）
  // groupIds 为 null 不限组；studentIds 不为 null 时仅搜指定学生（导师名下）
  async searchMembers(kw, groupIds, studentIds) {
    const params = []
    let groupSql = ''
    let studentSql = ''
    if (groupIds) {
      groupSql = ` AND ug.group_id IN (${inSql(groupIds)})`
      params.push(...groupIds)
    }
    if (studentIds) {
      studentSql = ` AND ug.user_id IN (${inSql(studentIds)})`
      params.push(...studentIds)
    }
    params.push(likeParam(kw), likeParam(kw))
    const [rows] = await this._execute(
      `SELECT ug.id, ug.user_id, ug.group_id, ug.role_in_group,
              u.username, p.real_name,
              g.name AS group_name, g.code AS group_code
         FROM \`user_group\` AS ug
         LEFT JOIN \`user\` AS u ON u.id = ug.user_id AND u.is_deleted = 0
         LEFT JOIN \`user_profile\` AS p ON p.user_id = ug.user_id AND p.is_deleted = 0
         LEFT JOIN \`group\` AS g ON g.id = ug.group_id AND g.is_deleted = 0
        WHERE ug.is_deleted = 0${groupSql}${studentSql}
          AND (u.username LIKE ? OR p.real_name LIKE ?)
        ORDER BY ug.id ASC LIMIT ${MAX_PER_MODULE}`,
      params,
      'search:members'
    )
    return rows
  }

  // 公告（按标题/内容）
  async searchNotices(kw, groupIds) {
    const params = []
    let groupSql = ''
    if (groupIds) {
      groupSql = ` AND n.group_id IN (${inSql(groupIds)})`
      params.push(...groupIds)
    }
    params.push(likeParam(kw), likeParam(kw))
    const [rows] = await this._execute(
      `SELECT n.id, n.group_id, n.title, n.status,
              g.name AS group_name
         FROM \`notice\` AS n
         LEFT JOIN \`group\` AS g ON g.id = n.group_id AND g.is_deleted = 0
        WHERE n.is_deleted = 0${groupSql}
          AND (n.title LIKE ? OR n.content LIKE ?)
        ORDER BY n.id DESC LIMIT ${MAX_PER_MODULE}`,
      params,
      'search:notices'
    )
    return rows
  }

  // 组会（按标题）
  async searchMeetings(kw, groupIds) {
    const params = []
    let groupSql = ''
    if (groupIds) {
      groupSql = ` AND m.group_id IN (${inSql(groupIds)})`
      params.push(...groupIds)
    }
    params.push(likeParam(kw))
    const [rows] = await this._execute(
      `SELECT m.id, m.group_id, m.title, m.meeting_type, m.start_time,
              g.name AS group_name
         FROM \`meeting\` AS m
         LEFT JOIN \`group\` AS g ON g.id = m.group_id AND g.is_deleted = 0
        WHERE m.is_deleted = 0${groupSql} AND m.title LIKE ?
        ORDER BY m.id DESC LIMIT ${MAX_PER_MODULE}`,
      params,
      'search:meetings'
    )
    return rows
  }

  // 课题（按名称/编号）
  async searchSubjects(kw, groupIds) {
    const params = []
    let groupSql = ''
    if (groupIds) {
      groupSql = ` AND s.group_id IN (${inSql(groupIds)})`
      params.push(...groupIds)
    }
    params.push(likeParam(kw), likeParam(kw))
    const [rows] = await this._execute(
      `SELECT s.id, s.group_id, s.name, s.code, s.status,
              g.name AS group_name
         FROM \`subject\` AS s
         LEFT JOIN \`group\` AS g ON g.id = s.group_id AND g.is_deleted = 0
        WHERE s.is_deleted = 0${groupSql}
          AND (s.name LIKE ? OR s.code LIKE ?)
        ORDER BY s.id DESC LIMIT ${MAX_PER_MODULE}`,
      params,
      'search:subjects'
    )
    return rows
  }

  // 任务（按标题）
  async searchTasks(kw, groupIds) {
    const params = []
    let groupSql = ''
    if (groupIds) {
      groupSql = ` AND t.group_id IN (${inSql(groupIds)})`
      params.push(...groupIds)
    }
    params.push(likeParam(kw))
    const [rows] = await this._execute(
      `SELECT t.id, t.group_id, t.title, t.status, t.assignee_id,
              g.name AS group_name
         FROM \`task\` AS t
         LEFT JOIN \`group\` AS g ON g.id = t.group_id AND g.is_deleted = 0
        WHERE t.is_deleted = 0${groupSql} AND t.title LIKE ?
        ORDER BY t.id DESC LIMIT ${MAX_PER_MODULE}`,
      params,
      'search:tasks'
    )
    return rows
  }

  // 学位节点（按名称）
  async searchDegreeNodes(kw, groupIds) {
    const params = []
    let groupSql = ''
    if (groupIds) {
      groupSql = ` AND dn.group_id IN (${inSql(groupIds)})`
      params.push(...groupIds)
    }
    params.push(likeParam(kw))
    const [rows] = await this._execute(
      `SELECT dn.id, dn.group_id, dn.name, dn.node_order,
              g.name AS group_name
         FROM \`degree_node\` AS dn
         LEFT JOIN \`group\` AS g ON g.id = dn.group_id AND g.is_deleted = 0
        WHERE dn.is_deleted = 0${groupSql} AND dn.name LIKE ?
        ORDER BY dn.node_order ASC LIMIT ${MAX_PER_MODULE}`,
      params,
      'search:degreeNodes'
    )
    return rows
  }

  // 学生学位记录（按节点名/学生账号/姓名）
  async searchDegreeRecords(kw, groupIds) {
    const params = []
    let groupSql = ''
    if (groupIds) {
      groupSql = ` AND sd.group_id IN (${inSql(groupIds)})`
      params.push(...groupIds)
    }
    params.push(likeParam(kw), likeParam(kw), likeParam(kw))
    const [rows] = await this._execute(
      `SELECT sd.id, sd.group_id, sd.student_id, sd.status,
              dn.name AS node_name,
              u.username AS student_username, p.real_name AS student_real_name,
              g.name AS group_name
         FROM \`student_degree\` AS sd
         LEFT JOIN \`degree_node\` AS dn ON dn.id = sd.node_id AND dn.is_deleted = 0
         LEFT JOIN \`user\` AS u ON u.id = sd.student_id AND u.is_deleted = 0
         LEFT JOIN \`user_profile\` AS p ON p.user_id = sd.student_id AND p.is_deleted = 0
         LEFT JOIN \`group\` AS g ON g.id = sd.group_id AND g.is_deleted = 0
        WHERE sd.is_deleted = 0${groupSql}
          AND (dn.name LIKE ? OR u.username LIKE ? OR p.real_name LIKE ?)
        ORDER BY sd.id DESC LIMIT ${MAX_PER_MODULE}`,
      params,
      'search:degreeRecords'
    )
    return rows
  }

  // 科研成果（按标题/类型）
  async searchAchievements(kw, groupIds) {
    const params = []
    let groupSql = ''
    if (groupIds) {
      groupSql = ` AND a.group_id IN (${inSql(groupIds)})`
      params.push(...groupIds)
    }
    params.push(likeParam(kw), likeParam(kw))
    const [rows] = await this._execute(
      `SELECT a.id, a.group_id, a.user_id, a.title, a.ach_type, a.status,
              u.username, p.real_name,
              g.name AS group_name
         FROM \`achievement\` AS a
         LEFT JOIN \`user\` AS u ON u.id = a.user_id AND u.is_deleted = 0
         LEFT JOIN \`user_profile\` AS p ON p.user_id = a.user_id AND p.is_deleted = 0
         LEFT JOIN \`group\` AS g ON g.id = a.group_id AND g.is_deleted = 0
        WHERE a.is_deleted = 0${groupSql}
          AND (a.title LIKE ? OR a.ach_type LIKE ?)
        ORDER BY a.id DESC LIMIT ${MAX_PER_MODULE}`,
      params,
      'search:achievements'
    )
    return rows
  }

  // 知识库节点（按名称）
  async searchKnowledge(kw, groupIds) {
    const params = []
    let groupSql = ''
    if (groupIds) {
      groupSql = ` AND k.group_id IN (${inSql(groupIds)})`
      params.push(...groupIds)
    }
    params.push(likeParam(kw))
    const [rows] = await this._execute(
      `SELECT k.id, k.group_id, k.name, k.node_type,
              g.name AS group_name
         FROM \`knowledge\` AS k
         LEFT JOIN \`group\` AS g ON g.id = k.group_id AND g.is_deleted = 0
        WHERE k.is_deleted = 0${groupSql} AND k.name LIKE ?
        ORDER BY k.sort_order ASC LIMIT ${MAX_PER_MODULE}`,
      params,
      'search:knowledge'
    )
    return rows
  }

  // 文献（按标题/作者，限定用户）
  async searchLiteratures(kw, userId) {
    const [rows] = await this._execute(
      `SELECT l.id, l.user_id, l.title, l.authors, l.source, l.year
         FROM \`literature\` AS l
        WHERE l.is_deleted = 0 AND l.user_id = ?
          AND (l.title LIKE ? OR l.authors LIKE ?)
        ORDER BY l.id DESC LIMIT ${MAX_PER_MODULE}`,
      [userId, likeParam(kw), likeParam(kw)],
      'search:literatures'
    )
    return rows
  }

  // 科研日志（按内容/标签，限定用户）
  async searchResearchLogs(kw, userId) {
    const [rows] = await this._execute(
      `SELECT rl.id, rl.student_id, rl.log_date, rl.content, rl.tags
         FROM \`research_log\` AS rl
        WHERE rl.is_deleted = 0 AND rl.student_id = ?
          AND (rl.content LIKE ? OR rl.tags LIKE ?)
        ORDER BY rl.log_date DESC LIMIT ${MAX_PER_MODULE}`,
      [userId, likeParam(kw), likeParam(kw)],
      'search:researchLogs'
    )
    return rows
  }

  // 周报（按工作/计划/问题内容，限定用户）
  async searchWeeklyReports(kw, userId) {
    const [rows] = await this._execute(
      `SELECT wr.id, wr.student_id, wr.week_start, wr.week_end, wr.status,
              wr.work_content
         FROM \`weekly_report\` AS wr
        WHERE wr.is_deleted = 0 AND wr.student_id = ?
          AND (wr.work_content LIKE ? OR wr.plan_content LIKE ? OR wr.problem_content LIKE ?)
        ORDER BY wr.week_start DESC LIMIT ${MAX_PER_MODULE}`,
      [userId, likeParam(kw), likeParam(kw), likeParam(kw)],
      'search:weeklyReports'
    )
    return rows
  }

  // 科研档案（按标题/内容，限定用户）
  async searchArchives(kw, userId) {
    const [rows] = await this._execute(
      `SELECT ar.id, ar.user_id, ar.title, ar.record_type, ar.record_date
         FROM \`archive_record\` AS ar
        WHERE ar.is_deleted = 0 AND ar.user_id = ?
          AND (ar.title LIKE ? OR ar.content LIKE ?)
        ORDER BY ar.record_date DESC LIMIT ${MAX_PER_MODULE}`,
      [userId, likeParam(kw), likeParam(kw)],
      'search:archives'
    )
    return rows
  }

  // 用户当前所在的课题组 id 列表（活跃状态）
  async myGroupIds(userId) {
    const [rows] = await this._execute(
      `SELECT group_id FROM \`user_group\` WHERE user_id = ? AND is_deleted = 0 AND status = 'active'`,
      [userId],
      'search:myGroups'
    )
    return rows.map((r) => r.group_id)
  }

  // 导师名下学生的 id 列表（活跃关系）
  async myStudentIds(mentorId) {
    const [rows] = await this._execute(
      `SELECT student_id FROM \`mentor_student\` WHERE mentor_id = ? AND is_deleted = 0 AND status = 'active'`,
      [mentorId],
      'search:myStudents'
    )
    return rows.map((r) => r.student_id)
  }

  // 全部文献（超管，不限用户）
  async searchAllLiteratures(kw) {
    const [rows] = await this._execute(
      `SELECT l.id, l.user_id, l.title, l.authors, l.source, l.year,
              u.username, p.real_name
         FROM \`literature\` AS l
         LEFT JOIN \`user\` AS u ON u.id = l.user_id AND u.is_deleted = 0
         LEFT JOIN \`user_profile\` AS p ON p.user_id = l.user_id AND p.is_deleted = 0
        WHERE l.is_deleted = 0 AND (l.title LIKE ? OR l.authors LIKE ?)
        ORDER BY l.id DESC LIMIT ${MAX_PER_MODULE}`,
      [likeParam(kw), likeParam(kw)],
      'search:literatures'
    )
    return rows
  }

  // 全部科研日志（超管）
  async searchAllResearchLogs(kw) {
    const [rows] = await this._execute(
      `SELECT rl.id, rl.student_id, rl.log_date, rl.content, rl.tags,
              u.username, p.real_name
         FROM \`research_log\` AS rl
         LEFT JOIN \`user\` AS u ON u.id = rl.student_id AND u.is_deleted = 0
         LEFT JOIN \`user_profile\` AS p ON p.user_id = rl.student_id AND p.is_deleted = 0
        WHERE rl.is_deleted = 0 AND (rl.content LIKE ? OR rl.tags LIKE ?)
        ORDER BY rl.log_date DESC LIMIT ${MAX_PER_MODULE}`,
      [likeParam(kw), likeParam(kw)],
      'search:researchLogs'
    )
    return rows
  }

  // 全部周报（超管）
  async searchAllWeeklyReports(kw) {
    const [rows] = await this._execute(
      `SELECT wr.id, wr.student_id, wr.week_start, wr.week_end, wr.status,
              wr.work_content,
              u.username, p.real_name
         FROM \`weekly_report\` AS wr
         LEFT JOIN \`user\` AS u ON u.id = wr.student_id AND u.is_deleted = 0
         LEFT JOIN \`user_profile\` AS p ON p.user_id = wr.student_id AND p.is_deleted = 0
        WHERE wr.is_deleted = 0
          AND (wr.work_content LIKE ? OR wr.plan_content LIKE ? OR wr.problem_content LIKE ?)
        ORDER BY wr.week_start DESC LIMIT ${MAX_PER_MODULE}`,
      [likeParam(kw), likeParam(kw), likeParam(kw)],
      'search:weeklyReports'
    )
    return rows
  }

  // 全部科研档案（超管）
  async searchAllArchives(kw) {
    const [rows] = await this._execute(
      `SELECT ar.id, ar.user_id, ar.title, ar.record_type, ar.record_date,
              u.username, p.real_name
         FROM \`archive_record\` AS ar
         LEFT JOIN \`user\` AS u ON u.id = ar.user_id AND u.is_deleted = 0
         LEFT JOIN \`user_profile\` AS p ON p.user_id = ar.user_id AND p.is_deleted = 0
        WHERE ar.is_deleted = 0 AND (ar.title LIKE ? OR ar.content LIKE ?)
        ORDER BY ar.record_date DESC LIMIT ${MAX_PER_MODULE}`,
      [likeParam(kw), likeParam(kw)],
      'search:archives'
    )
    return rows
  }
}

module.exports = new SearchRepository()
