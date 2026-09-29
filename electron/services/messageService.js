/**
 * 站内消息服务（Service Layer）—— message 消息中心
 *
 * 权限：登录用户本人。所有查询与已读操作均以 currentUserId 作为 receiver_id 限定，
 * 不提供跨用户读取 / 发送接口（消息由其他业务模块通过 sendMessage 内部生成）。
 */
const permission = require('./permission')
const messageRepository = require('../db/repositories/messageRepository')

// 惰性取 noticeService：本模块被 noticeService 顶层引用，若此处顶层 require 会形成循环依赖
function getNoticeService() {
  return require('./noticeService')
}

// 惰性取 chatService：聊天已读联动（聊天 mark-read 时同步铃铛，反向亦然）
function getChatService() {
  return require('./chatService')
}

// 公告已读联动：把与该公告关联的站内通知消息标记已读（供 noticeService 调用）
async function markNoticeReadSync(noticeId, receiverId) {
  if (!noticeId || !receiverId) return
  try {
    await messageRepository.markReadByRef(receiverId, 'notice', noticeId)
  } catch (err) {
    console.error('[messageService.markNoticeReadSync] 同步消息已读失败:', err)
  }
}

// 生成一条站内消息（供业务模块通知接收人；sender 取当前操作者，未登录场景取 0=系统）
// chatMessageId 仅供聊天双写传入（msg_type='chat' 时关联 chat_message.id）
async function sendMessage({ receiverId, msgType, title, content, refType, refId, chatMessageId }) {
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
      ref_id: refId || 0,
      chat_message_id: chatMessageId || null
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
    const msg = await messageRepository.findById(id)
    await messageRepository.markRead(id, permission.currentUserId())
    // 公告类通知消息已读时，同步标记对应公告已读（公告红点与铃铛保持一致）
    if (msg && msg.ref_type === 'notice' && msg.ref_id > 0 && msg.status === 'unread') {
      await getNoticeService().markRead({ notice_id: msg.ref_id })
    }
    // 聊天类消息已读时，同步聊天会话的已读位置（铃铛与聊天角标保持一致）
    if (msg && msg.ref_type === 'chat' && msg.ref_id > 0 && msg.status === 'unread') {
      await getChatService().markConversationRead({ conversation_id: msg.ref_id })
    }
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
    // 先收集未读公告类消息对应的公告 id，再联动标记公告已读
    const noticeIds = await messageRepository.listUnreadNoticeRefs(permission.currentUserId())
    await messageRepository.markAllRead(permission.currentUserId())
    if (noticeIds.length) {
      const noticeService = getNoticeService()
      for (const noticeId of noticeIds) {
        await noticeService.markRead({ notice_id: noticeId })
      }
    }
    // 聊天会话已读位置同步（聊天角标与铃铛「全部已读」保持一致）
    await getChatService().markAllConversationsRead()
    return { success: true, message: '已全部标记为已读' }
  } catch (err) {
    console.error('[messageService.markAllRead] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

module.exports = {
  sendMessage,
  markNoticeReadSync,
  listMine,
  unreadCount,
  markRead,
  markAllRead
}
