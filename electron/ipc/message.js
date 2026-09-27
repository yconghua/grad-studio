/**
 * 路由层（IPC Layer）—— 站内消息相关路由（message:* 前缀，登录用户本人）
 *
 * 只做路由转发与防御性 catch，业务逻辑全部在 messageService。
 */
const messageService = require('../services/messageService')

function register(ipcMain) {
  // 我的消息列表
  ipcMain.handle('message:list-mine', async (_evt, payload) => {
    try {
      return await messageService.listMine(payload)
    } catch (err) {
      console.error('[message:list-mine] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 我的未读消息数
  ipcMain.handle('message:unread-count', async () => {
    try {
      return await messageService.unreadCount()
    } catch (err) {
      console.error('[message:unread-count] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 标记单条已读
  ipcMain.handle('message:mark-read', async (_evt, payload) => {
    try {
      return await messageService.markRead(payload)
    } catch (err) {
      console.error('[message:mark-read] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 一键全部已读
  ipcMain.handle('message:mark-all-read', async () => {
    try {
      return await messageService.markAllRead()
    } catch (err) {
      console.error('[message:mark-all-read] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })
}

module.exports = { register }
