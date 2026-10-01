/**
 * 路由层（IPC Layer）—— 认证相关路由（auth:* 前缀）
 *
 * 只做转发：把渲染层发来的 auth:* 调用转交给 authService，
 * 这里不写 SQL、不做哈希、不碰仓库；统一异常转码由 helper.handler 完成。
 */
const authService = require('../services/authService')
const ApiError = require('../services/apiError')
const { handler } = require('./helper')

function register(ipcMain) {
  // 登录校验（用户名/密码区分大小写）
  ipcMain.handle('auth:login', handler((_evt, payload) => authService.login(payload || {})))

  // 退出登录（清除登录态）
  ipcMain.handle('auth:logout', handler(() => authService.logout()))

  // 当前登录用户（回库刷新；未登录返回 401）
  ipcMain.handle('auth:get-current-user', handler(async () => {
    const user = await authService.getCurrentUser()
    if (!user) throw new ApiError('未登录，请重新登录', 401)
    return user
  }))

  // 修改密码（个人修改 / 首次登录强制改密共用）
  ipcMain.handle('auth:change-password', handler((_evt, payload) => authService.changePassword(payload || {})))
}

module.exports = { register }
