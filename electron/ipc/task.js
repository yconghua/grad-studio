/**
 * 路由层（IPC Layer）—— 任务模块（task:* 前缀）
 *
 * 权限闸门（角色仅做第一道粗筛，细粒度校验在 taskService 内基于会话完成）：
 *   - 创建/编辑/删除/恢复/分配/移除/验收/取消/重新打开：组管、导师
 *     （服务层再校验「仅创建者可操作」）；
 *   - 提交进展/完成任务/详情/动态/统计/摘要：组管、导师、学生
 *     （服务层再校验「仅参与人可提交」）；
 *   - 超管不注册业务任务接口，只读总览走 task-overview:*。
 * 不提供评论、催办、提醒学生类接口。
 */
const taskService = require('../services/taskService')
const authService = require('../services/authService')
const ApiError = require('../services/apiError')
const { handler } = require('./helper')
const { ROLE_GROUP_ADMIN, ROLE_MENTOR, ROLE_STUDENT, ROLE_SUPER_ADMIN } = require('../../shared/constants')

// 校验当前用户属于指定角色之一
async function requireRole(...roles) {
  const u = await authService.getCurrentUser()
  if (!u) throw new ApiError('未登录，请重新登录', 401)
  if (!roles.includes(u.role)) throw new ApiError('无权限：无权执行此操作', 403)
  return u
}

function register(ipcMain) {
  ipcMain.handle('task:create', handler(async (_evt, payload) => {
    await requireRole(ROLE_GROUP_ADMIN, ROLE_MENTOR)
    return taskService.createTask(payload || {})
  }))

  ipcMain.handle('task:list', handler(async (_evt, payload) => {
    await requireRole(ROLE_GROUP_ADMIN, ROLE_MENTOR, ROLE_STUDENT)
    return taskService.listTasks(payload || {})
  }))

  ipcMain.handle('task:detail', handler(async (_evt, payload) => {
    await requireRole(ROLE_GROUP_ADMIN, ROLE_MENTOR, ROLE_STUDENT)
    return taskService.getTaskDetail(payload && payload.id)
  }))

  ipcMain.handle('task:update', handler(async (_evt, payload) => {
    await requireRole(ROLE_GROUP_ADMIN, ROLE_MENTOR)
    const { id, data } = payload || {}
    return taskService.updateTask(id, data || {})
  }))

  ipcMain.handle('task:delete', handler(async (_evt, payload) => {
    await requireRole(ROLE_GROUP_ADMIN, ROLE_MENTOR)
    return taskService.deleteTask(payload && payload.id)
  }))

  ipcMain.handle('task:restore', handler(async (_evt, payload) => {
    await requireRole(ROLE_GROUP_ADMIN, ROLE_MENTOR)
    return taskService.restoreTask(payload && payload.id)
  }))

  ipcMain.handle('task:add-participants', handler(async (_evt, payload) => {
    await requireRole(ROLE_GROUP_ADMIN, ROLE_MENTOR)
    const { id, data } = payload || {}
    return taskService.addParticipants(id, data || {})
  }))

  ipcMain.handle('task:remove-participant', handler(async (_evt, payload) => {
    await requireRole(ROLE_GROUP_ADMIN, ROLE_MENTOR)
    const { id, data } = payload || {}
    return taskService.removeParticipant(id, data || {})
  }))

  ipcMain.handle('task:participant-options', handler(async () => {
    await requireRole(ROLE_GROUP_ADMIN, ROLE_MENTOR)
    return taskService.listParticipantOptions()
  }))

  ipcMain.handle('task:submit-progress', handler(async (_evt, payload) => {
    await requireRole(ROLE_GROUP_ADMIN, ROLE_MENTOR, ROLE_STUDENT)
    const { id, data } = payload || {}
    return taskService.submitProgress(id, data || {})
  }))

  ipcMain.handle('task:complete', handler(async (_evt, payload) => {
    await requireRole(ROLE_GROUP_ADMIN, ROLE_MENTOR, ROLE_STUDENT)
    return taskService.completeTask(payload && payload.id)
  }))

  ipcMain.handle('task:verify', handler(async (_evt, payload) => {
    await requireRole(ROLE_GROUP_ADMIN, ROLE_MENTOR)
    const { id, data } = payload || {}
    return taskService.verifyTask(id, data || {})
  }))

  ipcMain.handle('task:cancel', handler(async (_evt, payload) => {
    await requireRole(ROLE_GROUP_ADMIN, ROLE_MENTOR)
    return taskService.cancelTask(payload && payload.id)
  }))

  ipcMain.handle('task:reopen', handler(async (_evt, payload) => {
    await requireRole(ROLE_GROUP_ADMIN, ROLE_MENTOR)
    return taskService.reopenTask(payload && payload.id)
  }))

  ipcMain.handle('task:dynamics', handler(async (_evt, payload) => {
    await requireRole(ROLE_GROUP_ADMIN, ROLE_MENTOR, ROLE_STUDENT)
    const { id, page } = payload || {}
    return taskService.listDynamics(id, { page })
  }))

  ipcMain.handle('task:stats', handler(async () => {
    await requireRole(ROLE_GROUP_ADMIN, ROLE_MENTOR, ROLE_STUDENT)
    return taskService.getTaskStats()
  }))

  ipcMain.handle('task:summary', handler(async () => {
    await requireRole(ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN, ROLE_MENTOR, ROLE_STUDENT)
    return taskService.getTaskSummary()
  }))
}

module.exports = { register }
