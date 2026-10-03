/**
 * 路由层（IPC Layer）—— 系统配置与公共系统接口路由（system:* 前缀）
 *
 * 权限闸门：
 *   - system:info / database / params-* 仅超级管理员（「系统配置」页三块）；
 *   - system:introduction / check-update 所有登录角色可用（头像下拉「系统简介 / 检查更新」）。
 */
const systemService = require('../services/systemService')
const authService = require('../services/authService')
const ApiError = require('../services/apiError')
const { handler } = require('./helper')
const { ROLE_SUPER_ADMIN } = require('../../shared/constants')

// 仅超级管理员
async function requireSuperAdmin() {
  const u = await authService.getCurrentUser()
  if (!u) throw new ApiError('未登录，请重新登录', 401)
  if (u.role !== ROLE_SUPER_ADMIN) throw new ApiError('无权限：仅超级管理员可执行此操作', 403)
  return u
}

// 任意已登录角色
async function requireLogin() {
  const u = await authService.getCurrentUser()
  if (!u) throw new ApiError('未登录，请重新登录', 401)
  return u
}

function register(ipcMain) {
  // 系统信息（超级管理员「系统配置」块 1）
  ipcMain.handle('system:info', handler(async () => {
    await requireSuperAdmin()
    return systemService.getInfo()
  }))

  // 数据库信息（超级管理员「系统配置」块 2）
  ipcMain.handle('system:database', handler(async () => {
    await requireSuperAdmin()
    return systemService.getDatabaseInfo()
  }))

  // 系统参数列表（超级管理员「系统配置」块 3）
  ipcMain.handle('system:params-list', handler(async (_evt, payload) => {
    await requireSuperAdmin()
    return systemService.listParams(payload || {})
  }))
  ipcMain.handle('system:params-create', handler(async (_evt, payload) => {
    await requireSuperAdmin()
    return systemService.createParam(payload || {})
  }))
  ipcMain.handle('system:params-update', handler(async (_evt, payload) => {
    await requireSuperAdmin()
    const { id, data } = payload || {}
    return systemService.updateParam(id, data || {})
  }))
  ipcMain.handle('system:params-delete', handler(async (_evt, payload) => {
    await requireSuperAdmin()
    return systemService.deleteParam(payload && payload.id)
  }))

  // 系统简介（所有角色）
  ipcMain.handle('system:introduction', handler(async () => {
    await requireLogin()
    return systemService.getIntroduction()
  }))
}

module.exports = { register }
