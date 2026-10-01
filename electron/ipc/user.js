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
const { dialog, BrowserWindow, app } = require('electron')
const fs = require('fs')
const path = require('path')

// 批量新增 CSV 模板（固定表头，与前端解析列名严格一致；密码不放模板，统一走角色默认密码）
const BATCH_CSV_TEMPLATE = '用户名,真实姓名,角色,手机号,邮箱,性别,所属课题组,导师,启用状态'

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

  // 当前登录用户更新自己的资料（个人资料页）：仅需登录，修改主体为会话用户
  ipcMain.handle('user:update-own-profile', handler(async (_evt, payload) => {
    const u = await authService.getCurrentUser()
    if (!u) throw new ApiError('未登录，请重新登录', 401)
    return userService.updateOwnProfile(payload || {})
  }))

  // 重置密码（超管）：取目标角色默认密码，置强制改密标记与最近重置时间
  ipcMain.handle('user:reset-password', handler(async (_evt, payload) => {
    await requireSuperAdmin()
    return userService.resetPassword(payload && payload.id)
  }))

  // 批量启用/禁用（超管）
  ipcMain.handle('user:batch-status', handler(async (_evt, payload) => {
    await requireSuperAdmin()
    const { ids, status } = payload || {}
    return userService.batchUpdateStatus(ids, status)
  }))

  // 批量删除（超管）
  ipcMain.handle('user:batch-delete', handler(async (_evt, payload) => {
    await requireSuperAdmin()
    return userService.batchDelete((payload && payload.ids) || [])
  }))

  // 批量新增用户（超管）：rows 为解析后的用户数组
  ipcMain.handle('user:batch-create', handler(async (_evt, payload) => {
    await requireSuperAdmin()
    return userService.batchCreateUsers((payload && payload.rows) || [])
  }))

  // 全部用户名（超管）：批量导入预览预检用户名重复
  ipcMain.handle('user:usernames', handler(async () => {
    await requireSuperAdmin()
    return userService.listAllUsernames()
  }))

  // 下载批量新增 CSV 模板（超管）：主进程保存对话框 + 写 UTF-8 BOM 文件
  ipcMain.handle('user:download-csv-template', handler(async (evt) => {
    await requireSuperAdmin()
    const win = BrowserWindow.fromWebContents(evt.sender)
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: '保存批量新增模板',
      defaultPath: path.join(app.getPath('documents'), '批量新增用户模板.csv'),
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (canceled || !filePath) return { canceled: true }
    fs.writeFileSync(filePath, '\uFEFF' + BATCH_CSV_TEMPLATE, 'utf8')
    return { canceled: false, path: filePath }
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
