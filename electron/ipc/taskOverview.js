/**
 * 路由层（IPC Layer）—— 超管任务总览（task-overview:* 前缀）
 *
 * 权限闸门：仅超级管理员（只读总览），不注册任何任务写操作接口。
 */
const taskOverviewService = require('../services/taskOverviewService')
const authService = require('../services/authService')
const ApiError = require('../services/apiError')
const { handler } = require('./helper')
const { ROLE_SUPER_ADMIN } = require('../../shared/constants')

async function requireSuperAdmin() {
  const u = await authService.getCurrentUser()
  if (!u) throw new ApiError('未登录，请重新登录', 401)
  if (u.role !== ROLE_SUPER_ADMIN) throw new ApiError('无权限：仅超级管理员可查看任务总览', 403)
  return u
}

function register(ipcMain) {
  ipcMain.handle('task-overview:list', handler(async (_evt, payload) => {
    await requireSuperAdmin()
    return taskOverviewService.overviewList(payload || {})
  }))

  ipcMain.handle('task-overview:detail', handler(async (_evt, payload) => {
    await requireSuperAdmin()
    return taskOverviewService.overviewDetail(payload && payload.id)
  }))

  ipcMain.handle('task-overview:stats', handler(async () => {
    await requireSuperAdmin()
    return taskOverviewService.overviewStats()
  }))
}

module.exports = { register }
