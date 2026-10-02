/**
 * 路由层（IPC Layer）—— 一对一聊天路由（chat:* 前缀）
 *
 * 权限闸门：
 *   - 聊天为全平台功能：任意已登录启用用户可发起会话 / 收发消息 / 撤回 / 已读（无角色差异）；
 *   - chat:count-sessions（删除用户前影响提示）仅超管可调用。
 * 身份一律取自主进程会话（authService.getCurrentUser），不信任前端传入的 userId / role。
 */
const chatService = require('../services/chatService')
const authService = require('../services/authService')
const ApiError = require('../services/apiError')
const { handler } = require('./helper')
const { ROLE_SUPER_ADMIN } = require('../../shared/constants')

// 任意已登录用户
async function requireLogin() {
  const u = await authService.getCurrentUser()
  if (!u) throw new ApiError('未登录，请重新登录', 401)
  return u
}

// 仅超管（删除用户影响提示）
async function requireSuperAdmin() {
  const u = await authService.getCurrentUser()
  if (!u) throw new ApiError('未登录，请重新登录', 401)
  if (u.role !== ROLE_SUPER_ADMIN) throw new ApiError('无权限：仅超级管理员可执行此操作', 403)
  return u
}

function register(ipcMain) {
  // 发起或打开会话（目标用户 ID）
  ipcMain.handle('chat:open-or-create', handler(async (_evt, payload) => {
    await requireLogin()
    return chatService.openOrCreateSession(payload && payload.targetUserId)
  }))

  // 我的会话列表（含未读）
  ipcMain.handle('chat:list-sessions', handler(async () => {
    await requireLogin()
    return chatService.listSessions()
  }))

  // 会话历史（首屏最近 50 条 / 上拉加载更早）
  ipcMain.handle('chat:get-history', handler(async (_evt, payload) => {
    await requireLogin()
    const { sessionId, beforeId, limit } = payload || {}
    return chatService.getHistory(sessionId, beforeId, limit)
  }))

  // 增量拉取（事件推送后的兜底）
  ipcMain.handle('chat:get-increment', handler(async (_evt, payload) => {
    await requireLogin()
    const { sessionId, afterId, limit } = payload || {}
    return chatService.getIncrement(sessionId, afterId, limit)
  }))

  // 发送消息（客户端消息 ID 幂等）
  ipcMain.handle('chat:send-message', handler(async (_evt, payload) => {
    await requireLogin()
    const { sessionId, clientMessageId, content } = payload || {}
    return chatService.sendMessage(sessionId, clientMessageId, content)
  }))

  // 标记已读（游标单调递增）
  ipcMain.handle('chat:mark-read', handler(async (_evt, payload) => {
    await requireLogin()
    const { sessionId, lastReadId } = payload || {}
    return chatService.markRead(sessionId, lastReadId)
  }))

  // 总未读数（角标）
  ipcMain.handle('chat:unread-count', handler(async () => {
    await requireLogin()
    return chatService.unreadCount()
  }))

  // 撤回消息（2 分钟内，仅自己的）
  ipcMain.handle('chat:recall-message', handler(async (_evt, payload) => {
    await requireLogin()
    const { sessionId, messageId } = payload || {}
    return chatService.recallMessage(sessionId, messageId)
  }))

  // 全平台启用用户列表（发起新会话选人）
  ipcMain.handle('chat:user-options', handler(async (_evt, payload) => {
    await requireLogin()
    return chatService.listChatCandidates(payload || {})
  }))

  // 删除用户前的会话数（超管）
  ipcMain.handle('chat:count-sessions', handler(async (_evt, payload) => {
    await requireSuperAdmin()
    return chatService.countSessions(payload && payload.userId)
  }))
}

module.exports = { register }
