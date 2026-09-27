/**
 * 路由层（IPC Layer）—— 师生关系相关路由（students:* 前缀）
 *
 * 只做一层转发：渲染层的 students:* 调用交给 studentsService，
 * 不写 SQL、不做权限判断（权限在 Service 层）。
 */
const studentsService = require('../services/studentsService')

function register(ipcMain) {
  // 学生列表（导师看自己名下 / 组管看全组）
  ipcMain.handle('students:list', async (_evt, payload) => {
    try {
      return await studentsService.list(payload)
    } catch (err) {
      console.error('[students:list] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 绑定师生关系
  ipcMain.handle('students:bind', async (_evt, payload) => {
    try {
      return await studentsService.bind(payload)
    } catch (err) {
      console.error('[students:bind] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 解除绑定（软删除）
  ipcMain.handle('students:unbind', async (_evt, payload) => {
    try {
      return await studentsService.unbind(payload)
    } catch (err) {
      console.error('[students:unbind] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })
}

module.exports = { register }
