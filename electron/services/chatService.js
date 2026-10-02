/**
 * 一对一聊天服务（Service Layer）—— 会话 / 消息 / 已读 / 撤回 / 限频 / 用户删除联动
 *
 * 权限模型（与公告一致）：唯一可信来源为主进程会话 authService.getCurrentUser，
 * 不信任前端传入的 userId / role；渲染层只传业务参数，身份一律由服务端会话取。
 * 聊天为全平台功能：四类角色与未入组用户权限完全一致，无角色差异、无组限制。
 *
 * 可靠接收：消息一旦写入数据库即不丢失；发送方本地乐观插入 + 客户端消息 ID 幂等；
 * 接收方靠 ChatPoller 实时推送 + 渲染层增量拉取兜底；已读游标（last_read_message_id）
 * 单调递增，忽略旧窗口回退上报。
 *
 * 事务约定：runTransaction 由 AsyncLocalStorage 实现，嵌套调用会另开独立事务，
 * 破坏外层原子性——本服务内所有 runTransaction 均用于独立操作；
 * markUserDeleted 不做事务，须由 userService 的删除事务包裹调用。
 */
const userRepository = require('../db/repositories/userRepository')
const chatSessionRepository = require('../db/repositories/chatSessionRepository')
const chatSessionMemberRepository = require('../db/repositories/chatSessionMemberRepository')
const chatMessageRepository = require('../db/repositories/chatMessageRepository')
const authService = require('./authService')
const ApiError = require('./apiError')
const { runTransaction } = require('../db/connection')
const { ACCOUNT_STATUS_ENABLED } = require('../../shared/constants')

// ===== 常量 =====
const MSG_STATUS_NORMAL = 1
const MSG_STATUS_RECALLED = 2
const RECALL_WINDOW_SECONDS = 120 // 2 分钟撤回窗口（以数据库时钟判定）
const CONTENT_MAX_LENGTH = 2000 // 消息内容上限（字符）
const RATE_LIMIT_MAX = 20 // 1 秒内最多发送条数
const RATE_LIMIT_WINDOW_MS = 1000

// 限频滑动窗口：userId -> 时间戳数组（进程内内存；主进程即本机服务端）
const rateBuckets = new Map()

// 本地时间格式化（YYYY-MM-DD HH:mm:ss，DATETIME 列写入用）
function nowSql() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  )
}

// 当前登录用户（401 兜底）
async function currentUser() {
  const me = await authService.getCurrentUser()
  if (!me) throw new ApiError('未登录，请重新登录', 401)
  return me
}

// 消息内容校验：非空、长度上限、拒绝明显代码片段（纯文本渲染，服务端第一道闸）
function assertContent(content) {
  const c = content === undefined || content === null ? '' : String(content).trim()
  if (!c) throw new ApiError('消息内容不能为空', 400)
  if (c.length > CONTENT_MAX_LENGTH) throw new ApiError(`消息内容不能超过 ${CONTENT_MAX_LENGTH} 个字符`, 400)
  if (/<script|<iframe|javascript:/i.test(c)) {
    throw new ApiError('消息内容包含不允许的代码片段', 400)
  }
  return c
}

// 限频校验：滑动窗口内超过上限即拒绝（按用户全局，跨所有会话）
function assertRateLimit(userId) {
  const now = Date.now()
  const arr = (rateBuckets.get(userId) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  if (arr.length >= RATE_LIMIT_MAX) throw new ApiError('发送太快，请稍后再试', 400)
  arr.push(now)
  rateBuckets.set(userId, arr)
}

// ===== DTO =====

// 消息行转 DTO
function toMessageDto(row) {
  if (!row) return null
  return {
    id: row.id,
    sessionId: row.session_id,
    senderId: row.sender_id,
    content: row.content,
    status: row.status,
    createdAt: row.created_at,
    recalledAt: row.recalled_at || null,
    senderDeleted: row.sender_deleted_mark === 1
  }
}

// 会话行转 DTO（listByUser 查询结果：含对方信息与未读）
function toSessionDto(row) {
  if (!row) return null
  return {
    id: row.id,
    peerId: row.peer_id == null ? null : Number(row.peer_id),
    peerUsername: row.peer_username || '',
    peerRealName: row.peer_real_name || '',
    peerDeleted: Number(row.peer_deleted) === 1,
    lastMessageId: row.last_message_id == null ? null : Number(row.last_message_id),
    lastMessageTime: row.last_message_time || null,
    myLastReadId: row.my_last_read_id == null ? null : Number(row.my_last_read_id),
    unreadCount: Number(row.unread_count) || 0
  }
}

// 新建会话返回的 DTO（对方信息来自 users 表实时数据）
function toNewSessionDto(session, peer) {
  return {
    id: session.id,
    peerId: peer.id,
    peerUsername: peer.username,
    peerRealName: peer.real_name || '',
    peerDeleted: false,
    lastMessageId: null,
    lastMessageTime: null,
    myLastReadId: null,
    unreadCount: 0
  }
}

// 会话访问校验：会话存在 + 我是成员（成员状态正常），返回我的成员记录与对方成员记录
async function assertSessionAccess(me, sessionId) {
  const session = await chatSessionRepository.findById(sessionId)
  if (!session) throw new ApiError('会话不存在', 404)
  const myMember = await chatSessionMemberRepository.findBySessionAndUser(sessionId, me.id)
  if (!myMember) throw new ApiError('无权限：你不是该会话的成员', 403)
  if (Number(myMember.member_status) !== 1) throw new ApiError('无权限：会话不可用', 403)
  const peerMember = await chatSessionMemberRepository.getPeerMember(sessionId, me.id)
  return { session, myMember, peerMember }
}

// ===== 会话 =====

/**
 * 发起或打开会话：目标用户必须存在且启用、不能和自己聊；
 * A 找 B 与 B 找 A 是同一个会话（user_low/user_high 复合唯一键兜底并发）。
 */
async function openOrCreateSession(targetUserId) {
  const me = await currentUser()
  const target = Number(targetUserId)
  if (!target || !Number.isInteger(target)) throw new ApiError('目标用户不存在', 404)
  if (target === me.id) throw new ApiError('不能和自己聊天', 400)

  const targetUser = await userRepository.findById(target)
  if (!targetUser) throw new ApiError('目标用户不存在', 404)
  if (targetUser.status !== ACCOUNT_STATUS_ENABLED) throw new ApiError('目标用户已禁用，无法发起聊天', 400)

  const [low, high] = target < me.id ? [target, me.id] : [me.id, target]
  let session = await chatSessionRepository.findByUserPair(low, high)
  if (session) return toNewSessionDto(session, targetUser)

  try {
    const sessionId = await runTransaction(async () => {
      const sid = await chatSessionRepository.create({ userLow: low, userHigh: high })
      await chatSessionMemberRepository.create({ sessionId: sid, userId: me.id })
      await chatSessionMemberRepository.create({ sessionId: sid, userId: target })
      return sid
    })
    session = await chatSessionRepository.findById(sessionId)
  } catch (err) {
    // 并发双方同时发起：唯一索引冲突，重查既有会话
    if (err && err.code === 'ER_DUP_ENTRY') {
      session = await chatSessionRepository.findByUserPair(low, high)
    } else {
      throw err
    }
  }
  if (!session) throw new ApiError('会话创建失败，请稍后重试', 500)
  return toNewSessionDto(session, targetUser)
}

/**
 * 我的会话列表：按最后消息时间倒序，含对方信息、删除标记与每会话未读数
 */
async function listSessions() {
  const me = await currentUser()
  const rows = await chatSessionRepository.listByUser(me.id)
  return (rows || []).map(toSessionDto)
}

/**
 * 会话历史（打开会话用）：取 id < beforeId 的最近 limit 条，返回按 id 升序
 */
async function getHistory(sessionId, beforeId, limit) {
  const me = await currentUser()
  await assertSessionAccess(me, Number(sessionId))
  const before = beforeId ? Number(beforeId) : Number.MAX_SAFE_INTEGER
  const rows = await chatMessageRepository.pageHistory(Number(sessionId), before, limit)
  return (rows || []).reverse().map(toMessageDto)
}

/**
 * 增量拉取：取 id > afterId 的消息（事件推送后的兜底与首屏后的补拉）
 */
async function getIncrement(sessionId, afterId, limit) {
  const me = await currentUser()
  await assertSessionAccess(me, Number(sessionId))
  const after = Number(afterId) || 0
  const rows = await chatMessageRepository.increment(Number(sessionId), after, limit)
  return (rows || []).map(toMessageDto)
}

// ===== 消息 =====

/**
 * 发送消息：
 *   1. 校验会话成员与对方未删除；2. 限频；3. 客户端消息 ID 幂等查重；
 *   4. 写消息 + 更新会话最后消息，同一事务。
 */
async function sendMessage(sessionId, clientMessageId, content) {
  const me = await currentUser()
  const sid = Number(sessionId)
  if (!clientMessageId || typeof clientMessageId !== 'string' || clientMessageId.length > 64) {
    throw new ApiError('客户端消息ID不合法', 400)
  }
  const text = assertContent(content)
  assertRateLimit(me.id)

  const { peerMember } = await assertSessionAccess(me, sid)
  if (peerMember && Number(peerMember.is_user_deleted) === 1) {
    throw new ApiError('对方已删除，无法继续发送', 400)
  }

  // 幂等：同一客户端消息 ID 已存在则直接返回原消息，不重复写入
  const existed = await chatMessageRepository.findByClientId(me.id, clientMessageId)
  if (existed) return toMessageDto(existed)

  const now = nowSql()
  const messageId = await runTransaction(async () => {
    const mid = await chatMessageRepository.create({
      sessionId: sid,
      senderId: me.id,
      clientMessageId,
      content: text,
      status: MSG_STATUS_NORMAL
    })
    await chatSessionRepository.updateLastMessage(sid, mid, now)
    return mid
  })
  return toMessageDto(await chatMessageRepository.findById(messageId))
}

/**
 * 撤回消息：只能撤回自己 2 分钟内的正常消息；
 * 时间窗口以数据库时钟判定（TIMESTAMPDIFF），避免主进程与 MySQL 时钟偏差。
 */
async function recallMessage(sessionId, messageId) {
  const me = await currentUser()
  const sid = Number(sessionId)
  await assertSessionAccess(me, sid)

  const msg = await chatMessageRepository.findById(Number(messageId))
  if (!msg || Number(msg.session_id) !== sid) throw new ApiError('消息不存在', 404)
  if (Number(msg.sender_id) !== me.id) throw new ApiError('无权限：只能撤回自己的消息', 403)
  if (Number(msg.status) === MSG_STATUS_RECALLED) throw new ApiError('消息已撤回，不能重复操作', 400)

  const age = await chatMessageRepository.ageSeconds(Number(messageId))
  if (age > RECALL_WINDOW_SECONDS) throw new ApiError('超过 2 分钟，无法撤回', 400)

  await chatMessageRepository.recall(Number(messageId))
  return toMessageDto(await chatMessageRepository.findById(Number(messageId)))
}

// ===== 已读 / 未读 =====

/**
 * 标记已读：游标单调递增，服务端忽略小于当前已读游标的上报（防旧窗口回退）
 */
async function markRead(sessionId, lastReadId) {
  const me = await currentUser()
  const sid = Number(sessionId)
  const { myMember } = await assertSessionAccess(me, sid)
  const lastRead = Number(lastReadId)
  if (!lastRead || lastRead <= 0) throw new ApiError('参数不合法', 400)
  if (myMember.last_read_message_id && lastRead <= Number(myMember.last_read_message_id)) {
    return { lastReadId: Number(myMember.last_read_message_id) }
  }
  await chatSessionMemberRepository.updateLastRead(sid, me.id, lastRead, nowSql())
  return { lastReadId: lastRead }
}

/**
 * 总未读数（导航角标 / 聊天页徽标）
 */
async function unreadCount() {
  const me = await currentUser()
  const total = await chatMessageRepository.countUnreadForUser(me.id)
  return { unreadCount: total }
}

// ===== 选人 =====

/**
 * 全平台启用用户列表（发起新会话选人用）：排除自己，支持关键字搜索
 */
async function listChatCandidates({ keyword, page } = {}) {
  const me = await currentUser()
  const result = await userRepository.pagedList({ keyword, status: ACCOUNT_STATUS_ENABLED, page })
  return {
    list: (result.list || []).filter((u) => Number(u.id) !== me.id),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages
  }
}

// ===== 用户删除联动 =====

/**
 * 删除用户前的会话数（删除确认弹窗提示「N 个进行中的会话」用）
 * 权限闸门在 IPC 层（仅超管可调用）。
 */
async function countSessions(userId) {
  const count = await chatSessionMemberRepository.countSessionsOfUser(Number(userId))
  return { count }
}

/**
 * 删除用户时的聊天数据清理（须由 userService 的删除事务包裹调用，内部不开事务）：
 *   1. 标记该用户所有成员记录为已删除；
 *   2. 标记该用户发送的所有消息为发送人已删除；
 *   3. 逐会话判定：双方都已删除则硬删会话、成员、消息。
 * 幂等可重入：标记带 is_user_deleted=0 / sender_deleted_mark=0 条件，重复执行无副作用。
 */
async function markUserDeleted(userId) {
  const uid = Number(userId)
  await chatSessionMemberRepository.markUserDeleted(uid)
  await chatMessageRepository.markSenderDeleted(uid)
  const sessions = await chatSessionMemberRepository.listSessionsOfUser(uid)
  for (const s of sessions || []) {
    const deletedMembers = await chatSessionMemberRepository.countDeletedMembers(s.session_id)
    if (deletedMembers >= 2) {
      await chatMessageRepository.deleteBySessionId(s.session_id)
      await chatSessionMemberRepository.deleteBySessionId(s.session_id)
      await chatSessionRepository.deleteById(s.session_id)
    }
  }
  return true
}

module.exports = {
  openOrCreateSession,
  listSessions,
  getHistory,
  getIncrement,
  sendMessage,
  recallMessage,
  markRead,
  unreadCount,
  listChatCandidates,
  countSessions,
  markUserDeleted
}
