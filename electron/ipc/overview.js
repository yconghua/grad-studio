/**
 * 路由层（IPC Layer）—— 数据总览路由（overview:* 前缀，仅超级管理员）
 *
 * 只做一层转发与防御性 catch，业务逻辑与权限校验全部在 overviewService。
 */
const overviewService = require('../services/overviewService')

function register(ipcMain) {
  // 全部课题组（含计数）
  ipcMain.handle('overview:groups', async () => {
    try {
      return await overviewService.listGroups()
    } catch (err) {
      console.error('[overview:groups] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 单个课题组详情（全部业务模块）
  ipcMain.handle('overview:group-detail', async (_evt, payload) => {
    try {
      return await overviewService.groupDetail(payload)
    } catch (err) {
      console.error('[overview:group-detail] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 全部用户（可按角色过滤）
  ipcMain.handle('overview:users', async (_evt, payload) => {
    try {
      return await overviewService.listUsers(payload)
    } catch (err) {
      console.error('[overview:users] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 单个用户详情（全部业务模块）
  ipcMain.handle('overview:user-detail', async (_evt, payload) => {
    try {
      return await overviewService.userDetail(payload)
    } catch (err) {
      console.error('[overview:user-detail] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })
}

module.exports = { register }
