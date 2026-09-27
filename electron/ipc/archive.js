/**
 * 路由层（IPC Layer）—— 个人档案相关路由（archive:* 前缀）
 *
 * 仅做一层转发 + 防御性 catch，业务逻辑全部在 archiveService。
 */
const archiveService = require('../services/archiveService')

function register(ipcMain) {
  // 我的档案记录列表
  ipcMain.handle('archive:list', async () => {
    try {
      return await archiveService.list()
    } catch (err) {
      console.error('[archive:list] 未预期异常:', err)
      return { success: false, message: '读取失败，请稍后重试' }
    }
  })

  // 新增档案记录
  ipcMain.handle('archive:create', async (_evt, payload) => {
    try {
      return await archiveService.create(payload)
    } catch (err) {
      console.error('[archive:create] 未预期异常:', err)
      return { success: false, message: '创建失败，请稍后重试' }
    }
  })

  // 删除本人档案记录
  ipcMain.handle('archive:remove', async (_evt, payload) => {
    try {
      return await archiveService.remove(payload)
    } catch (err) {
      console.error('[archive:remove] 未预期异常:', err)
      return { success: false, message: '删除失败，请稍后重试' }
    }
  })

  // 导出本人聚合数据
  ipcMain.handle('archive:export', async () => {
    try {
      return await archiveService.exportData()
    } catch (err) {
      console.error('[archive:export] 未预期异常:', err)
      return { success: false, message: '导出失败，请稍后重试' }
    }
  })
}

module.exports = { register }
