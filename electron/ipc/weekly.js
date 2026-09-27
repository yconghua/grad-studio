/**
 * 路由层（IPC Layer）—— 周报相关路由（weekly:* 前缀）
 *
 * 仅做一层转发 + 防御性 catch，业务逻辑全部在 weeklyService。
 */
const weeklyService = require('../services/weeklyService')

function register(ipcMain) {
  // 我的周报列表
  ipcMain.handle('weekly:list-mine', async () => {
    try {
      return await weeklyService.listMine()
    } catch (err) {
      console.error('[weekly:list-mine] 未预期异常:', err)
      return { success: false, message: '读取失败，请稍后重试' }
    }
  })

  // 新建周报
  ipcMain.handle('weekly:create', async (_evt, payload) => {
    try {
      return await weeklyService.create(payload)
    } catch (err) {
      console.error('[weekly:create] 未预期异常:', err)
      return { success: false, message: '创建失败，请稍后重试' }
    }
  })

  // 更新本人草稿周报
  ipcMain.handle('weekly:update', async (_evt, payload) => {
    try {
      return await weeklyService.update(payload)
    } catch (err) {
      console.error('[weekly:update] 未预期异常:', err)
      return { success: false, message: '更新失败，请稍后重试' }
    }
  })

  // 提交周报
  ipcMain.handle('weekly:submit', async (_evt, payload) => {
    try {
      return await weeklyService.submit(payload)
    } catch (err) {
      console.error('[weekly:submit] 未预期异常:', err)
      return { success: false, message: '提交失败，请稍后重试' }
    }
  })

  // 教师批阅周报
  ipcMain.handle('weekly:review', async (_evt, payload) => {
    try {
      return await weeklyService.review(payload)
    } catch (err) {
      console.error('[weekly:review] 未预期异常:', err)
      return { success: false, message: '批阅失败，请稍后重试' }
    }
  })

  // 全组周报列表
  ipcMain.handle('weekly:list-all', async (_evt, payload) => {
    try {
      return await weeklyService.listAll(payload)
    } catch (err) {
      console.error('[weekly:list-all] 未预期异常:', err)
      return { success: false, message: '读取失败，请稍后重试' }
    }
  })
}

module.exports = { register }
