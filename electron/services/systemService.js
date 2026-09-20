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
  messageRepo
} = require('../db/repositories/systemRepository')
const { createCrudService } = require('./crudService')
const permission = require('./permission')
const logService = require('./logService')
const { MESSAGE_STATUS_UNREAD, MESSAGE_STATUS_READ } = require('../../shared/constants')

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
async function sendMessage({ receiver_id, title, content, type }) {
  if (!permission.isManager()) return { success: false, message: '无权限：仅导师或管理员可发消息' }
  if (!receiver_id) return { success: false, message: '缺少接收人' }
  try {
    const id = await messageRepo.create({
      receiver_id,
      sender_id: permission.currentUserId(),
      title: title || null,
      content: content || null,
      type: type || null,
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
 * 不做权限校验——调用方本身已经过业务校验；写入失败只打日志，不影响主业务流程。
 * @param {{receiver_id:number, sender_id?:number|null, title?:string, content?:string, type?:string}} p
 */
async function notify({ receiver_id, sender_id = null, title, content, type } = {}) {
  if (!receiver_id) return
  try {
    await messageRepo.create({
      receiver_id,
      sender_id,
      title: title || null,
      content: content || null,
      type: type || null,
      status: MESSAGE_STATUS_UNREAD
    })
  } catch (err) {
    console.error('[message.notify] 写自动通知失败:', err)
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
  markRead
}
