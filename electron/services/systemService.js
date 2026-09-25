/**
 * 系统 / 个人服务（Service Layer）—— 操作日志（审计）/ 系统参数 / 消息中心
 *
 * - operation_log 只追加、不更新不删除：这里只暴露 recordLog（内部记录）与 listLogs（仅管理员查询）；
 * - system_param 提供「按 key 读写」的便捷方法，并保留标准 CRUD；
 * - message 提供发送 / 我的消息 / 未读数 / 标记已读，接收人归属由后端强制约束。
 */
const {
  operationLogRepo,
  systemParamRepo,
  messageRepo,
  notificationPrefRepo
} = require('../db/repositories/systemRepository')
const { createCrudService } = require('./crudService')
const permission = require('./permission')
const logService = require('./logService')
const { MESSAGE_STATUS_UNREAD, MESSAGE_STATUS_READ } = require('../../shared/constants')

// 通知偏好事件类型（与 user_notification_pref 表 event_type 对应，前端设置页据此渲染）
const NOTIFICATION_EVENT_TYPES = [
  { event: 'task_assigned', label: '任务分配' },
  { event: 'task_changed', label: '任务变更' },
  { event: 'comment', label: '任务评论' },
  { event: 'mention', label: '@ 我' },
  { event: 'due_reminder', label: '截止提醒' }
]

// notify 的 type → 偏好 event_type 映射；没有映射的类型不参与偏好过滤（默认按开启处理）
const NOTIFY_TYPE_TO_EVENT = {
  task: 'task_assigned',
  mention: 'mention',
  comment: 'comment'
}

const systemParamService = createCrudService(systemParamRepo, { label: '系统参数', write: 'manager' })

/**
 * 记录一条操作日志（全链路追溯）。供其他 Service / IPC 在关键写操作后调用。
 * 实际写入委托给 logService（与 crudService 共用同一实现）。
 * @param {{ action: string, target_table?: string, target_id?: number, detail?: object }} param
 */
async function recordLog({ action, target_table, target_id, detail } = {}) {
  await logService.record(action, target_table, target_id, detail)
}

// 查询操作日志（仅管理员）
async function listLogs(filters = {}) {
  if (!permission.isAdmin()) return { success: false, message: '无权限：仅管理员可查看日志' }
  try {
    const list = await operationLogRepo.list(filters, 'id DESC')
    return { success: true, list }
  } catch (err) {
    console.error('[operationLog.list] 数据库异常:', err)
    return { success: false, message: '查询日志失败' }
  }
}

// 按 key 读取参数值（不存在返回 null）
async function getParam(key) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  try {
    const list = await systemParamRepo.list({ param_key: key })
    return { success: true, value: list[0] ? list[0].param_value : null }
  } catch (err) {
    console.error('[systemParam.get] 数据库异常:', err)
    return { success: false, message: '读取参数失败' }
  }
}

// 按 key 设置参数（存在则更新，不存在则新增，upsert）
async function setParam(key, value, description) {
  if (!permission.isManager()) return { success: false, message: '无权限：仅导师或管理员可修改参数' }
  if (!key) return { success: false, message: '参数键不能为空' }
  try {
    const exist = await systemParamRepo.list({ param_key: key })
    let paramId = null
    if (exist.length) {
      paramId = exist[0].id
      await systemParamRepo.update(paramId, { param_value: value, description })
    } else {
      paramId = await systemParamRepo.create({ param_key: key, param_value: value, description })
    }
    logService.record(exist.length ? 'update' : 'create', 'system_param', paramId)
    return { success: true, message: '已保存' }
  } catch (err) {
    console.error('[systemParam.set] 数据库异常:', err)
    return { success: false, message: '保存参数失败' }
  }
}

// 发送消息（仅导师 / 管理员，发送给指定接收人）
async function sendMessage({ receiver_id, title, content, type, biz_type, biz_id }) {
  if (!permission.isManager()) return { success: false, message: '无权限：仅导师或管理员可发消息' }
  if (!receiver_id) return { success: false, message: '缺少接收人' }
  try {
    const id = await messageRepo.create({
      receiver_id,
      sender_id: permission.currentUserId(),
      title: title || null,
      content: content || null,
      type: type || null,
      biz_type: biz_type || null,
      biz_id: biz_id || null,
      status: MESSAGE_STATUS_UNREAD
    })
    logService.record('create', 'message', id)
    return { success: true, id, message: '已发送' }
  } catch (err) {
    console.error('[message.send] 数据库异常:', err)
    return { success: false, message: '发送失败' }
  }
}

/**
 * 内部自动通知（供其他 Service 在业务事件后调用，不暴露给前端）。
 * 站内消息始终写入；桌面系统通知按接收人偏好过滤（无偏好记录默认启用）。
 */
async function notify({ receiver_id, sender_id = null, title, content, type, biz_type, biz_id } = {}) {
  if (!receiver_id) return
  try {
    await messageRepo.create({
      receiver_id,
      sender_id,
      title: title || null,
      content: content || null,
      type: type || null,
      biz_type: biz_type || null,
      biz_id: biz_id || null,
      status: MESSAGE_STATUS_UNREAD
    })
    // 系统桌面通知（保留）：弹窗前按接收人偏好过滤
    const desktopOn = await desktopEnabled(receiver_id, type)
    if (!desktopOn) return
    try {
      const { Notification } = require('electron')
      if (Notification.isSupported()) {
        new Notification({ title: title || '新消息', body: content || '' }).show()
      }
    } catch (e) {}
  } catch (err) {
    console.error('[message.notify] 写自动通知失败:', err)
  }
}

// 桌面通知是否允许：无偏好记录 → 默认允许；记录中 desktop_enabled=0 → 不弹
async function desktopEnabled(userId, type) {
  if (!userId) return true
  const event = NOTIFY_TYPE_TO_EVENT[type]
  if (!event) return true // 未映射的事件类型不参与偏好过滤
  try {
    const prefs = await notificationPrefRepo.list({ user_id: userId, event_type: event })
    return !prefs.length || Number(prefs[0].desktop_enabled) === 1
  } catch (e) {
    console.error('[notify.desktopEnabled] 查询偏好失败:', e)
    return true
  }
}

// 当前用户的通知偏好（缺省返回默认开启，不落库）
async function getNotificationPref() {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  try {
    const me = permission.currentUserId()
    const rows = await notificationPrefRepo.list({ user_id: me })
    console.log(`[notificationPref.get] me=${me} 命中记录数=${rows.length}`, rows.map((r) => ({ event_type: r.event_type, inapp_enabled: r.inapp_enabled, desktop_enabled: r.desktop_enabled })))
    return {
      success: true,
      list: NOTIFICATION_EVENT_TYPES.map((t) => {
        const row = rows.find((r) => r.event_type === t.event)
        return {
          event_type: t.event,
          label: t.label,
          inapp_enabled: row ? Number(row.inapp_enabled) : 1,
          desktop_enabled: row ? Number(row.desktop_enabled) : 1
        }
      })
    }
  } catch (err) {
    console.error('[notificationPref.get] 数据库异常:', err)
    return { success: false, message: '读取偏好失败' }
  }
}

// 保存当前用户通知偏好（逐条 upsert；仅接受白名单事件类型）
async function saveNotificationPref(prefs = []) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!Array.isArray(prefs)) return { success: false, message: '参数格式错误' }
  const me = permission.currentUserId()
  const allowed = NOTIFICATION_EVENT_TYPES.map((t) => t.event)
  console.log(`[notificationPref.save] me=${me} 收到条目=${prefs.length}`, prefs.map((p) => ({ event_type: p.event_type, inapp_enabled: p.inapp_enabled, desktop_enabled: p.desktop_enabled })))
  try {
    for (const p of prefs) {
      if (!p || !allowed.includes(p.event_type)) {
        console.warn(`[notificationPref.save] 跳过未注册事件:`, p)
        continue
      }
      const exist = await notificationPrefRepo.list({ user_id: me, event_type: p.event_type })
      const data = {
        user_id: me,
        event_type: p.event_type,
        inapp_enabled: p.inapp_enabled === 0 || p.inapp_enabled === '0' ? 0 : 1,
        desktop_enabled: p.desktop_enabled === 0 || p.desktop_enabled === '0' ? 0 : 1
      }
      if (exist.length) {
        const affected = await notificationPrefRepo.update(exist[0].id, {
          inapp_enabled: data.inapp_enabled,
          desktop_enabled: data.desktop_enabled
        })
        console.log(`[notificationPref.save] 更新 id=${exist[0].id} event=${p.event_type} inapp=${data.inapp_enabled} desktop=${data.desktop_enabled} → affected=${affected}`)
      } else {
        const newId = await notificationPrefRepo.create(data)
        console.log(`[notificationPref.save] 新增 id=${newId} event=${p.event_type} inapp=${data.inapp_enabled} desktop=${data.desktop_enabled}`)
      }
    }
    logService.record('update', 'user_notification_pref', me, { action: 'pref' })
    return { success: true, message: '偏好已保存' }
  } catch (err) {
    console.error('[notificationPref.save] 数据库异常:', err)
    return { success: false, message: '保存偏好失败' }
  }
}

// 我的消息（当前登录用户收到的，默认最新在前）
async function myMessages(filters = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  try {
    const list = await messageRepo.list(
      { receiver_id: permission.currentUserId(), ...filters },
      'id DESC'
    )
    return { success: true, list }
  } catch (err) {
    console.error('[message.list] 数据库异常:', err)
    return { success: false, message: '查询消息失败' }
  }
}

// 未读消息数
async function unreadCount() {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  try {
    const count = await messageRepo.count({
      receiver_id: permission.currentUserId(),
      status: MESSAGE_STATUS_UNREAD
    })
    return { success: true, count }
  } catch (err) {
    console.error('[message.unreadCount] 数据库异常:', err)
    return { success: false, message: '查询未读失败' }
  }
}

// 标记消息已读（只能标记自己的）
async function markRead(id) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (id === null || id === undefined) return { success: false, message: '缺少消息标识' }
  try {
    const exist = await messageRepo.get(id)
    if (!exist) return { success: false, message: '消息不存在' }
    if (exist.receiver_id !== permission.currentUserId()) {
      return { success: false, message: '无权限：只能操作自己的消息' }
    }
    await messageRepo.update(id, { status: MESSAGE_STATUS_READ, read_at: new Date() })
    return { success: true, message: '已读' }
  } catch (err) {
    console.error('[message.markRead] 数据库异常:', err)
    return { success: false, message: '标记失败' }
  }
}

// 全部标记已读：先查出当前用户未读消息，再逐条按主键更新（update 只支持主键，不能传 where 对象）
async function markAllRead() {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  try {
    const unreadList = await messageRepo.list({
      receiver_id: permission.currentUserId(),
      status: MESSAGE_STATUS_UNREAD
    })
    for (const m of unreadList) {
      await messageRepo.update(m.id, { status: MESSAGE_STATUS_READ, read_at: new Date() })
    }
    return { success: true, message: '已全部已读', count: unreadList.length }
  } catch (err) {
    console.error('[message.markAllRead] 数据库异常:', err)
    return { success: false, message: '操作失败' }
  }
}

module.exports = {
  systemParam: systemParamService,
  getParam,
  setParam,
  recordLog,
  listLogs,
  sendMessage,
  notify,
  myMessages,
  unreadCount,
  markRead,
  markAllRead,
  getNotificationPref,
  saveNotificationPref
}
