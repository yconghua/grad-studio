/**
 * 数据总览仓库（Repository Layer）—— 超级管理员专用只读查询
 *
 * 以「主体」为维度集中浏览业务数据：
 *   - 按课题组：组成员 / 师生关系 / 公告 / 学位 / 组会 / 课题 / 任务 / 周报 / 成果 / 知识库 / 配置
 *   - 按用户：账号档案 / 所属组 / 师生关系 / 科研日志 / 周报 / 文献 / 档案 / 成果 / 任务 / 消息 / 操作日志
 * 全部为只读查询，统一走 BaseRepository._execute 的连接与日志机制。
 * 注意：_execute 返回 [rows, fields] 结构，取值统一解构第一项为 rows。
 */
const BaseRepository = require('./BaseRepository')

const MAX_ROWS = 500 // 单模块最多返回条数，避免响应过大

class OverviewRepository extends BaseRepository {
  constructor() {
    super('user')
  }

  // 全部课题组（含管理员账号与各模块计数）
  async listGroups() {
    const sql = `SELECT g.id, g.name, g.code, g.description, g.status, g.created_at, g.updated_at,
      \`admin\`.\`username\` AS \`admin_username\`,
      (SELECT COUNT(*) FROM \`user_group\` ug WHERE ug.group_id = g.id AND ug.is_deleted = 0) AS member_count,
      (SELECT COUNT(*) FROM \`notice\` n WHERE n.group_id = g.id AND n.is_deleted = 0) AS notice_count,
      (SELECT COUNT(*) FROM \`degree_node\` dn WHERE dn.group_id = g.id AND dn.is_deleted = 0) AS node_count,
      (SELECT COUNT(*) FROM \`meeting\` m WHERE m.group_id = g.id AND m.is_deleted = 0) AS meeting_count,
      (SELECT COUNT(*) FROM \`subject\` s WHERE s.group_id = g.id AND s.is_deleted = 0) AS subject_count,
      (SELECT COUNT(*) FROM \`task\` t WHERE t.group_id = g.id AND t.is_deleted = 0) AS task_count
      FROM \`group\` AS g
      LEFT JOIN \`user_group\` AS \`ug_admin\` ON \`ug_admin\`.\`group_id\` = g.id
        AND \`ug_admin\`.\`role_in_group\` = 'group_admin' AND \`ug_admin\`.\`is_deleted\` = 0
      LEFT JOIN \`user\` AS \`admin\` ON \`admin\`.\`id\` = \`ug_admin\`.\`user_id\` AND \`admin\`.\`is_deleted\` = 0
      WHERE g.is_deleted = 0
      ORDER BY g.id ASC`
    const [rows] = await this._execute(sql, [], 'overview:groups')
    return rows
  }

  // 单个课题组详情（全部业务模块）
  async groupDetail(groupId) {
    const [groupRows] = await this._execute(`SELECT g.id, g.name, g.code, g.description, g.status, g.created_at, g.updated_at,
        \`admin\`.\`username\` AS \`admin_username\`
        FROM \`group\` AS g
        LEFT JOIN \`user_group\` AS \`ug_admin\` ON \`ug_admin\`.\`group_id\` = g.id
          AND \`ug_admin\`.\`role_in_group\` = 'group_admin' AND \`ug_admin\`.\`is_deleted\` = 0
        LEFT JOIN \`user\` AS \`admin\` ON \`admin\`.\`id\` = \`ug_admin\`.\`user_id\` AND \`admin\`.\`is_deleted\` = 0
        WHERE g.id = ? AND g.is_deleted = 0 LIMIT 1`, [groupId], 'overview:group')
    const group = groupRows[0]
    if (!group) return null
    const data = { group }

    // 成员：user_group 联 user / user_profile
    const [members] = await this._execute(`SELECT ug.id, ug.user_id, ug.role_in_group, ug.status AS member_status,
        ug.joined_at, ug.left_at, ug.remark,
        u.username, p.real_name
        FROM \`user_group\` AS ug
        LEFT JOIN \`user\` AS u ON u.id = ug.user_id AND u.is_deleted = 0
        LEFT JOIN \`user_profile\` AS p ON p.user_id = ug.user_id AND p.is_deleted = 0
        WHERE ug.group_id = ? AND ug.is_deleted = 0
        ORDER BY ug.id ASC`, [groupId], 'overview:members')
    data.members = members

    // 师生关系
    const [mentorStudents] = await this._execute(`SELECT ms.id, ms.mentor_id, ms.student_id, ms.status, ms.remark, ms.created_at,
        mu.username AS mentor_username, mp.real_name AS mentor_real_name,
        su.username AS student_username, sp.real_name AS student_real_name
        FROM \`mentor_student\` AS ms
        LEFT JOIN \`user\` AS mu ON mu.id = ms.mentor_id AND mu.is_deleted = 0
        LEFT JOIN \`user_profile\` AS mp ON mp.user_id = ms.mentor_id AND mp.is_deleted = 0
        LEFT JOIN \`user\` AS su ON su.id = ms.student_id AND su.is_deleted = 0
        LEFT JOIN \`user_profile\` AS sp ON sp.user_id = ms.student_id AND sp.is_deleted = 0
        WHERE ms.group_id = ? AND ms.is_deleted = 0
        ORDER BY ms.id DESC`, [groupId], 'overview:mentorStudents')
    data.mentorStudents = mentorStudents

    // 公告（附发布人账号）
    const [notices] = await this._execute(`SELECT n.id, n.title, n.content, n.is_top, n.status, n.published_at, n.created_at,
        u.username AS publisher_username
        FROM \`notice\` AS n
        LEFT JOIN \`user\` AS u ON u.id = n.publisher_id AND u.is_deleted = 0
        WHERE n.group_id = ? AND n.is_deleted = 0
        ORDER BY n.id DESC LIMIT ${MAX_ROWS}`, [groupId], 'overview:notices')
    data.notices = notices

    // 学位节点
    const [degreeNodes] = await this._execute(`SELECT id, name, node_order, description, is_required, created_at
        FROM \`degree_node\` WHERE group_id = ? AND is_deleted = 0 ORDER BY node_order ASC, id ASC`,
        [groupId], 'overview:degreeNodes')
    data.degreeNodes = degreeNodes

    // 学位记录（附学生名与节点名）
    const [degreeRecords] = await this._execute(`SELECT sd.id, sd.student_id, sd.node_id, sd.status, sd.complete_date, sd.score, sd.remark, sd.updated_at,
        u.username AS student_username, p.real_name AS student_real_name,
        dn.name AS node_name
        FROM \`student_degree\` AS sd
        LEFT JOIN \`user\` AS u ON u.id = sd.student_id AND u.is_deleted = 0
        LEFT JOIN \`user_profile\` AS p ON p.user_id = sd.student_id AND p.is_deleted = 0
        LEFT JOIN \`degree_node\` AS dn ON dn.id = sd.node_id AND dn.is_deleted = 0
        WHERE sd.group_id = ? AND sd.is_deleted = 0
        ORDER BY sd.id DESC LIMIT ${MAX_ROWS}`, [groupId], 'overview:degreeRecords')
    data.degreeRecords = degreeRecords

    // 组会
    const [meetings] = await this._execute(`SELECT id, title, meeting_type, location, start_time, end_time, host_id, agenda, status, created_at
        FROM \`meeting\` WHERE group_id = ? AND is_deleted = 0 ORDER BY id DESC LIMIT ${MAX_ROWS}`,
        [groupId], 'overview:meetings')
    data.meetings = meetings

    // 组会汇报
    const [meetingReports] = await this._execute(`SELECT mr.id, mr.meeting_id, mr.student_id, mr.topic, mr.content, mr.status, mr.review_comment, mr.reviewed_at, mr.created_at,
        m.title AS meeting_title,
        u.username AS student_username, p.real_name AS student_real_name
        FROM \`meeting_report\` AS mr
        LEFT JOIN \`meeting\` AS m ON m.id = mr.meeting_id AND m.is_deleted = 0
        LEFT JOIN \`user\` AS u ON u.id = mr.student_id AND u.is_deleted = 0
        LEFT JOIN \`user_profile\` AS p ON p.user_id = mr.student_id AND p.is_deleted = 0
        WHERE m.group_id = ? AND mr.is_deleted = 0
        ORDER BY mr.id DESC LIMIT ${MAX_ROWS}`, [groupId], 'overview:meetingReports')
    data.meetingReports = meetingReports

    // 课题
    const [subjects] = await this._execute(`SELECT id, name, code, subject_type, description, leader_id, status, start_date, end_date, funding, source, remark, created_at
        FROM \`subject\` WHERE group_id = ? AND is_deleted = 0 ORDER BY id DESC LIMIT ${MAX_ROWS}`,
        [groupId], 'overview:subjects')
    data.subjects = subjects

    // 课题成员
    const [subjectMembers] = await this._execute(`SELECT sm.id, sm.subject_id, sm.user_id, sm.role_in_subject, sm.join_date, sm.quit_date, sm.status,
        s.name AS subject_name,
        u.username, p.real_name
        FROM \`subject_member\` AS sm
        LEFT JOIN \`subject\` AS s ON s.id = sm.subject_id AND s.is_deleted = 0
        LEFT JOIN \`user\` AS u ON u.id = sm.user_id AND u.is_deleted = 0
        LEFT JOIN \`user_profile\` AS p ON p.user_id = sm.user_id AND p.is_deleted = 0
        WHERE s.group_id = ? AND sm.is_deleted = 0
        ORDER BY sm.id DESC LIMIT ${MAX_ROWS}`, [groupId], 'overview:subjectMembers')
    data.subjectMembers = subjectMembers

    // 任务
    const [tasks] = await this._execute(`SELECT id, title, description, subject_id, assigner_id, assignee_id, priority, status, progress_percent, deadline, completed_at, remark, created_at
        FROM \`task\` WHERE group_id = ? AND is_deleted = 0 ORDER BY id DESC LIMIT ${MAX_ROWS}`,
        [groupId], 'overview:tasks')
    data.tasks = tasks

    // 任务进展（按组内任务）
    const [taskProgress] = await this._execute(`SELECT tp.id, tp.task_id, tp.user_id, tp.content, tp.progress_percent, tp.attachment, tp.created_at,
        t.title AS task_title,
        u.username, p.real_name
        FROM \`task_progress\` AS tp
        LEFT JOIN \`task\` AS t ON t.id = tp.task_id AND t.is_deleted = 0
        LEFT JOIN \`user\` AS u ON u.id = tp.user_id AND u.is_deleted = 0
        LEFT JOIN \`user_profile\` AS p ON p.user_id = tp.user_id AND p.is_deleted = 0
        WHERE t.group_id = ? AND tp.is_deleted = 0
        ORDER BY tp.id DESC LIMIT ${MAX_ROWS}`, [groupId], 'overview:taskProgress')
    data.taskProgress = taskProgress

    // 周报（学生归属当前组）
    const [weeklyReports] = await this._execute(`SELECT wr.id, wr.student_id, wr.week_start, wr.week_end, wr.status, wr.submitted_at, wr.reviewed_by, wr.review_comment, wr.reviewed_at, wr.created_at,
        u.username AS student_username, p.real_name AS student_real_name
        FROM \`weekly_report\` AS wr
        LEFT JOIN \`user_group\` AS ug ON ug.user_id = wr.student_id AND ug.is_deleted = 0
        LEFT JOIN \`user\` AS u ON u.id = wr.student_id AND u.is_deleted = 0
        LEFT JOIN \`user_profile\` AS p ON p.user_id = wr.student_id AND p.is_deleted = 0
        WHERE ug.group_id = ? AND wr.is_deleted = 0
        ORDER BY wr.id DESC LIMIT ${MAX_ROWS}`, [groupId], 'overview:weeklyReports')
    data.weeklyReports = weeklyReports

    // 科研成果
    const [achievements] = await this._execute(`SELECT id, user_id, ach_type, title, description, status, submit_date, audit_by, audit_comment, audit_at, remark, created_at
        FROM \`achievement\` WHERE group_id = ? AND is_deleted = 0 ORDER BY id DESC LIMIT ${MAX_ROWS}`,
        [groupId], 'overview:achievements')
    data.achievements = achievements

    // 知识库节点
    const [knowledge] = await this._execute(`SELECT id, parent_id, name, node_type, description, sort_order, created_by, created_at
        FROM \`knowledge\` WHERE group_id = ? AND is_deleted = 0 ORDER BY sort_order ASC, id ASC LIMIT ${MAX_ROWS}`,
        [groupId], 'overview:knowledge')
    data.knowledge = knowledge

    // 知识库文件
    const [knowledgeFiles] = await this._execute(`SELECT kf.id, kf.knowledge_id, kf.title, kf.file_path, kf.file_size, kf.file_type, kf.uploaded_by, kf.download_count, kf.status, kf.created_at,
        k.name AS knowledge_name,
        u.username AS uploader_username
        FROM \`knowledge_file\` AS kf
        LEFT JOIN \`knowledge\` AS k ON k.id = kf.knowledge_id AND k.is_deleted = 0
        LEFT JOIN \`user\` AS u ON u.id = kf.uploaded_by AND u.is_deleted = 0
        WHERE kf.group_id = ? AND kf.is_deleted = 0
        ORDER BY kf.id DESC LIMIT ${MAX_ROWS}`, [groupId], 'overview:knowledgeFiles')
    data.knowledgeFiles = knowledgeFiles

    // 组配置
    const [groupSettings] = await this._execute(`SELECT id, config_key, config_value, description, updated_by, updated_at
        FROM \`group_setting\` WHERE group_id = ? AND is_deleted = 0 ORDER BY id ASC`, [groupId], 'overview:groupSettings')
    data.groupSettings = groupSettings

    return data
  }

  // 全部用户（含真实姓名与所属课题组文本）
  async listUsers(role) {
    const params = []
    let roleSql = ''
    if (role) {
      roleSql = ' AND u.role = ?'
      params.push(role)
    }
    const sql = `SELECT u.id, u.username, u.role, u.status, u.must_change_password,
        p.real_name,
        (SELECT GROUP_CONCAT(CONCAT(g.name, '(', g.code, ')') SEPARATOR '、')
         FROM \`user_group\` AS ug JOIN \`group\` AS g ON g.id = ug.group_id
         WHERE ug.user_id = u.id AND ug.is_deleted = 0 AND g.is_deleted = 0) AS groups_text
        FROM \`user\` AS u
        LEFT JOIN \`user_profile\` AS p ON p.user_id = u.id AND p.is_deleted = 0
        WHERE u.is_deleted = 0${roleSql}
        ORDER BY u.id ASC LIMIT ${MAX_ROWS}`
    const [rows] = await this._execute(sql, params, 'overview:users')
    return rows
  }

  // 单个用户详情（全部业务模块）
  async userDetail(userId) {
    const [userRows] = await this._execute(`SELECT u.id, u.username, u.role, u.status, u.must_change_password, u.is_deleted
        FROM \`user\` AS u WHERE u.id = ?`, [userId], 'overview:user')
    const user = userRows[0]
    if (!user || user.is_deleted) return null
    delete user.is_deleted
    const data = { user }

    // 个人档案
    const [profileRows] = await this._execute(`SELECT id, user_id, real_name, gender, student_no, email, phone, college, department, major, grade, degree_type, position, bio, join_date, created_at, updated_at
        FROM \`user_profile\` WHERE user_id = ? AND is_deleted = 0 LIMIT 1`, [userId], 'overview:profile')
    data.profile = profileRows[0] || null

    // 所属课题组
    const [groups] = await this._execute(`SELECT ug.id, ug.group_id, ug.role_in_group, ug.status AS member_status, ug.joined_at, ug.left_at, ug.remark,
        g.name AS group_name, g.code AS group_code
        FROM \`user_group\` AS ug
        LEFT JOIN \`group\` AS g ON g.id = ug.group_id AND g.is_deleted = 0
        WHERE ug.user_id = ? AND ug.is_deleted = 0
        ORDER BY ug.id ASC`, [userId], 'overview:userGroups')
    data.groups = groups

    // 作为学生：指导老师
    const [mentors] = await this._execute(`SELECT ms.id, ms.group_id, ms.mentor_id, ms.status, ms.remark,
        g.name AS group_name,
        u.username AS mentor_username, p.real_name AS mentor_real_name
        FROM \`mentor_student\` AS ms
        LEFT JOIN \`group\` AS g ON g.id = ms.group_id AND g.is_deleted = 0
        LEFT JOIN \`user\` AS u ON u.id = ms.mentor_id AND u.is_deleted = 0
        LEFT JOIN \`user_profile\` AS p ON p.user_id = ms.mentor_id AND p.is_deleted = 0
        WHERE ms.student_id = ? AND ms.is_deleted = 0
        ORDER BY ms.id DESC`, [userId], 'overview:mentors')
    data.mentors = mentors

    // 作为导师：名下学生
    const [mentorStudents] = await this._execute(`SELECT ms.id, ms.group_id, ms.student_id, ms.status, ms.remark,
        g.name AS group_name,
        u.username AS student_username, p.real_name AS student_real_name
        FROM \`mentor_student\` AS ms
        LEFT JOIN \`group\` AS g ON g.id = ms.group_id AND g.is_deleted = 0
        LEFT JOIN \`user\` AS u ON u.id = ms.student_id AND u.is_deleted = 0
        LEFT JOIN \`user_profile\` AS p ON p.user_id = ms.student_id AND p.is_deleted = 0
        WHERE ms.mentor_id = ? AND ms.is_deleted = 0
        ORDER BY ms.id DESC LIMIT ${MAX_ROWS}`, [userId], 'overview:mentorStudents')
    data.mentorStudents = mentorStudents

    // 科研日志
    const [researchLogs] = await this._execute(`SELECT id, student_id, log_date, content, tags, attachment, created_at
        FROM \`research_log\` WHERE student_id = ? AND is_deleted = 0 ORDER BY log_date DESC, id DESC LIMIT ${MAX_ROWS}`,
        [userId], 'overview:researchLogs')
    data.researchLogs = researchLogs

    // 周报
    const [weeklyReports] = await this._execute(`SELECT id, week_start, week_end, status, submitted_at, reviewed_by, review_comment, reviewed_at, created_at
        FROM \`weekly_report\` WHERE student_id = ? AND is_deleted = 0 ORDER BY week_start DESC, id DESC LIMIT ${MAX_ROWS}`,
        [userId], 'overview:weeklyReports')
    data.weeklyReports = weeklyReports

    // 学位记录
    const [degreeRecords] = await this._execute(`SELECT sd.id, sd.node_id, sd.group_id, sd.status, sd.complete_date, sd.score, sd.remark, sd.updated_at,
        dn.name AS node_name, g.name AS group_name
        FROM \`student_degree\` AS sd
        LEFT JOIN \`degree_node\` AS dn ON dn.id = sd.node_id AND dn.is_deleted = 0
        LEFT JOIN \`group\` AS g ON g.id = sd.group_id AND g.is_deleted = 0
        WHERE sd.student_id = ? AND sd.is_deleted = 0
        ORDER BY sd.id DESC LIMIT ${MAX_ROWS}`, [userId], 'overview:degreeRecords')
    data.degreeRecords = degreeRecords

    // 文献
    const [literatures] = await this._execute(`SELECT id, title, authors, source, source_type, year, doi, url, tags, read_status, rating, created_at
        FROM \`literature\` WHERE user_id = ? AND is_deleted = 0 ORDER BY id DESC LIMIT ${MAX_ROWS}`,
        [userId], 'overview:literatures')
    data.literatures = literatures

    // 文献笔记
    const [literatureNotes] = await this._execute(`SELECT ln.id, ln.literature_id, ln.content, ln.created_at,
        l.title AS literature_title
        FROM \`literature_note\` AS ln
        LEFT JOIN \`literature\` AS l ON l.id = ln.literature_id AND l.is_deleted = 0
        WHERE ln.user_id = ? AND ln.is_deleted = 0
        ORDER BY ln.id DESC LIMIT ${MAX_ROWS}`, [userId], 'overview:literatureNotes')
    data.literatureNotes = literatureNotes

    // 科研档案
    const [archives] = await this._execute(`SELECT id, record_type, title, content, record_date, attachment, created_at
        FROM \`archive_record\` WHERE user_id = ? AND is_deleted = 0 ORDER BY record_date DESC, id DESC LIMIT ${MAX_ROWS}`,
        [userId], 'overview:archives')
    data.archives = archives

    // 科研成果
    const [achievements] = await this._execute(`SELECT id, group_id, ach_type, title, description, status, submit_date, audit_by, audit_comment, audit_at, remark, created_at
        FROM \`achievement\` WHERE user_id = ? AND is_deleted = 0 ORDER BY id DESC LIMIT ${MAX_ROWS}`,
        [userId], 'overview:achievements')
    data.achievements = achievements

    // 论文
    const [papers] = await this._execute(`SELECT id, title, authors, journal, conference, level_desc, status, is_first_author, submit_date, accept_date, publish_date, doi, created_at
        FROM \`paper\` WHERE user_id = ? AND is_deleted = 0 ORDER BY id DESC LIMIT ${MAX_ROWS}`,
        [userId], 'overview:papers')
    data.papers = papers

    // 作为执行人的任务
    const [tasksAsAssignee] = await this._execute(`SELECT id, group_id, subject_id, title, description, assigner_id, priority, status, progress_percent, deadline, completed_at, created_at
        FROM \`task\` WHERE assignee_id = ? AND is_deleted = 0 ORDER BY id DESC LIMIT ${MAX_ROWS}`,
        [userId], 'overview:tasksAsAssignee')
    data.tasksAsAssignee = tasksAsAssignee

    // 作为创建人的任务
    const [tasksAsAssigner] = await this._execute(`SELECT id, group_id, subject_id, title, description, assignee_id, priority, status, progress_percent, deadline, completed_at, created_at
        FROM \`task\` WHERE assigner_id = ? AND is_deleted = 0 ORDER BY id DESC LIMIT ${MAX_ROWS}`,
        [userId], 'overview:tasksAsAssigner')
    data.tasksAsAssigner = tasksAsAssigner

    // 任务进展
    const [taskProgress] = await this._execute(`SELECT tp.id, tp.task_id, tp.content, tp.progress_percent, tp.attachment, tp.created_at,
        t.title AS task_title
        FROM \`task_progress\` AS tp
        LEFT JOIN \`task\` AS t ON t.id = tp.task_id AND t.is_deleted = 0
        WHERE tp.user_id = ? AND tp.is_deleted = 0
        ORDER BY tp.id DESC LIMIT ${MAX_ROWS}`, [userId], 'overview:taskProgress')
    data.taskProgress = taskProgress

    // 组会汇报
    const [meetingReports] = await this._execute(`SELECT mr.id, mr.meeting_id, mr.topic, mr.content, mr.status, mr.review_comment, mr.reviewed_at, mr.created_at,
        m.title AS meeting_title
        FROM \`meeting_report\` AS mr
        LEFT JOIN \`meeting\` AS m ON m.id = mr.meeting_id AND m.is_deleted = 0
        WHERE mr.student_id = ? AND mr.is_deleted = 0
        ORDER BY mr.id DESC LIMIT ${MAX_ROWS}`, [userId], 'overview:meetingReports')
    data.meetingReports = meetingReports

    // 消息（收 / 发）
    const [messages] = await this._execute(`SELECT id, sender_id, receiver_id, msg_type, title, content, status, ref_type, ref_id, created_at, read_at
        FROM \`message\` WHERE (receiver_id = ? OR sender_id = ?) AND is_deleted = 0
        ORDER BY id DESC LIMIT ${MAX_ROWS}`, [userId, userId], 'overview:messages')
    data.messages = messages

    // 操作日志（本人作为操作者）
    const [operationLogs] = await this._execute(`SELECT id, operator_id, operator_name, action, target_type, target_id, detail, created_at
        FROM \`operation_log\` WHERE operator_id = ? AND is_deleted = 0
        ORDER BY id DESC LIMIT ${MAX_ROWS}`, [userId], 'overview:operationLogs')
    data.operationLogs = operationLogs

    return data
  }

  // 当前库全部数据表（行数含软删行）
  async listAllTables() {
    const sql = `SELECT TABLE_NAME AS table_name, TABLE_ROWS AS row_count
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME ASC`
    const [rows] = await this._execute(sql, [], 'overview:list-tables')
    return rows
  }

  // 取某张表的数据（含软删行）。表名先经 information_schema 校验，防 SQL 注入。
  async getTableData(tableName, limit = 100, offset = 0) {
    const [exists] = await this._execute(
      `SELECT TABLE_NAME AS t FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [tableName], 'overview:table-data:check'
    )
    if (!exists || !exists.length) {
      const err = new Error('表不存在')
      err.notFound = true
      throw err
    }
    const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100))
    const safeOffset = Math.max(0, Number(offset) || 0)
    // LIMIT/OFFSET 经整数校验后直接拼接，避免 mysql2 prepared statement 对占位符类型的兼容问题
    const sql = `SELECT * FROM \`${tableName}\` LIMIT ${safeLimit} OFFSET ${safeOffset}`
    const [rows] = await this._execute(sql, [], 'overview:table-data')
    return rows
  }
}

module.exports = new OverviewRepository()
