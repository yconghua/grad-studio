/**
 * 路由层（IPC Layer）—— 用户管理路由（user:* 前缀）
 *
 * 权限闸门：
 *   - user:list / create / detail / update-account / update-profile / delete 仅超级管理员；
 *   - user:candidates（选择未入组用户加入课题组）超级管理员与课题组管理员可用。
 * 业务校验（超级管理员唯一、默认密码、物理删除约束等）在 userService。
 */
const userService = require('../services/userService')
const authService = require('../services/authService')
const ApiError = require('../services/apiError')
const { handler } = require('./helper')
const { ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN } = require('../../shared/constants')

// 仅超级管理员
async function requireSuperAdmin() {
  const u = await authService.getCurrentUser()
  if (!u) throw new ApiError('未登录，请重新登录', 401)
  if (u.role !== ROLE_SUPER_ADMIN) throw new ApiError('无权限：仅超级管理员可执行此操作', 403)
  return u
}

// 超级管理员或课题组管理员
async function requireAdminOrGroupAdmin() {
  const u = await authService.getCurrentUser()
  if (!u) throw new ApiError('未登录，请重新登录', 401)
  if (u.role !== ROLE_SUPER_ADMIN && u.role !== ROLE_GROUP_ADMIN) {
    throw new ApiError('无权限：仅管理员可执行此操作', 403)
  }
  return u
}

function register(ipcMain) {
  // 用户分页列表
  ipcMain.handle('user:list', handler(async (_evt, payload) => {
    await requireSuperAdmin()
    return userService.listUsers(payload || {})
  }))

  // 新增用户
  ipcMain.handle('user:create', handler(async (_evt, payload) => {
    await requireSuperAdmin()
    return userService.createUser(payload || {})
  }))

  // 用户详情
  ipcMain.handle('user:detail', handler(async (_evt, payload) => {
    await requireSuperAdmin()
    return userService.getUser(payload && payload.id)
  }))

  // 账号密码 Tab 保存
  ipcMain.handle('user:update-account', handler(async (_evt, payload) => {
    await requireSuperAdmin()
    const { id, data } = payload || {}
    return userService.updateAccount(id, data || {})
  }))

  // 资料 Tab 保存
  ipcMain.handle('user:update-profile', handler(async (_evt, payload) => {
    await requireSuperAdmin()
    const { id, data } = payload || {}
    return userService.updateProfile(id, data || {})
  }))

  // 删除用户（物理删除）
  ipcMain.handle('user:delete', handler(async (_evt, payload) => {
    await requireSuperAdmin()
    return userService.deleteUser(payload && payload.id)
  }))

  // 候选人列表（未入组的导师/学生，供「加入课题组」选人）
  ipcMain.handle('user:candidates', handler(async (_evt, payload) => {
    await requireAdminOrGroupAdmin()
    return userService.listCandidates(payload || {})
  }))
}

module.exports = { register }
