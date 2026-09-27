/**
 * 路由层（IPC Layer）—— 公告相关路由（notice:* 前缀）
 *
 * 只做一层转发：渲染层的 notice:* 调用交给 noticeService，
 * 不写 SQL、不做权限判断（权限在 Service 层）。
 */
const noticeService = require('../services/noticeService')

function register(ipcMain) {
  // 公告列表（按 group_id，置顶优先、发布时间倒序，带 is_read 标记）
  ipcMain.handle('notice:list', async (_evt, payload) => {
    try {
      return await noticeService.list(payload)
    } catch (err) {
      console.error('[notice:list] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 当前用户在某组的未读公告数
  ipcMain.handle('notice:unread-count', async (_evt, payload) => {
    try {
      return await noticeService.unreadCount(payload)
    } catch (err) {
      console.error('[notice:unread-count] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 标记某条公告已读（幂等）
  ipcMain.handle('notice:mark-read', async (_evt, payload) => {
    try {
      return await noticeService.markRead(payload)
    } catch (err) {
      console.error('[notice:mark-read] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 新增公告（仅组管理员）
  ipcMain.handle('notice:create', async (_evt, payload) => {
    try {
      return await noticeService.create(payload)
    } catch (err) {
      console.error('[notice:create] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 编辑公告（仅组管理员）
  ipcMain.handle('notice:update', async (_evt, payload) => {
    try {
      return await noticeService.update(payload)
    } catch (err) {
      console.error('[notice:update] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 软删除公告（仅组管理员）
  ipcMain.handle('notice:remove', async (_evt, payload) => {
    try {
      return await noticeService.remove(payload)
    } catch (err) {
      console.error('[notice:remove] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })
}

module.exports = { register }
