// 通知中心接口（对应 electron/ipc/notification.js，通道前缀 notification:*）
export function listNotifications({ page, pageSize = 20, typeKey, isRead } = {}) {
  return window.api.notification.list({ page, pageSize, typeKey, isRead })
}
export function getNotificationUnreadCount() {
  return window.api.notification.unreadCount()
}
export function markNotificationRead(id) {
  return window.api.notification.markRead({ id })
}
export function markAllNotificationsRead() {
  return window.api.notification.markAllRead()
}
export function deleteNotification(id) {
  return window.api.notification.delete({ id })
}
export function clearReadNotifications() {
  return window.api.notification.clearRead()
}
export function listNotificationTypes() {
  return window.api.notification.listTypes()
}
// 主进程实时推送订阅（notificationPoller 每 10 秒轮询共享库，有变化即推送）；返回取消订阅函数
export function onNotificationEvent(cb) {
  return window.api.notification.onEvent(cb)
}
