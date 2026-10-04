/**
 * 通知中心服务（Service Layer）—— 通知的存储、消费与级联
 *
 * 权限模型（唯一可信来源为主进程内存会话 authService.getCurrentUser）：
 *   - 任意已登录启用用户可查看/标记已读/删除自己的通知；
 *   - 发送通知仅业务模块内部调用（createForGroup / createForUsers），不对外暴露 IPC；
 *   - 级联方法（purgeByUserDelete / hardDeleteByGroup / softDeleteByBiz）由
 *     用户删除、课题组删除、公告/组会删除的事务流程调用。
 * 边界：聊天消息不进入本表，聊天由 chat 体系独立闭环（见 schemas/11_notification.sql）。
 */
const notificationRepository = require('../db/repositories/notificationRepository')
const userRepository = require('../db/repositories/userRepository')
const authService = require('./authService')
const notificationPoller = require('./notificationPoller')
const ApiError = require('./apiError')

// 标题/摘要上限（与表列宽一致）
const TITLE_MAX = 100
const SUMMARY_MAX = 200

// 当前登录用户（401 兜底）
async function currentUser() {
  const me = await authService.getCurrentUser()
  if (!me) throw new ApiError('未登录，请重新登录', 401)
  return me
}

// 按码点安全截断（中文/emoji 不截出半个字符）
function truncateByCodePoint(text, max) {
  const s = String(text || '')
  if (s.length <= max) return s
  return Array.from(s).slice(0, max).join('')
}

// 写入前归一化：标题/摘要强制截断到列宽，业务类型/ID 归一
function normalizeRow(recipientId, { typeKey, title, summary, bizType, bizId, groupId }) {
  return {
    recipientId: Number(recipientId),
    typeKey,
    title: truncateByCodePoint(title, TITLE_MAX),
    summary: truncateByCodePoint(summary, SUMMARY_MAX),
    bizType,
    bizId: Number(bizId),
    groupId: groupId == null ? null : Number(groupId)
  }
}

// 内部写入：校验类型已启用（禁用类型不产生新通知），随后批量落库
async function writeNotifications(recipients, data) {
  const ids = [...new Set((recipients || []).map((v) => Number(v)).filter((n) => n > 0))]
  if (ids.length === 0) return 0
  if (!(await notificationRepository.typeEnabled(data.typeKey))) return 0
  const rows = ids.map((uid) => normalizeRow(uid, data))
  return notificationRepository.createMany(rows)
}

// ===== 内部写入（业务模块调用，不暴露 IPC） =====

/**
 * 给指定接收人写通知（业务模块内部调用）
 * @param {{ recipients:number[], typeKey:string, title:string, summary?:string, bizType:string, bizId:number, groupId?:number|null }} param
 */
async function createForUsers({ recipients, typeKey, title, summary = '', bizType, bizId, groupId = null } = {}) {
  return writeNotifications(recipients, { typeKey, title, summary, bizType, bizId, groupId })
}

/**
 * 给某课题组全部启用成员写通知（公告发布场景；组内启用导师/学生）
 * @param {{ groupId:number, typeKey:string, title:string, summary?:string, bizType:string, bizId:number }} param
 */
async function createForGroup({ groupId, typeKey, title, summary = '', bizType, bizId } = {}) {
  const rows = await userRepository.listEnabledAudienceByGroup(Number(groupId))
  const recipients = rows.map((r) => r.id)
  return writeNotifications(recipients, { typeKey, title, summary, bizType, bizId, groupId: Number(groupId) })
}

// ===== 通知消费（IPC） =====

// 行转 DTO：接收人只可能是当前用户，类型展示信息来自类型表
function toDto(row) {
  if (!row) return null
  return {
    id: row.id,
    typeKey: row.type_key,
    typeName: row.display_name || row.type_key,
    iconKey: row.icon_key || '',
    title: row.title,
    summary: row.summary || '',
    bizType: row.biz_type,
    bizId: Number(row.biz_id),
    groupId: row.group_id == null ? null : Number(row.group_id),
    isRead: Number(row.is_read) === 1,
    createdAt: row.created_at,
    readAt: row.read_at || null
  }
}

/**
 * 我的通知分页列表（倒序；支持按类型、按已读未读筛选）
 */
async function list({ page = 1, pageSize = 20, typeKey, isRead } = {}) {
  const me = await currentUser()
  const result = await notificationRepository.pagedList({
    userId: me.id,
    page,
    pageSize,
    typeKey: typeKey || undefined,
    isRead: isRead === 0 || isRead === 1 ? Number(isRead) : undefined
  })
  // 注意展开顺序：map(toDto) 必须在展开 result 之后，否则 result.list（原始行）会覆盖已转换的 list
  return { ...result, list: result.list.map(toDto) }
}

/**
 * 我的未读通知数（角标）
 */
async function unreadCount() {
  const me = await currentUser()
  return { unreadCount: await notificationRepository.countUnread(me.id) }
}

/**
 * 标记单条已读（只能自己的；幂等）
 */
async function markRead(id) {
  const me = await currentUser()
  const affected = await notificationRepository.markRead(id, me.id)
  if (affected === 0) throw new ApiError('通知不存在或已读', 404)
  // 立即广播未读变化，导航角标秒级更新（不等 10 秒轮询）
  notificationPoller.notifyUnreadChanged()
  return { read: true }
}

/**
 * 全部标记已读
 */
async function markAllRead() {
  const me = await currentUser()
  const affected = await notificationRepository.markAllRead(me.id)
  if (affected > 0) notificationPoller.notifyUnreadChanged()
  return { marked: affected }
}

/**
 * 删除单条（软删；只能自己的）
 */
async function remove(id) {
  const me = await currentUser()
  const affected = await notificationRepository.softDelete(id, me.id)
  if (affected === 0) throw new ApiError('通知不存在或已删除', 404)
  notificationPoller.notifyUnreadChanged()
  return true
}

/**
 * 清空已读：全部已读通知一次性软删
 */
async function clearRead() {
  const me = await currentUser()
  const affected = await notificationRepository.clearRead(me.id)
  if (affected > 0) notificationPoller.notifyUnreadChanged()
  return { cleared: affected }
}

/**
 * 已启用通知类型列表（筛选/展示动态读取，新类型注册后自动出现）
 */
async function listTypes() {
  const rows = await notificationRepository.listTypes()
  return rows.map((r) => ({
    typeKey: r.type_key,
    displayName: r.display_name,
    iconKey: r.icon_key || '',
    allowSystemNotify: Number(r.allow_system_notify) === 1,
    sortOrder: Number(r.sort_order) || 0
  }))
}

// ===== 级联方法（删除事务内调用） =====

/**
 * 删除用户：硬删该用户全部通知（userService.deleteUser 事务内调用）
 * @param {number} userId
 */
async function purgeByUserDelete(userId) {
  return notificationRepository.purgeByUserDelete(userId)
}

/**
 * 删除课题组：硬删该组公告/组会通知（groupService.deleteGroup 事务内调用）
 * @param {number} groupId
 */
async function hardDeleteByGroup(groupId) {
  return notificationRepository.hardDeleteByGroup(groupId)
}

/**
 * 删除公告/组会：关联通知软删，保留历史（noticeService/meetingService 调用）
 * @param {string} bizType
 * @param {number} bizId
 */
async function softDeleteByBiz(bizType, bizId) {
  return notificationRepository.softDeleteByBiz(bizType, bizId)
}

/**
 * 删除用户：其创建的任务/周报被物理删除后，按业务硬删关联通知（userService.deleteUser 事务内调用）
 * @param {string} bizType
 * @param {number[]} bizIds
 */
async function hardDeleteByBizIds(bizType, bizIds) {
  return notificationRepository.hardDeleteByBizIds(bizType, bizIds)
}

module.exports = {
  createForUsers,
  createForGroup,
  list,
  unreadCount,
  markRead,
  markAllRead,
  remove,
  clearRead,
  listTypes,
  purgeByUserDelete,
  hardDeleteByGroup,
  softDeleteByBiz,
  hardDeleteByBizIds
}
