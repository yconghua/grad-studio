/**
 * 路由层（IPC Layer）—— 课题组公告（notice:* 前缀）
 *
 * 权限闸门：
 *   - notice:list 任意已登录角色（可见范围由 noticeService 按角色收敛）；
 *   - notice:create / update / delete / top / read-stats 仅超管 / 组管
 *     （组归属校验在 noticeService：组管只能操作本组，导师/学生一律 403）；
 *   - notice:read-self 仅导师 / 学生（标记自己已读）。
 * 角色与归属判定统一基于主进程会话，不信任前端传入的 role / groupId。
 */
const noticeService = require('../services/noticeService')
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
  ipcMain.handle('notice:list', handler(async (_evt, payload) => {
    await requireRole(ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN, ROLE_MENTOR, ROLE_STUDENT)
    return noticeService.listNotices(payload || {})
  }))
  ipcMain.handle('notice:get', handler(async (_evt, payload) => {
    await requireRole(ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN, ROLE_MENTOR, ROLE_STUDENT)
    return noticeService.getNoticeForUser(payload && payload.id)
  }))
  ipcMain.handle('notice:create', handler(async (_evt, payload) => {
    await requireRole(ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN)
    return noticeService.createNotice(payload || {})
  }))
  ipcMain.handle('notice:update', handler(async (_evt, payload) => {
    await requireRole(ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN)
    const { id, data } = payload || {}
    return noticeService.updateNotice(id, data || {})
  }))
  ipcMain.handle('notice:delete', handler(async (_evt, payload) => {
    await requireRole(ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN)
    return noticeService.deleteNotice(payload && payload.id)
  }))
  ipcMain.handle('notice:top', handler(async (_evt, payload) => {
    await requireRole(ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN)
    return noticeService.toggleTop(payload && payload.id)
  }))
  ipcMain.handle('notice:read-stats', handler(async (_evt, payload) => {
    await requireRole(ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN)
    return noticeService.readStats(payload && payload.id)
  }))
  ipcMain.handle('notice:read-self', handler(async (_evt, payload) => {
    await requireRole(ROLE_MENTOR, ROLE_STUDENT)
    return noticeService.markRead(payload && payload.id)
  }))
  ipcMain.handle('notice:read-all', handler(async () => {
    await requireRole(ROLE_MENTOR, ROLE_STUDENT)
    return noticeService.markAllRead()
  }))
  ipcMain.handle('notice:unread-count', handler(async () => {
    await requireRole(ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN, ROLE_MENTOR, ROLE_STUDENT)
    // 未读角标口径由服务端收敛：仅导师/学生返回真实未读数，超管/组管固定为 0
    return noticeService.unreadCount()
  }))
}

module.exports = { register }
