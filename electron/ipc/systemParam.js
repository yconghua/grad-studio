/**
 * 路由层（IPC Layer）—— 系统参数相关路由（system-param:* 前缀，仅超级管理员）
 *
 * 只做路由转发与防御性 catch，业务逻辑全部在 systemParamService。
 */
const systemParamService = require('../services/systemParamService')

function register(ipcMain) {
  // 列出全部系统参数
  ipcMain.handle('system-param:list', async () => {
    try {
      return await systemParamService.list()
    } catch (err) {
      console.error('[system-param:list] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 新增或更新系统参数
  ipcMain.handle('system-param:save', async (_evt, payload) => {
    try {
      return await systemParamService.save(payload)
    } catch (err) {
      console.error('[system-param:save] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 软删除系统参数
  ipcMain.handle('system-param:remove', async (_evt, payload) => {
    try {
      return await systemParamService.remove(payload)
    } catch (err) {
      console.error('[system-param:remove] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })
}

module.exports = { register }
