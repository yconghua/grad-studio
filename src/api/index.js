/**
 * 渲染层 API 薄封装：对 preload 暴露的 window.api 做一层调用封装。
 *
 * 统一约定：
 *   - 后端统一返回 { success, code, message, data }（成功时 success=true、code=0）；
 *   - 本模块所有函数原样返回该响应对象（success 判断由页面自行处理），
 *     与既有组件（登录页 / 数据库管理弹窗）的调用习惯保持一致。
 */

// ===== 认证 =====
export function login(username, password) {
  return window.api.auth.login({ username, password })
}
export function logout() {
  return window.api.auth.logout()
}
export function getCurrentUser() {
  return window.api.auth.getCurrentUser()
}
export function changePassword(payload = {}) {
  return window.api.auth.changePassword(payload)
}

// ===== 用户管理（超级管理员）=====
export function listUsers(params = {}) {
  return window.api.user.list(params)
}
export function createUser(data = {}) {
  return window.api.user.create(data)
}
export function getUser(id) {
  return window.api.user.detail({ id })
}
export function updateAccount(id, data = {}) {
  return window.api.user.updateAccount({ id, data })
}
export function updateProfile(id, data = {}) {
  return window.api.user.updateProfile({ id, data })
}
export function deleteUser(id) {
  return window.api.user.delete({ id })
}
// 候选人列表（未入组的导师 / 学生，供「加入课题组」选人）
export function listCandidates(params = {}) {
  return window.api.user.candidates(params)
}

// ===== 课题组管理（超级管理员）=====
export function listGroups(params = {}) {
  return window.api.group.list(params)
}
export function createGroup(data = {}) {
  return window.api.group.create(data)
}
export function getGroup(id) {
  return window.api.group.detail({ id })
}
export function updateGroup(id, data = {}) {
  return window.api.group.update({ id, data })
}
export function deleteGroup(id) {
  return window.api.group.delete({ id })
}

// ===== 课题组管理员：本课题组 =====
export function getOwnGroup() {
  return window.api.groupAdmin.getOwn()
}
export function updateOwnGroup(data = {}) {
  return window.api.groupAdmin.updateOwn({ data })
}
export function listMembers(params = {}) {
  return window.api.groupAdmin.membersList(params)
}
export function addMembers(data = {}) {
  return window.api.groupAdmin.membersAdd(data)
}
export function removeMember(userId) {
  return window.api.groupAdmin.memberRemove({ userId })
}
export function listGroupStudents(params = {}) {
  return window.api.groupAdmin.studentsList(params)
}
export function setStudentMentor(studentId, data = {}) {
  return window.api.groupAdmin.setStudentMentor({ studentId, data })
}

// ===== 导师：我的学生 =====
export function listMyStudents(params = {}) {
  return window.api.mentor.studentsList(params)
}

// ===== 系统配置与公共系统接口 =====
export function getSystemInfo() {
  return window.api.system.info()
}
export function getDatabaseInfo() {
  return window.api.system.database()
}
export function listParams(params = {}) {
  return window.api.system.paramsList(params)
}
export function createParam(data = {}) {
  return window.api.system.paramsCreate(data)
}
export function updateParam(id, data = {}) {
  return window.api.system.paramsUpdate({ id, data })
}
export function deleteParam(id) {
  return window.api.system.paramsDelete({ id })
}
export function getIntroduction() {
  return window.api.system.introduction()
}
export function checkUpdate() {
  return window.api.system.checkUpdate()
}

// ===== 系统基础设施（登录页 / 数据库管理组件使用）=====
export function getPublicInfo() {
  return window.api.sys.getPublicInfo()
}
export function getDbInfo() {
  return window.api.sys.dbInfo()
}
export function getDbConnections() {
  return window.api.sys.dbConnections()
}
export function switchDb(id) {
  return window.api.sys.switchDb({ id })
}
export function addDb(data = {}) {
  return window.api.sys.addDb(data)
}
export function deleteDb(id) {
  return window.api.sys.deleteDb({ id })
}
export function exportDb() {
  return window.api.sys.exportDb()
}
export function pickAttachment() {
  return window.api.sys.pickAttachment()
}
export function openAttachment(path) {
  return window.api.sys.openAttachment({ path })
}
