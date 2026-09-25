/**
 * 路由层（IPC Layer）—— 系统 / 个人相关路由（system:* 前缀）
 *
 * 系统参数标准 CRUD + 按 key 读写；操作日志（仅管理员）；消息中心（发送 / 我的消息 / 未读 / 已读）。
 * recordLog 是内部方法（供其他 Service 调用），不对外暴露。
 */
const systemService = require('../services/systemService')
const { handle, registerCrud } = require('./crudRouter')

function register(ipcMain) {
  registerCrud(ipcMain, 'system:param', systemService.systemParam)

  // 系统参数按 key 读写
  handle(ipcMain, 'system:param-get', (p) => systemService.getParam(p && p.key))
  handle(ipcMain, 'system:param-set', (p) => systemService.setParam(p && p.key, p && p.value, p && p.description))

  // 操作日志（仅管理员）
  handle(ipcMain, 'system:log-list', (p) => systemService.listLogs(p || {}))

  // 消息中心
  handle(ipcMain, 'system:message-send', (p) => systemService.sendMessage(p || {}))
  handle(ipcMain, 'system:message-mine', (p) => systemService.myMessages(p || {}))
  handle(ipcMain, 'system:message-unread', () => systemService.unreadCount())
  handle(ipcMain, 'system:message-read', (p) => systemService.markRead(p && p.id))
  handle(ipcMain, 'system:message-read-all', () => systemService.markAllRead())

  // 通知偏好
  handle(ipcMain, 'system:notification-pref-get', () => systemService.getNotificationPref())
  handle(ipcMain, 'system:notification-pref-save', (p) => systemService.saveNotificationPref(p && p.prefs))
}

module.exports = { register }
