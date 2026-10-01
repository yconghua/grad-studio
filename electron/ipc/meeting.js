/**
 * 路由层（IPC Layer）—— 课题组组会（meeting:* 前缀）
 *
 * 权限闸门：
 *   - meeting:list / detail 任意已登录角色（可见范围由 meetingService 按角色收敛）；
 *   - meeting:my-drafts / group-drafts 仅超管 / 组管（导师、学生服务端也 403）；
 *   - meeting:create / update / publish / publish-as-notice / delete / archive /
 *     stats / member-options 仅超管 / 组管（组归属与创建者校验在 meetingService）。
 * 角色与归属判定统一基于主进程会话，不信任前端传入的 role / groupId / hostId。
 */
const meetingService = require('../services/meetingService')
const authService = require('../services/authService')
const ApiError = require('../services/apiError')
const { handler } = require('./helper')
const { ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN, ROLE_MENTOR, ROLE_STUDENT } = require('../../shared/constants')

// 校验当前用户属于指定角色之一
async function requireRole(...roles) {
  const u = await authService.getCurrentUser()
  if (!u) throw new ApiError('未登录，请重新登录', 401)
  if (!roles.includes(u.role)) throw new ApiError('无权限：无权执行此操作', 403)
  return u
}

function register(ipcMain) {
  ipcMain.handle('meeting:list', handler(async (_evt, payload) => {
    await requireRole(ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN, ROLE_MENTOR, ROLE_STUDENT)
    return meetingService.listMeetings(payload || {})
  }))
  ipcMain.handle('meeting:my-drafts', handler(async (_evt, payload) => {
    await requireRole(ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN)
    return meetingService.listMyDrafts(payload || {})
  }))
  ipcMain.handle('meeting:group-drafts', handler(async (_evt, payload) => {
    await requireRole(ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN)
    return meetingService.listGroupDrafts(payload || {})
  }))
  ipcMain.handle('meeting:detail', handler(async (_evt, payload) => {
    await requireRole(ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN, ROLE_MENTOR, ROLE_STUDENT)
    return meetingService.getMeetingDetail(payload && payload.id)
  }))
  ipcMain.handle('meeting:create', handler(async (_evt, payload) => {
    await requireRole(ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN)
    return meetingService.createMeeting(payload || {})
  }))
  ipcMain.handle('meeting:update', handler(async (_evt, payload) => {
    await requireRole(ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN)
    const { id, data } = payload || {}
    return meetingService.updateMeeting(id, data || {})
  }))
  ipcMain.handle('meeting:publish', handler(async (_evt, payload) => {
    await requireRole(ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN)
    return meetingService.publishMeeting(payload && payload.id)
  }))
  ipcMain.handle('meeting:publish-as-notice', handler(async (_evt, payload) => {
    await requireRole(ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN)
    return meetingService.publishAsNotice(payload && payload.id)
  }))
  ipcMain.handle('meeting:delete', handler(async (_evt, payload) => {
    await requireRole(ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN)
    return meetingService.deleteMeeting(payload && payload.id)
  }))
  ipcMain.handle('meeting:archive', handler(async (_evt, payload) => {
    await requireRole(ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN)
    return meetingService.toggleArchive(payload && payload.id)
  }))
  ipcMain.handle('meeting:stats', handler(async (_evt, payload) => {
    await requireRole(ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN)
    return meetingService.getMeetingStats(payload && payload.groupId)
  }))
  ipcMain.handle('meeting:member-options', handler(async (_evt, payload) => {
    await requireRole(ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN)
    return meetingService.listMemberOptions(payload && payload.groupId)
  }))
  ipcMain.handle('meeting:recent', handler(async () => {
    await requireRole(ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN, ROLE_MENTOR, ROLE_STUDENT)
    return meetingService.getRecentMeeting()
  }))
}

module.exports = { register }
