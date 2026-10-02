// 一对一聊天接口（对应 electron/ipc/chat.js，通道前缀 chat:*）
export function openOrCreateChat(targetUserId) {
  return window.api.chat.openOrCreate({ targetUserId })
}
export function listChatSessions() {
  return window.api.chat.listSessions()
}
export function getChatHistory(sessionId, beforeId, limit = 50) {
  return window.api.chat.getHistory({ sessionId, beforeId, limit })
}
export function getChatIncrement(sessionId, afterId, limit = 200) {
  return window.api.chat.getIncrement({ sessionId, afterId, limit })
}
export function sendChatMessage(sessionId, clientMessageId, content) {
  return window.api.chat.sendMessage({ sessionId, clientMessageId, content })
}
export function markChatRead(sessionId, lastReadId) {
  return window.api.chat.markRead({ sessionId, lastReadId })
}
export function getChatUnreadCount() {
  return window.api.chat.unreadCount()
}
export function recallChatMessage(sessionId, messageId) {
  return window.api.chat.recallMessage({ sessionId, messageId })
}
export function getChatUserOptions(keyword, page) {
  return window.api.chat.userOptions({ keyword, page })
}
export function countUserChatSessions(userId) {
  return window.api.chat.countSessions({ userId })
}
// 主进程实时推送订阅（chatPoller 每 2 秒轮询共享库，有变化即推送）；返回取消订阅函数
export function onChatEvent(cb) {
  return window.api.chat.onEvent(cb)
}
