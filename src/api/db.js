// 系统基础设施接口：数据库连接管理、附件选择与打开（登录页 / 数据库弹窗使用）
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
