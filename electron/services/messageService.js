/**
 * 站内消息服务（Service Layer）—— message 消息中心
 *
 * 权限：登录用户本人。所有查询与已读操作均以 currentUserId 作为 receiver_id 限定，
 * 不提供跨用户读取 / 发送接口（消息由其他业务模块通过 sendMessage 内部生成）。
 */
const permission = require('./permission')
const messageRepository = require('../db/repositories/messageRepository')

// 生成一条站内消息（供业务模块通知接收人；sender 取当前操作者，未登录场景取 0=系统）
async function sendMessage({ receiverId, msgType, title, content, refType, refId }) {
  if (!receiverId) return
  try {
    await messageRepository.create({
      sender_id: permission.currentUserId() || 0,
      receiver_id: receiverId,
      msg_type: msgType || 'system',
      title: title || '',
      content: content || '',
      status: 'unread',
      ref_type: refType || '',
      ref_id: refId || 0
    })
  } catch (err) {
    console.error('[messageService.sendMessage] 写入消息失败:', err)
  }
}

// 我的消息列表：receiver_id = 当前用户，可按 status / msg_type 过滤
async function listMine(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  try {
    const rows = await messageRepository.listMine({
      receiverId: permission.currentUserId(),
      status: payload.status,
      msgType: payload.msg_type
    })
    return { success: true, data: rows }
  } catch (err) {
    console.error('[messageService.listMine] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// 我的未读消息数
async function unreadCount() {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  try {
    const total = await messageRepository.countUnread(permission.currentUserId())
    return { success: true, data: { total } }
  } catch (err) {
    console.error('[messageService.unreadCount] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// 标记单条已读（Repository 内已校验 receiver_id 归属）
async function markRead(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const { id } = payload
  if (!id) return { success: false, message: '缺少消息标识' }
  try {
    await messageRepository.markRead(id, permission.currentUserId())
    return { success: true, message: '已标记为已读' }
  } catch (err) {
    console.error('[messageService.markRead] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// 一键标记我的全部未读消息为已读
async function markAllRead() {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  try {
    await messageRepository.markAllRead(permission.currentUserId())
    return { success: true, message: '已全部标记为已读' }
  } catch (err) {
    console.error('[messageService.markAllRead] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

module.exports = {
  sendMessage,
  listMine,
  unreadCount,
  markRead,
  markAllRead
}
