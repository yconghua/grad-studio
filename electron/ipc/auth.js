/**
 * 路由层（IPC Layer）—— 认证相关路由（auth:* 前缀）
 *
 * 本模块只做一件事：把渲染层发来的 auth:* 调用，转交给 authService 处理。
 * 这里不写任何 SQL、不做密码哈希、不碰仓库；所有业务都在 authService。
 * 仅做一层防御性 catch，把意外异常收敛成统一的 { success, message } 外壳，
 * 保证渲染层永远拿到结构化结果（与旧 main.js 中各 handler 的返回形态保持一致）。
 */
const authService = require('../services/authService')

// 注册所有 auth:* 路由。ipcMain 由 main.js 传入，便于聚合与测试。
function register(ipcMain) {
  // 登录校验
  ipcMain.handle('auth:login', async (_evt, payload) => {
    try {
      return await authService.login(payload)
    } catch (err) {
      console.error('[auth:login] 未预期异常:', err)
      return { success: false, message: '登录失败，请稍后重试' }
    }
  })

  // 退出登录
  ipcMain.handle('auth:logout', async () => {
    try {
      return authService.logout()
    } catch (err) {
      console.error('[auth:logout] 未预期异常:', err)
      return { success: false, message: '退出失败，请稍后重试' }
    }
  })

  // 取当前登录用户
  ipcMain.handle('auth:get-current-user', async () => {
    try {
      return authService.getCurrentUser()
    } catch (err) {
      console.error('[auth:get-current-user] 未预期异常:', err)
      return null
    }
  })

  // 修改密码
  ipcMain.handle('auth:change-password', async (_evt, payload) => {
    try {
      return await authService.changePassword(payload)
    } catch (err) {
      console.error('[auth:change-password] 未预期异常:', err)
      return { success: false, message: '修改失败，请稍后重试' }
    }
  })

  // 用户列表（仅管理员）
  ipcMain.handle('auth:list-users', async () => {
    try {
      return await authService.listUsers()
    } catch (err) {
      console.error('[auth:list-users] 未预期异常:', err)
      return { success: false, message: '读取用户列表失败' }
    }
  })

  // 新增用户
  ipcMain.handle('auth:create-user', async (_evt, payload) => {
    try {
      return await authService.createUser(payload)
    } catch (err) {
      console.error('[auth:create-user] 未预期异常:', err)
      return { success: false, message: '创建失败，请稍后重试' }
    }
  })

  // 编辑用户（可重置密码）
  ipcMain.handle('auth:update-user', async (_evt, payload) => {
    try {
      return await authService.updateUser(payload)
    } catch (err) {
      console.error('[auth:update-user] 未预期异常:', err)
      return { success: false, message: '更新失败，请稍后重试' }
    }
  })

  // 删除用户
  ipcMain.handle('auth:delete-user', async (_evt, payload) => {
    try {
      return await authService.deleteUser(payload)
    } catch (err) {
      console.error('[auth:delete-user] 未预期异常:', err)
      return { success: false, message: '删除失败，请稍后重试' }
    }
  })
}

module.exports = { register }
