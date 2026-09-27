/**
 * 路由层（IPC Layer）—— 课题组相关路由（group:* 前缀）
 *
 * 只做一层转发：渲染层的 group:* 调用交给 groupService，
 * 不写 SQL、不做权限判断（权限在 Service 层）。
 */
const groupService = require('../services/groupService')

function register(ipcMain) {
  // 当前登录用户所属课题组列表
  ipcMain.handle('group:listMine', async (_evt, payload) => {
    try {
      return await groupService.listMine(payload)
    } catch (err) {
      console.error('[group:listMine] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 课题组列表
  ipcMain.handle('group:list', async (_evt, payload) => {
    try {
      return await groupService.list(payload)
    } catch (err) {
      console.error('[group:list] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 新增课题组
  ipcMain.handle('group:create', async (_evt, payload) => {
    try {
      return await groupService.create(payload)
    } catch (err) {
      console.error('[group:create] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 编辑课题组
  ipcMain.handle('group:update', async (_evt, payload) => {
    try {
      return await groupService.update(payload)
    } catch (err) {
      console.error('[group:update] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 软删除课题组
  ipcMain.handle('group:remove', async (_evt, payload) => {
    try {
      return await groupService.remove(payload)
    } catch (err) {
      console.error('[group:remove] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })
}

module.exports = { register }
