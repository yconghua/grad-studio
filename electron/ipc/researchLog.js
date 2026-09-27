/**
 * 路由层（IPC Layer）—— 科研日志相关路由（research-log:* 前缀）
 *
 * 仅做一层转发 + 防御性 catch，业务逻辑全部在 researchLogService。
 */
const researchLogService = require('../services/researchLogService')

function register(ipcMain) {
  // 我的科研日志列表
  ipcMain.handle('research-log:list-mine', async () => {
    try {
      return await researchLogService.listMine()
    } catch (err) {
      console.error('[research-log:list-mine] 未预期异常:', err)
      return { success: false, message: '读取失败，请稍后重试' }
    }
  })

  // 新增科研日志
  ipcMain.handle('research-log:create', async (_evt, payload) => {
    try {
      return await researchLogService.create(payload)
    } catch (err) {
      console.error('[research-log:create] 未预期异常:', err)
      return { success: false, message: '创建失败，请稍后重试' }
    }
  })

  // 更新本人科研日志
  ipcMain.handle('research-log:update', async (_evt, payload) => {
    try {
      return await researchLogService.update(payload)
    } catch (err) {
      console.error('[research-log:update] 未预期异常:', err)
      return { success: false, message: '更新失败，请稍后重试' }
    }
  })

  // 删除本人科研日志
  ipcMain.handle('research-log:remove', async (_evt, payload) => {
    try {
      return await researchLogService.remove(payload)
    } catch (err) {
      console.error('[research-log:remove] 未预期异常:', err)
      return { success: false, message: '删除失败，请稍后重试' }
    }
  })
}

module.exports = { register }
