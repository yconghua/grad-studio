// 对 preload 暴露的 window.api 做一层薄封装，便于组件调用。
// 若需要，可在此统一处理错误 / loading。
//
// 已封装模块：
//   auth           认证与用户管理
//   sys            系统与数据库连接
//   profile        用户档案
//   group          课题组管理
//   member         组成员管理
//   students       导师学生关系
//   notice         课题组公告
//   degree         学位节点与记录
//   meeting        组会
//   meetingReport  组会汇报
//   subject        课题与成员
//   task           任务与进展
//   researchLog    科研日志
//   weekly         周报
//   achievement    科研成果
//   paper          论文投稿跟踪
//   literature     文献库
//   literatureNote 文献笔记
//   archive        科研档案
//   knowledge      知识库
//   groupSetting   课题组配置
//   systemParam    系统参数
//   operationLog   操作日志
//   message        站内消息

// ===== 认证与用户管理 =====
export function login(username, password) {
  return window.api.auth.login({ username, password })
}

export function logout() {
  return window.api.auth.logout()
}

export function getCurrentUser() {
  return window.api.auth.getCurrentUser()
}

export function changePassword(username, oldPassword, newPassword) {
  return window.api.auth.changePassword({ username, oldPassword, newPassword })
}

// 用户管理（超级管理员：平台账号；课题组管理员：本组成员）
export function listUsers() {
  return window.api.auth.listUsers()
}

// 成员列表（轻量，供下拉选人；传 { group_id } 只返回该课题组在组人员）
// 3 秒短缓存（按 group_id 区分）：多个页面并发挂载时避免重复请求；传入 { force: true } 强制刷新
let membersCache = { at: 0, data: null, groupId: null }
export function listMembers(options) {
  const force = options && options.force
  const groupId = options && options.group_id ? Number(options.group_id) : null
  const now = Date.now()
  if (!force && membersCache.data && membersCache.groupId === groupId && now - membersCache.at < 3000) {
    return Promise.resolve(membersCache.data)
  }
  return window.api.auth.listMembers(options || {}).then((res) => {
    if (res && res.success) membersCache = { at: now, data: res, groupId }
    return res
  })
}

export function createUser(payload) {
  return window.api.auth.createUser(payload)
}

// 批量新增用户
export function batchCreateUsers(users) {
  return window.api.auth.batchCreateUsers({ users })
}

export function updateUser(payload) {
  return window.api.auth.updateUser(payload)
}

// 读取当前登录用户自己的档案（当前用户表仅含登录必需字段）
export function getMyProfile() {
  return window.api.auth.getMyProfile()
}

export function deleteUser(id) {
  return window.api.auth.deleteUser({ id })
}

// ===== 系统与数据库连接（平台基础设施） =====
export function getSysInfo() {
  return window.api.sys.info()
}

export function getDbInfo() {
  return window.api.sys.dbInfo()
}

// 查看数据表（当前库所有表 + 字段 + 行数）
export function getTablesInfo() {
  return window.api.sys.tablesInfo()
}

// 清理本地缓存（Electron 会话 / 磁盘缓存）
export function clearCache() {
  return window.api.sys.clearCache()
}

// 用户数据目录（路径展示 + 在系统文件管理器中打开）
export function getUserDataPath() {
  return window.api.sys.userDataPath()
}

export function openUserDataDir() {
  return window.api.sys.openUserDataDir()
}

// 程序文件所在目录
export function getAppPath() {
  return window.api.sys.appPath()
}

export function openAppDir() {
  return window.api.sys.openAppDir()
}

// 导出当前库为 SQL 备份文件
export function exportDatabase() {
  return window.api.sys.exportDb()
}

// 打开开发者控制台（DevTools）
export function openDevTools() {
  return window.api.sys.openDevTools()
}

// 手动检查更新（GitHub Releases）
export function checkForUpdates() {
  return window.api.sys.checkForUpdates()
}

// 用系统浏览器打开外部链接（仅放行 GitHub 域名）
export function openExternal(url) {
  return window.api.sys.openExternal({ url })
}

// 选择附件文件（弹出文件对话框）
export function pickAttachment() {
  return window.api.sys.pickAttachment()
}

// 用系统默认程序打开附件
export function openAttachment(path) {
  return window.api.sys.openAttachment({ path })
}

// 数据库连接管理（清单 / 切换 / 新增 / 删除）
export function getDbConnections() {
  return window.api.sys.dbConnections()
}

export function switchDb(id) {
  return window.api.sys.switchDb({ id })
}

export function addDb(payload) {
  return window.api.sys.addDb(payload)
}

export function deleteDb(id) {
  return window.api.sys.deleteDb({ id })
}

// ===== 用户档案 =====
export function getProfile() {
  return window.api.profile.get()
}

export function updateProfile(payload) {
  return window.api.profile.update(payload)
}

// ===== 课题组管理（仅超级管理员；listMyGroups 登录用户可用） =====
export function listGroups() {
  return window.api.group.list()
}

// 当前登录用户所属课题组列表（含组内角色 role_in_group，供页头课题组选择器使用）
export function listMyGroups() {
  return window.api.group.listMine()
}

export function createGroup(payload) {
  return window.api.group.create(payload)
}

export function updateGroup(payload) {
  return window.api.group.update(payload)
}

export function removeGroup(id) {
  return window.api.group.remove({ id })
}

// ===== 组成员管理（仅课题组管理员） =====
export function listMembersByGroup(groupId) {
  return window.api.member.list({ group_id: groupId })
}

export function addMember(payload) {
  return window.api.member.add(payload)
}

export function updateMember(payload) {
  return window.api.member.update(payload)
}

export function removeMember(id) {
  return window.api.member.remove({ id })
}

// ===== 导师学生关系 =====
export function listStudents(payload) {
  return window.api.students.list(payload)
}

// 学生名单（导师看自己名下 / 组管与超管看组内学生）——学位记录等选人场景
export function listGroupStudents(payload) {
  return window.api.students.listGroupStudents(payload)
}

// 我的指导老师（学生本人，个人资料页）
export function listMyMentor() {
  return window.api.students.myMentor()
}

export function bindStudent(payload) {
  return window.api.students.bind(payload)
}

export function unbindStudent(id) {
  return window.api.students.unbind({ id })
}

// ===== 课题组公告 =====
export function listNotices(groupId) {
  return window.api.notice.list({ group_id: groupId })
}

export function getNoticeUnreadCount(groupId) {
  return window.api.notice.unreadCount({ group_id: groupId })
}

export function markNoticeRead(noticeId) {
  return window.api.notice.markRead({ notice_id: noticeId })
}

export function createNotice(payload) {
  return window.api.notice.create(payload)
}

export function updateNotice(payload) {
  return window.api.notice.update(payload)
}

export function removeNotice(id) {
  return window.api.notice.remove({ id })
}

// ===== 学位节点与记录（组管 / 导师） =====
export function listDegreeNodes(groupId) {
  return window.api.degree.listNodes({ group_id: groupId })
}

export function saveDegreeNode(payload) {
  return window.api.degree.saveNode(payload)
}

export function removeDegreeNode(id) {
  return window.api.degree.removeNode({ id })
}

export function listDegreeRecords(payload) {
  return window.api.degree.listRecords(payload)
}

export function saveDegreeRecord(payload) {
  return window.api.degree.saveRecord(payload)
}

// ===== 组会 =====
export function listMeetings(groupId) {
  return window.api.meeting.list({ group_id: groupId })
}

export function createMeeting(payload) {
  return window.api.meeting.create(payload)
}

export function updateMeeting(payload) {
  return window.api.meeting.update(payload)
}

export function removeMeeting(id) {
  return window.api.meeting.remove({ id })
}

// ===== 组会汇报 =====
export function listMeetingReports(payload) {
  return window.api.meetingReport.list(payload)
}

export function submitMeetingReport(payload) {
  return window.api.meetingReport.submit(payload)
}

export function reviewMeetingReport(payload) {
  return window.api.meetingReport.review(payload)
}

// ===== 课题与成员 =====
export function listSubjects(groupId) {
  return window.api.subject.list({ group_id: groupId })
}

export function createSubject(payload) {
  return window.api.subject.create(payload)
}

export function updateSubject(payload) {
  return window.api.subject.update(payload)
}

export function removeSubject(id) {
  return window.api.subject.remove({ id })
}

export function listSubjectMembers(subjectId) {
  return window.api.subject.listMembers({ subject_id: subjectId })
}

export function addSubjectMember(payload) {
  return window.api.subject.addMember(payload)
}

export function removeSubjectMember(id) {
  return window.api.subject.removeMember({ id })
}

// ===== 任务与进展 =====
export function listTasks(payload) {
  return window.api.task.list(payload)
}

export function createTask(payload) {
  return window.api.task.create(payload)
}

export function updateTask(payload) {
  return window.api.task.update(payload)
}

export function removeTask(id) {
  return window.api.task.remove({ id })
}

export function listMyTasks() {
  return window.api.task.listMine()
}

export function submitTaskProgress(payload) {
  return window.api.task.progressSubmit(payload)
}

export function listTaskProgress(taskId) {
  return window.api.task.listProgress({ task_id: taskId })
}

// ===== 科研日志（学生本人） =====
export function listMyResearchLogs() {
  return window.api.researchLog.listMine()
}

export function createResearchLog(payload) {
  return window.api.researchLog.create(payload)
}

export function updateResearchLog(payload) {
  return window.api.researchLog.update(payload)
}

export function removeResearchLog(id) {
  return window.api.researchLog.remove({ id })
}

// ===== 周报 =====
export function listMyWeeklyReports() {
  return window.api.weekly.listMine()
}

export function createWeeklyReport(payload) {
  return window.api.weekly.create(payload)
}

export function updateWeeklyReport(payload) {
  return window.api.weekly.update(payload)
}

export function submitWeeklyReport(id) {
  return window.api.weekly.submit({ id })
}

export function reviewWeeklyReport(payload) {
  return window.api.weekly.review(payload)
}

export function listAllWeeklyReports(payload) {
  return window.api.weekly.listAll(payload)
}

// ===== 科研成果 =====
export function listMyAchievements() {
  return window.api.achievement.listMine()
}

export function createAchievement(payload) {
  return window.api.achievement.create(payload)
}

export function updateAchievement(payload) {
  return window.api.achievement.update(payload)
}

export function removeAchievement(id) {
  return window.api.achievement.remove({ id })
}

export function reviewAchievement(payload) {
  return window.api.achievement.review(payload)
}

export function listAllAchievements(payload) {
  return window.api.achievement.listAll(payload)
}

// ===== 论文投稿跟踪（学生本人） =====
export function listPapers() {
  return window.api.paper.list()
}

export function createPaper(payload) {
  return window.api.paper.create(payload)
}

export function updatePaper(payload) {
  return window.api.paper.update(payload)
}

export function removePaper(id) {
  return window.api.paper.remove({ id })
}

// ===== 文献库（学生本人） =====
export function listMyLiterature(payload) {
  return window.api.literature.listMine(payload)
}

export function createLiterature(payload) {
  return window.api.literature.create(payload)
}

export function updateLiterature(payload) {
  return window.api.literature.update(payload)
}

export function removeLiterature(id) {
  return window.api.literature.remove({ id })
}

// ===== 文献笔记（学生本人） =====
export function listLiteratureNotes(literatureId) {
  return window.api.literatureNote.list({ literature_id: literatureId })
}

export function createLiteratureNote(payload) {
  return window.api.literatureNote.create(payload)
}

export function updateLiteratureNote(payload) {
  return window.api.literatureNote.update(payload)
}

export function removeLiteratureNote(id) {
  return window.api.literatureNote.remove({ id })
}

// ===== 科研档案（学生本人） =====
export function listArchiveRecords() {
  return window.api.archive.list()
}

export function createArchiveRecord(payload) {
  return window.api.archive.create(payload)
}

export function removeArchiveRecord(id) {
  return window.api.archive.remove({ id })
}

export function exportArchive() {
  return window.api.archive.export()
}

// ===== 知识库 =====
export function listKnowledge(groupId) {
  return window.api.knowledge.list({ group_id: groupId })
}

export function createKnowledge(payload) {
  return window.api.knowledge.create(payload)
}

export function updateKnowledge(payload) {
  return window.api.knowledge.update(payload)
}

export function removeKnowledge(id) {
  return window.api.knowledge.remove({ id })
}

export function listKnowledgeFiles(knowledgeId) {
  return window.api.knowledge.listFiles({ knowledge_id: knowledgeId })
}

export function uploadKnowledgeFile(payload) {
  return window.api.knowledge.uploadFile(payload)
}

export function removeKnowledgeFile(id) {
  return window.api.knowledge.removeFile({ id })
}

// ===== 课题组配置（仅组管） =====
export function getGroupSetting(groupId) {
  return window.api.groupSetting.get({ group_id: groupId })
}

export function updateGroupSetting(payload) {
  return window.api.groupSetting.update(payload)
}

// ===== 系统参数（仅超管） =====
export function listSystemParams() {
  return window.api.systemParam.list()
}

export function saveSystemParam(payload) {
  return window.api.systemParam.save(payload)
}

export function removeSystemParam(id) {
  return window.api.systemParam.remove({ id })
}

// ===== 操作日志（仅超管） =====
export function listOperationLogs(payload) {
  return window.api.operationLog.list(payload)
}

// ===== 站内消息（本人） =====
export function listMyMessages(payload) {
  return window.api.message.listMine(payload)
}

export function getMessageUnreadCount() {
  return window.api.message.unreadCount()
}

export function markMessageRead(id) {
  return window.api.message.markRead({ id })
}

export function markAllMessagesRead() {
  return window.api.message.markAllRead()
}

// ===== 数据总览（仅超管） =====
export function listOverviewGroups() {
  return window.api.overview.groups()
}

export function getOverviewGroupDetail(groupId) {
  return window.api.overview.groupDetail({ group_id: groupId })
}

export function listOverviewUsers(role) {
  return window.api.overview.users(role ? { role } : {})
}

export function getOverviewUserDetail(userId) {
  return window.api.overview.userDetail({ user_id: userId })
}

// ===== 全局搜索（按角色限定可见范围） =====
export function globalSearch(keyword) {
  return window.api.search.global({ keyword })
}
