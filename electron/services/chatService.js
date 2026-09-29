/**
 * 聊天服务（Service Layer）—— 聊天模块全部业务逻辑
 *
 * 权限模型（前后端双重保障，本层为最终校验）：
 *   - 仅导师 / 学生可聊天（组管、超管不参与）；
 *   - 可聊对象 = 同课题组内、组内身份为导师/学生的活跃成员（跨组不可聊）；
 *   - 所有会话操作校验本人是该会话成员。
 *
 * 并发与可靠性：
 *   - 发送为「插 chat_message + 双写 message 表 + 更新会话活动时间」单事务，
 *     固定写序降低死锁概率；
 *   - 写事务统一走 runWithRetry：捕获 InnoDB 死锁(1213)/锁等待超时(1205) 自动重试（最多 3 次、指数退避），
 *     保证「两人同时发送」场景不卡死；
 *   - 会话 get-or-create 靠 uk_pair 唯一键 + 冲突后重查，防止并发互发建出两个会话。
 */
const path = require('node:path')
const fs = require('node:fs')
const { app } = require('electron')
const permission = require('./permission')
const chatRepository = require('../db/repositories/chatRepository')
const messageRepository = require('../db/repositories/messageRepository')
const { runTransaction } = require('../db/connection')

// 仅导师 / 学生参与聊天
const CHAT_ROLES = ['mentor', 'student']
// 消息类型白名单
const CONTENT_TYPES = ['text', 'image', 'file']
// 撤回限时：发送后 2 分钟内可撤回
const RECALL_LIMIT_SECONDS = 120
// 附件大小上限参数键（超管在系统配置维护）
const ATTACH_PARAM_KEY = 'chat_attachment_max_mb'
const DEFAULT_ATTACH_MAX_MB = 50
// 图片内嵌预览上限：超过此大小不返回 base64，改为提示点击打开
const PREVIEW_MAX_BYTES = 5 * 1024 * 1024

// 附件 MIME（按扩展名简单映射，未知类型留空）
const MIME_BY_EXT = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain', md: 'text/markdown', zip: 'application/zip'
}

// 本地时间字符串（与 MySQL CURRENT_TIMESTAMP 同口径，供发送后本地回显）
function nowLocal() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// 死锁 / 锁等待超时错误码（mysql2 errno）：可安全重试
const RETRYABLE_ERRORS = new Set([1213, 1205])

// 聊天写事务统一重试封装：命中死锁/锁超时自动重试，其余错误原样抛出
async function runWithRetry(fn, retries = 3) {
  let attempt = 0
  for (;;) {
    try {
      return await fn()
    } catch (err) {
      if (!(err && RETRYABLE_ERRORS.has(err.errno)) || attempt >= retries) throw err
      attempt += 1
      await new Promise((resolve) => setTimeout(resolve, 50 * 2 ** attempt))
    }
  }
}

// 当前用户是否可聊角色
function isChatRole() {
  const role = permission.currentRole()
  return !!role && CHAT_ROLES.includes(role)
}

// 登录 + 可聊角色双重校验
function assertChatUser() {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!isChatRole()) return { success: false, message: '无权限：仅导师和学生可参与聊天' }
  return null
}

// 附件大小上限（超管可配置，默认 50MB）
async function getAttachMaxMb() {
  try {
    const row = await systemParamRepository().findByKey(ATTACH_PARAM_KEY)
    const mb = row ? Number(row.param_value) : DEFAULT_ATTACH_MAX_MB
    return Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_ATTACH_MAX_MB
  } catch (err) {
    return DEFAULT_ATTACH_MAX_MB
  }
}

// 惰性取 systemParamRepository（保持顶层依赖收敛）
function systemParamRepository() {
  return require('../db/repositories/systemParamRepository')
}

// 校验附件路径合法性 + 存在性 + 大小上限，返回实际字节数（不信任前端传的 file_size）
async function validateAttachment(filePath, fileName) {
  if (!filePath || typeof filePath !== 'string') return { error: '缺少附件路径' }
  if (!fileName || !String(fileName).trim()) return { error: '缺少附件文件名' }
  const uploadsDir = path.join(app.getPath('userData'), 'uploads')
  const resolved = path.resolve(filePath)
  if (!resolved.startsWith(uploadsDir)) return { error: '附件路径不合法' }
  if (!fs.existsSync(resolved)) return { error: '附件文件不存在（可能已被移动或删除）' }
  const stat = fs.statSync(resolved)
  const maxMb = await getAttachMaxMb()
  if (stat.size > maxMb * 1024 * 1024) return { error: `附件超过大小上限（${maxMb}MB）` }
  return { size: stat.size }
}

// 按扩展名取 MIME
function mimeOf(fileName) {
  const ext = String(fileName).split('.').pop().toLowerCase()
  return MIME_BY_EXT[ext] || ''
}

// 铃铛消息预览文案：文本原文 / 图片 / 文件
function messagePreview(contentType, content, fileName) {
  if (contentType === 'image') return `【图片】${fileName || ''}`
  if (contentType === 'file') return `【文件】${fileName || ''}`
  return content || ''
}

// 会话 get-or-create：有序对唯一，并发冲突（1062）后重查复用
async function getOrCreateConversation(me, peerId) {
  const userA = Math.min(me, peerId)
  const userB = Math.max(me, peerId)
  let conv = await chatRepository.findConversationByPair(userA, userB)
  if (conv) return conv
  try {
    const id = await chatRepository.createConversation(userA, userB)
    await chatRepository.createMember(id, userA)
    await chatRepository.createMember(id, userB)
    return { id, user_a: userA, user_b: userB }
  } catch (err) {
    if (err && err.errno === 1062) {
      const existing = await chatRepository.findConversationByPair(userA, userB)
      if (existing) return existing
    }
    throw err
  }
}

// 可聊对象列表：同组内导师/学生（不含自己）
async function listContacts() {
  const denied = assertChatUser()
  if (denied) return denied
  try {
    const rows = await chatRepository.listContacts(permission.currentUserId())
    const data = rows.map((r) => ({
      id: r.id,
      username: r.username,
      real_name: r.real_name,
      role_in_group: r.role_in_group,
      group_id: r.group_id,
      group_name: r.group_name,
      display_name: r.real_name || r.username
    }))
    return { success: true, data }
  } catch (err) {
    console.error('[chatService.listContacts] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// 我的会话列表（含对方信息、最后一条、未读数）
async function listConversations() {
  const denied = assertChatUser()
  if (denied) return denied
  try {
    const me = permission.currentUserId()
    const rows = await chatRepository.listConversations(me)
    const data = rows.map((r) => ({
      conversation_id: r.id,
      updated_at: r.updated_at,
      peer: {
        id: r.peer_id,
        username: r.peer_username,
        real_name: r.peer_real_name,
        role: r.peer_role,
        display_name: r.peer_real_name || r.peer_username
      },
      last_msg_id: r.last_msg_id,
      last_sender_id: r.last_sender_id,
      last_content_type: r.last_content_type,
      last_content: r.last_is_recalled ? '' : (r.last_content || ''),
      last_file_name: r.last_file_name,
      last_is_recalled: r.last_is_recalled,
      last_msg_at: r.last_msg_at,
      unread: Number(r.unread) || 0
    }))
    return { success: true, data }
  } catch (err) {
    console.error('[chatService.listConversations] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// 打开（get-or-create）与某人的 1 对 1 会话；本侧隐藏的会话自动恢复
async function openConversation(payload = {}) {
  const denied = assertChatUser()
  if (denied) return denied
  const me = permission.currentUserId()
  const peerId = Number(payload.user_id)
  if (!Number.isFinite(peerId) || peerId <= 0) return { success: false, message: '缺少聊天对象' }
  if (peerId === me) return { success: false, message: '不能与自己聊天' }
  try {
    const shared = await chatRepository.findSharedGroup(me, peerId)
    if (!shared) return { success: false, message: '仅可与同课题组的导师/学生聊天' }
    const conv = await getOrCreateConversation(me, peerId)
    const member = await chatRepository.findMember(conv.id, me)
    if (member && member.is_hidden === 1) {
      await chatRepository.revealMember(conv.id, me)
    }
    const peer = await chatRepository.getPeer(conv.id, me)
    const data = {
      conversation_id: conv.id,
      peer: peer
        ? { id: peer.id, username: peer.username, real_name: peer.real_name, role: peer.role, role_in_group: peer.role_in_group, display_name: peer.real_name || peer.username }
        : null
    }
    return { success: true, data }
  } catch (err) {
    console.error('[chatService.openConversation] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// 分页拉取会话消息（撤回消息不返回原文与附件）
async function listMessages(payload = {}) {
  const denied = assertChatUser()
  if (denied) return denied
  const me = permission.currentUserId()
  const conversationId = Number(payload.conversation_id)
  if (!Number.isFinite(conversationId) || conversationId <= 0) return { success: false, message: '缺少会话标识' }
  try {
    if (!(await chatRepository.isMember(conversationId, me))) {
      return { success: false, message: '无权查看该会话' }
    }
    const beforeId = Number(payload.before_id) || 0
    let limit = Number(payload.limit) || 30
    if (!Number.isFinite(limit) || limit <= 0) limit = 30
    if (limit > 100) limit = 100
    const rows = await chatRepository.listMessages(conversationId, beforeId, limit)
    // 倒序取回后转升序展示
    const data = rows.reverse().map((r) => ({
      id: r.id,
      conversation_id: r.conversation_id,
      sender_id: r.sender_id,
      content_type: r.content_type,
      content: r.is_recalled ? '' : (r.content || ''),
      file_name: r.is_recalled ? '' : r.file_name,
      file_path: r.is_recalled ? '' : r.file_path,
      file_size: r.is_recalled ? 0 : r.file_size,
      file_mime: r.is_recalled ? '' : r.file_mime,
      is_recalled: r.is_recalled,
      recalled_at: r.recalled_at,
      created_at: r.created_at
    }))
    return { success: true, data }
  } catch (err) {
    console.error('[chatService.listMessages] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// 发送消息：单事务双写（chat_message + message 表）+ 更新会话活动时间
async function sendMessage(payload = {}) {
  const denied = assertChatUser()
  if (denied) return denied
  const me = permission.currentUserId()
  const conversationId = Number(payload.conversation_id)
  const contentType = String(payload.content_type || 'text')
  if (!Number.isFinite(conversationId) || conversationId <= 0) return { success: false, message: '缺少会话标识' }
  if (!CONTENT_TYPES.includes(contentType)) return { success: false, message: '消息类型不合法' }
  const content = String(payload.content || '').trim()
  const fileName = payload.file_name ? String(payload.file_name) : ''
  const filePath = payload.file_path ? String(payload.file_path) : ''
  if (contentType === 'text' && !content) return { success: false, message: '消息内容不能为空' }
  try {
    if (!(await chatRepository.isMember(conversationId, me))) {
      return { success: false, message: '无权在该会话发送消息' }
    }
    const peer = await chatRepository.getPeer(conversationId, me)
    if (!peer) return { success: false, message: '会话对象不存在' }
    let fileSize = 0
    let fileMime = ''
    if (contentType !== 'text') {
      const checked = await validateAttachment(filePath, fileName)
      if (checked.error) return { success: false, message: checked.error }
      fileSize = checked.size
      fileMime = mimeOf(fileName)
    }
    const sender = await chatRepository.getDisplayName(me)
    const senderName = sender ? (sender.real_name || sender.username) : ''

    const msgId = await runWithRetry(() =>
      runTransaction(async () => {
        const id = await chatRepository.createMessage({
          conversation_id: conversationId,
          sender_id: me,
          content_type: contentType,
          content: contentType === 'text' ? content : (content || null),
          file_name: contentType === 'text' ? null : (fileName || null),
          file_path: contentType === 'text' ? null : (filePath || null),
          file_size: contentType === 'text' ? 0 : fileSize,
          file_mime: contentType === 'text' ? null : (fileMime || null)
        })
        // 双写铃铛消息（msg_type=chat，ref_id 存会话 id，chat_message_id 存消息 id）
        await messageRepository.create({
          sender_id: me,
          receiver_id: peer.id,
          msg_type: 'chat',
          title: senderName || '聊天消息',
          content: messagePreview(contentType, content, fileName),
          status: 'unread',
          ref_type: 'chat',
          ref_id: conversationId,
          chat_message_id: id
        })
        await chatRepository.touchConversation(conversationId)
        return id
      })
    )

    return {
      success: true,
      data: {
        id: msgId,
        conversation_id: conversationId,
        sender_id: me,
        content_type: contentType,
        content: contentType === 'text' ? content : (content || ''),
        file_name: contentType === 'text' ? '' : fileName,
        file_path: contentType === 'text' ? '' : filePath,
        file_size: contentType === 'text' ? 0 : fileSize,
        file_mime: contentType === 'text' ? '' : fileMime,
        is_recalled: 0,
        created_at: nowLocal()
      }
    }
  } catch (err) {
    console.error('[chatService.sendMessage] 数据库异常:', err)
    return { success: false, message: '发送失败，请稍后重试' }
  }
}

// 撤回消息：仅发送者、发送后 2 分钟内；同步更新铃铛该条内容
async function recallMessage(payload = {}) {
  const denied = assertChatUser()
  if (denied) return denied
  const me = permission.currentUserId()
  const messageId = Number(payload.message_id)
  if (!Number.isFinite(messageId) || messageId <= 0) return { success: false, message: '缺少消息标识' }
  try {
    const msg = await chatRepository.getMessageById(messageId)
    if (!msg) return { success: false, message: '消息不存在' }
    if (msg.sender_id !== me) return { success: false, message: '仅发送者可撤回消息' }
    if (msg.is_recalled === 1) return { success: false, message: '消息已撤回' }
    const elapsed = (Date.now() - new Date(msg.created_at).getTime()) / 1000
    if (elapsed > RECALL_LIMIT_SECONDS) return { success: false, message: `发送超过 ${RECALL_LIMIT_SECONDS} 秒，无法撤回` }

    await runWithRetry(() =>
      runTransaction(async () => {
        await chatRepository.recallMessage(messageId)
        await messageRepository.updateContentByChatMessage(messageId, '[消息已撤回]')
        await chatRepository.touchConversation(msg.conversation_id)
      })
    )
    return { success: true, message: '消息已撤回' }
  } catch (err) {
    console.error('[chatService.recallMessage] 数据库异常:', err)
    return { success: false, message: '撤回失败，请稍后重试' }
  }
}

// 标记会话已读：更新已读位置 + 同步铃铛该会话全部聊天未读
async function markConversationRead(payload = {}) {
  const denied = assertChatUser()
  if (denied) return denied
  const me = permission.currentUserId()
  const conversationId = Number(payload.conversation_id)
  if (!Number.isFinite(conversationId) || conversationId <= 0) return { success: false, message: '缺少会话标识' }
  try {
    if (!(await chatRepository.isMember(conversationId, me))) {
      return { success: false, message: '无权操作该会话' }
    }
    await runWithRetry(() =>
      runTransaction(async () => {
        await chatRepository.markRead(conversationId, me)
        await messageRepository.markReadByChatConversation(me, conversationId)
      })
    )
    return { success: true, message: '已读' }
  } catch (err) {
    console.error('[chatService.markConversationRead] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// 全部会话已读（供铃铛「全部已读」联动；message 表已由 messageService 统一置已读）
async function markAllConversationsRead() {
  if (!permission.isLoggedIn()) return
  try {
    await chatRepository.markAllRead(permission.currentUserId())
  } catch (err) {
    console.error('[chatService.markAllConversationsRead] 数据库异常:', err)
  }
}

// 本侧删除会话（隐藏，对方不受影响；不触碰 message 表，铃铛历史保留）
async function deleteConversation(payload = {}) {
  const denied = assertChatUser()
  if (denied) return denied
  const me = permission.currentUserId()
  const conversationId = Number(payload.conversation_id)
  if (!Number.isFinite(conversationId) || conversationId <= 0) return { success: false, message: '缺少会话标识' }
  try {
    if (!(await chatRepository.isMember(conversationId, me))) {
      return { success: false, message: '无权操作该会话' }
    }
    await chatRepository.hideConversation(conversationId, me)
    return { success: true, message: '会话已删除' }
  } catch (err) {
    console.error('[chatService.deleteConversation] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// 搜索我参与会话中的消息（文本内容 / 附件文件名，不含撤回消息）
async function searchMessages(payload = {}) {
  const denied = assertChatUser()
  if (denied) return denied
  const keyword = String(payload.keyword || '').trim()
  if (!keyword) return { success: false, message: '请输入搜索关键词' }
  try {
    const rows = await chatRepository.searchMessages(permission.currentUserId(), keyword, 50)
    const data = rows.map((r) => ({
      id: r.id,
      conversation_id: r.conversation_id,
      sender_id: r.sender_id,
      content_type: r.content_type,
      content: r.content || '',
      file_name: r.file_name || '',
      is_recalled: r.is_recalled,
      created_at: r.created_at,
      sender_username: r.sender_username,
      sender_real_name: r.sender_real_name,
      sender_display_name: r.sender_real_name || r.sender_username
    }))
    return { success: true, data }
  } catch (err) {
    console.error('[chatService.searchMessages] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// 我的聊天未读总数（侧栏菜单角标）
async function unreadTotal() {
  const denied = assertChatUser()
  if (denied) return denied
  try {
    const total = await chatRepository.countUnread(permission.currentUserId())
    return { success: true, data: { total } }
  } catch (err) {
    console.error('[chatService.unreadTotal] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// 图片消息内嵌预览：读取附件转 base64（路径限定 uploads 目录内；大文件不内嵌）
async function attachmentPreview(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const filePath = payload && payload.path
  if (!filePath || typeof filePath !== 'string') return { success: false, message: '缺少附件路径' }
  const uploadsDir = path.join(app.getPath('userData'), 'uploads')
  const resolved = path.resolve(filePath)
  if (!resolved.startsWith(uploadsDir)) return { success: false, message: '附件路径不合法' }
  if (!fs.existsSync(resolved)) return { success: false, message: '附件文件不存在' }
  try {
    const stat = fs.statSync(resolved)
    if (stat.size > PREVIEW_MAX_BYTES) {
      return { success: false, message: '图片较大，请点击打开查看' }
    }
    const data = fs.readFileSync(resolved)
    const ext = String(filePath).split('.').pop().toLowerCase()
    const mime = MIME_BY_EXT[ext] || 'application/octet-stream'
    return { success: true, dataUrl: `data:${mime};base64,${data.toString('base64')}` }
  } catch (err) {
    console.error('[chatService.attachmentPreview] 读取附件失败:', err)
    return { success: false, message: '读取附件失败' }
  }
}

module.exports = {
  listContacts,
  listConversations,
  openConversation,
  listMessages,
  sendMessage,
  recallMessage,
  markConversationRead,
  markAllConversationsRead,
  deleteConversation,
  searchMessages,
  unreadTotal,
  attachmentPreview
}
