/**
 * 路由层（IPC Layer）—— 组会路由（meeting:* 前缀）
 *
 * 只做转发与统一异常收敛，业务逻辑全部在 meetingService。
 */
const meetingService = require('../services/meetingService')

function register(ipcMain) {
  // 组会列表（全员登录，按 group_id 过滤）
  ipcMain.handle('meeting:list', async (_evt, payload) => {
    try {
      return await meetingService.list(payload)
    } catch (err) {
      console.error('[meeting:list] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 创建组会（仅课题组管理员）
  ipcMain.handle('meeting:create', async (_evt, payload) => {
    try {
      return await meetingService.create(payload)
    } catch (err) {
      console.error('[meeting:create] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 编辑组会（仅课题组管理员）
  ipcMain.handle('meeting:update', async (_evt, payload) => {
    try {
      return await meetingService.update(payload)
    } catch (err) {
      console.error('[meeting:update] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 删除组会（仅课题组管理员）
  ipcMain.handle('meeting:remove', async (_evt, payload) => {
    try {
      return await meetingService.remove(payload)
    } catch (err) {
      console.error('[meeting:remove] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })
}

module.exports = { register }
