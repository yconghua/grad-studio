/**
 * 路由层（IPC Layer）—— 个人档案相关路由（profile:* 前缀）
 *
 * 只做一层转发：渲染层的 profile:* 调用交给 profileService，
 * 不写 SQL、不做权限判断（权限在 Service 层）。
 */
const profileService = require('../services/profileService')

function register(ipcMain) {
  // 读取当前登录用户自己的档案
  ipcMain.handle('profile:get', async () => {
    try {
      return await profileService.get()
    } catch (err) {
      console.error('[profile:get] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 更新当前登录用户自己的档案（不存在则创建）
  ipcMain.handle('profile:update', async (_evt, payload) => {
    try {
      return await profileService.update(payload)
    } catch (err) {
      console.error('[profile:update] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 超级管理员读取指定用户的档案
  ipcMain.handle('profile:get-by-admin', async (_evt, payload) => {
    try {
      return await profileService.getByAdmin(payload && payload.userId)
    } catch (err) {
      console.error('[profile:get-by-admin] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 超级管理员更新指定用户的档案（不存在则创建）
  ipcMain.handle('profile:update-by-admin', async (_evt, payload) => {
    try {
      return await profileService.updateByAdmin(payload)
    } catch (err) {
      console.error('[profile:update-by-admin] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })
}

module.exports = { register }
