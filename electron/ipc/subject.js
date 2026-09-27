/**
 * 路由层（IPC Layer）—— 课题路由（subject:* 前缀）
 *
 * 只做转发与统一异常收敛，业务逻辑全部在 subjectService。
 */
const subjectService = require('../services/subjectService')

function register(ipcMain) {
  // 课题列表（全员登录，按 group_id 过滤）
  ipcMain.handle('subject:list', async (_evt, payload) => {
    try {
      return await subjectService.list(payload)
    } catch (err) {
      console.error('[subject:list] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 新建课题（仅组管 / 导师）
  ipcMain.handle('subject:create', async (_evt, payload) => {
    try {
      return await subjectService.create(payload)
    } catch (err) {
      console.error('[subject:create] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 编辑课题（仅组管 / 导师）
  ipcMain.handle('subject:update', async (_evt, payload) => {
    try {
      return await subjectService.update(payload)
    } catch (err) {
      console.error('[subject:update] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 删除课题（仅组管 / 导师）
  ipcMain.handle('subject:remove', async (_evt, payload) => {
    try {
      return await subjectService.remove(payload)
    } catch (err) {
      console.error('[subject:remove] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 课题成员列表（全员登录，按 subject_id）
  ipcMain.handle('subject:list-members', async (_evt, payload) => {
    try {
      return await subjectService.listMembers(payload)
    } catch (err) {
      console.error('[subject:list-members] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 添加课题成员（仅组管 / 导师）
  ipcMain.handle('subject:add-member', async (_evt, payload) => {
    try {
      return await subjectService.addMember(payload)
    } catch (err) {
      console.error('[subject:add-member] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 移除课题成员（仅组管 / 导师）
  ipcMain.handle('subject:remove-member', async (_evt, payload) => {
    try {
      return await subjectService.removeMember(payload)
    } catch (err) {
      console.error('[subject:remove-member] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })
}

module.exports = { register }
