/**
 * 路由层（IPC Layer）—— 课题组与成员路由（group:* / group-admin:* / mentor:* 前缀）
 *
 * 权限闸门：
 *   - group:list / create / detail / update / delete 仅超级管理员；
 *   - group-admin:* 仅课题组管理员（且只能操作自己绑定的课题组）；
 *   - mentor:students-list 仅导师（只能查看自己名下的学生）。
 * 业务校验（UUID 生成、同一课题组约束、成员解绑等）在 groupService。
 */
const groupService = require('../services/groupService')
const authService = require('../services/authService')
const ApiError = require('../services/apiError')
const { handler } = require('./helper')
const { ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN, ROLE_MENTOR } = require('../../shared/constants')

// 校验当前用户属于指定角色之一
async function requireRole(...roles) {
  const u = await authService.getCurrentUser()
  if (!u) throw new ApiError('未登录，请重新登录', 401)
  if (!roles.includes(u.role)) throw new ApiError('无权限：无权执行此操作', 403)
  return u
}

function register(ipcMain) {
  // ===== 超级管理员：课题组管理 =====
  ipcMain.handle('group:list', handler(async (_evt, payload) => {
    await requireRole(ROLE_SUPER_ADMIN)
    return groupService.listGroups(payload || {})
  }))
  ipcMain.handle('group:create', handler(async (_evt, payload) => {
    await requireRole(ROLE_SUPER_ADMIN)
    return groupService.createGroup(payload || {})
  }))
  ipcMain.handle('group:detail', handler(async (_evt, payload) => {
    await requireRole(ROLE_SUPER_ADMIN)
    return groupService.getGroup(payload && payload.id)
  }))
  ipcMain.handle('group:update', handler(async (_evt, payload) => {
    await requireRole(ROLE_SUPER_ADMIN)
    const { id, data } = payload || {}
    return groupService.updateGroup(id, data || {})
  }))
  ipcMain.handle('group:delete', handler(async (_evt, payload) => {
    await requireRole(ROLE_SUPER_ADMIN)
    return groupService.deleteGroup(payload && payload.id)
  }))

  // ===== 课题组管理员：本课题组 =====
  ipcMain.handle('group-admin:get-own', handler(async () => {
    await requireRole(ROLE_GROUP_ADMIN)
    return groupService.getOwnGroup()
  }))
  ipcMain.handle('group-admin:update-own', handler(async (_evt, payload) => {
    await requireRole(ROLE_GROUP_ADMIN)
    return groupService.updateOwnGroup((payload && payload.data) || {})
  }))
  ipcMain.handle('group-admin:members-list', handler(async (_evt, payload) => {
    await requireRole(ROLE_GROUP_ADMIN)
    return groupService.listMembers(payload || {})
  }))
  ipcMain.handle('group-admin:members-add', handler(async (_evt, payload) => {
    await requireRole(ROLE_GROUP_ADMIN)
    return groupService.addMembers(payload || {})
  }))
  ipcMain.handle('group-admin:member-remove', handler(async (_evt, payload) => {
    await requireRole(ROLE_GROUP_ADMIN)
    return groupService.removeMember(payload && payload.userId)
  }))
  ipcMain.handle('group-admin:students-list', handler(async (_evt, payload) => {
    await requireRole(ROLE_GROUP_ADMIN)
    return groupService.listStudents(payload || {})
  }))
  ipcMain.handle('group-admin:set-student-mentor', handler(async (_evt, payload) => {
    await requireRole(ROLE_GROUP_ADMIN)
    const { studentId, data } = payload || {}
    return groupService.setStudentMentor(studentId, data || {})
  }))

  // ===== 导师：我的学生 =====
  ipcMain.handle('mentor:students-list', handler(async (_evt, payload) => {
    await requireRole(ROLE_MENTOR)
    return groupService.listMentorStudents(payload || {})
  }))
}

module.exports = { register }
