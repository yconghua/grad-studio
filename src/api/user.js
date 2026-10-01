// 用户管理接口（超级管理员）：列表、增删改、详情、账号/资料分别保存
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
// 当前登录用户更新自己的资料（个人资料页）
export function updateOwnProfile(data = {}) {
  return window.api.user.updateOwnProfile(data)
}
// 重置密码（超管）：重置为该角色默认密码，用户下次登录强制改密
export function resetPassword(id) {
  return window.api.user.resetPassword({ id })
}
// 批量启用/禁用（超管）
export function batchUpdateStatus(ids, status) {
  return window.api.user.batchStatus({ ids, status })
}
// 批量删除（超管）
export function batchDeleteUsers(ids) {
  return window.api.user.batchDelete({ ids })
}
// 批量新增用户（超管）：rows 为解析后的用户数组
export function batchCreateUsers(rows) {
  return window.api.user.batchCreate({ rows })
}
// 全部用户名（批量导入预览预检用）
export function listAllUsernames() {
  return window.api.user.usernames()
}
// 下载批量新增 CSV 模板（超管，主进程保存对话框）
export function downloadCsvTemplate() {
  return window.api.user.downloadCsvTemplate()
}
export function deleteUser(id) {
  return window.api.user.delete({ id })
}
// 候选人列表（未入组的导师 / 学生，供「加入课题组」选人）
export function listCandidates(params = {}) {
  return window.api.user.candidates(params)
}
