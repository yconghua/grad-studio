/**
 * 路由层（IPC Layer）—— 成员管理相关路由（member:* 前缀）
 *
 * 只做一层转发：渲染层的 member:* 调用交给 memberService，
 * 不写 SQL、不做权限判断（权限在 Service 层）。
 */
const memberService = require('../services/memberService')

function register(ipcMain) {
  // 按课题组列出成员
  ipcMain.handle('member:list', async (_evt, payload) => {
    try {
      return await memberService.list(payload)
    } catch (err) {
      console.error('[member:list] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 添加成员到组
  ipcMain.handle('member:add', async (_evt, payload) => {
    try {
      return await memberService.add(payload)
    } catch (err) {
      console.error('[member:add] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 修改组内角色 / 状态
  ipcMain.handle('member:update', async (_evt, payload) => {
    try {
      return await memberService.update(payload)
    } catch (err) {
      console.error('[member:update] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 从组移除（软删除）
  ipcMain.handle('member:remove', async (_evt, payload) => {
    try {
      return await memberService.remove(payload)
    } catch (err) {
      console.error('[member:remove] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 超级管理员：将用户加入课题组（组管可多组；导师/学生单组）
  ipcMain.handle('member:adminAdd', async (_evt, payload) => {
    try {
      return await memberService.adminAdd(payload)
    } catch (err) {
      console.error('[member:adminAdd] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 超级管理员：将用户移出课题组
  ipcMain.handle('member:adminRemove', async (_evt, payload) => {
    try {
      return await memberService.adminRemove(payload)
    } catch (err) {
      console.error('[member:adminRemove] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 超级管理员：导师/学生原子替换课题组
  ipcMain.handle('member:adminReplace', async (_evt, payload) => {
    try {
      return await memberService.adminReplace(payload)
    } catch (err) {
      console.error('[member:adminReplace] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })
}

module.exports = { register }
