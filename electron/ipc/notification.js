/**
 * 路由层（IPC Layer）—— 通知中心路由（notification:* 前缀）
 *
 * 权限闸门：
 *   - 通知为全平台功能：任意已登录启用用户可查看 / 标记已读 / 删除自己的通知；
 *   - 发送通知不对外暴露（仅业务模块内部调用 notificationService.createFor*）。
 * 身份一律取自主进程会话（authService.getCurrentUser），不信任前端传入的 userId。
 */
const notificationService = require('../services/notificationService')
const authService = require('../services/authService')
const ApiError = require('../services/apiError')
const { handler } = require('./helper')

// 任意已登录用户
async function requireLogin() {
  const u = await authService.getCurrentUser()
  if (!u) throw new ApiError('未登录，请重新登录', 401)
  return u
}

function register(ipcMain) {
  // 我的通知分页列表（支持类型 / 已读未读筛选）
  ipcMain.handle('notification:list', handler(async (_evt, payload) => {
    await requireLogin()
    return notificationService.list(payload || {})
  }))

  // 我的未读通知数（角标 / 轮询兜底）
  ipcMain.handle('notification:unread-count', handler(async () => {
    await requireLogin()
    return notificationService.unreadCount()
  }))

  // 标记单条已读
  ipcMain.handle('notification:mark-read', handler(async (_evt, payload) => {
    await requireLogin()
    return notificationService.markRead(payload && payload.id)
  }))

  // 全部标记已读
  ipcMain.handle('notification:mark-all-read', handler(async () => {
    await requireLogin()
    return notificationService.markAllRead()
  }))

  // 删除单条（软删）
  ipcMain.handle('notification:delete', handler(async (_evt, payload) => {
    await requireLogin()
    return notificationService.remove(payload && payload.id)
  }))

  // 清空已读（一次性软删全部已读）
  ipcMain.handle('notification:clear-read', handler(async () => {
    await requireLogin()
    return notificationService.clearRead()
  }))

  // 已启用通知类型列表（筛选 / 展示动态读取）
  ipcMain.handle('notification:list-types', handler(async () => {
    await requireLogin()
    return notificationService.listTypes()
  }))
}

module.exports = { register }
