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
export function deleteUser(id) {
  return window.api.user.delete({ id })
}
// 候选人列表（未入组的导师 / 学生，供「加入课题组」选人）
export function listCandidates(params = {}) {
  return window.api.user.candidates(params)
}
