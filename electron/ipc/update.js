/**
 * 路由层（IPC Layer）—— 应用更新路由（update:* 前缀）
 *
 * 权限闸门：任意已登录角色可用（头像下拉「检查更新」）。
 * 事件推送：主进程经 update:event 通道向渲染层推送检查 / 下载 / 安装进度。
 */
const updaterService = require('../services/updaterService')
const authService = require('../services/authService')
const ApiError = require('../services/apiError')
const { handler } = require('./helper')

// 任意已登录用户
async function requireLogin() {
  const u = await authService.getCurrentUser()
  if (!u) throw new ApiError('未登录，请重新登录', 401)
  return u
}

function register(ipcMain) {
  // 检查更新（结果经 update:event 推送）
  ipcMain.handle('update:check', handler(async () => {
    await requireLogin()
    return updaterService.check()
  }))

  // 下载更新（进度经 update:event 推送）
  ipcMain.handle('update:download', handler(async () => {
    await requireLogin()
    return updaterService.download()
  }))

  // 安装更新（退出应用并运行安装器）
  ipcMain.handle('update:install', handler(async () => {
    await requireLogin()
    return updaterService.install()
  }))

  // 当前更新状态快照（前端重开弹窗恢复 UI）
  ipcMain.handle('update:get-state', handler(async () => {
    await requireLogin()
    return updaterService.getState()
  }))
}

module.exports = { register }
