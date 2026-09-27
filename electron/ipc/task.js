/**
 * 路由层（IPC Layer）—— 任务路由（task:* 前缀）
 *
 * 只做转发与统一异常收敛，业务逻辑全部在 taskService。
 */
const taskService = require('../services/taskService')

function register(ipcMain) {
  // 任务列表（管理者看本组全部，学生看本人被指派的）
  ipcMain.handle('task:list', async (_evt, payload) => {
    try {
      return await taskService.list(payload)
    } catch (err) {
      console.error('[task:list] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 下发任务（仅组管 / 导师）
  ipcMain.handle('task:create', async (_evt, payload) => {
    try {
      return await taskService.create(payload)
    } catch (err) {
      console.error('[task:create] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 编辑任务（仅组管 / 导师）
  ipcMain.handle('task:update', async (_evt, payload) => {
    try {
      return await taskService.update(payload)
    } catch (err) {
      console.error('[task:update] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 删除任务（仅组管 / 导师）
  ipcMain.handle('task:remove', async (_evt, payload) => {
    try {
      return await taskService.remove(payload)
    } catch (err) {
      console.error('[task:remove] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 我的任务（仅学生）
  ipcMain.handle('task:list-mine', async () => {
    try {
      return await taskService.listMine()
    } catch (err) {
      console.error('[task:list-mine] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 提交任务进展（仅学生本人任务）
  ipcMain.handle('task:progress-submit', async (_evt, payload) => {
    try {
      return await taskService.progressSubmit(payload)
    } catch (err) {
      console.error('[task:progress-submit] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 任务进展记录（学生看本人任务，管理者全部）
  ipcMain.handle('task:list-progress', async (_evt, payload) => {
    try {
      return await taskService.listProgress(payload)
    } catch (err) {
      console.error('[task:list-progress] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })
}

module.exports = { register }
