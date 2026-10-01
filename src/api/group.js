// 课题组管理接口（超级管理员）：列表、增删改、详情
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
