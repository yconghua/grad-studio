// 课题组公告接口（notice:*）：详情 / 列表 / 发布 / 编辑 / 删除 / 置顶 / 已读统计 / 标记已读
export function getNotice(id) {
  return window.api.notice.get({ id })
}
export function listNotices(params = {}) {
  return window.api.notice.list(params)
}
export function createNotice(data = {}) {
  return window.api.notice.create(data)
}
export function updateNotice(id, data = {}) {
  return window.api.notice.update({ id, data })
}
export function deleteNotice(id) {
  return window.api.notice.remove({ id })
}
export function toggleNoticeTop(id) {
  return window.api.notice.top({ id })
}
export function getNoticeReadStats(id) {
  return window.api.notice.readStats({ id })
}
// 导师/学生标记自己已读
export function markNoticeRead(id) {
  return window.api.notice.readSelf({ id })
}
// 当前用户未读公告数（导师/学生侧边菜单角标；超管/组管返回 0）
export function getNoticeUnreadCount() {
  return window.api.notice.unreadCount()
}
