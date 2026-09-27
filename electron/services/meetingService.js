/**
 * 组会服务（Service Layer）—— meeting 表
 *
 * 列表全员登录可见（按 group_id 过滤）；增删改仅课题组管理员（group_admin）。
 */
const permission = require('./permission')
const meetingRepository = require('../db/repositories/meetingRepository')
const operationLogService = require('./operationLogService')

// meeting:list —— 全员登录，按 group_id 过滤，开始时间倒序
async function list(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const groupId = payload && payload.group_id
  if (!groupId) return { success: false, message: '缺少课题组标识（group_id）' }
  try {
    const data = await meetingRepository.listByGroup(groupId)
    return { success: true, data }
  } catch (err) {
    console.error('[meetingService.list] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// meeting:create —— 仅课题组管理员，created_by 取当前登录用户
async function create(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isGroupAdmin()) return { success: false, message: '无权限：仅课题组管理员可创建组会' }
  const body = payload || {}
  if (!body.group_id) return { success: false, message: '缺少课题组标识（group_id）' }
  if (!body.title || !String(body.title).trim()) return { success: false, message: '组会主题不能为空' }
  try {
    body.created_by = permission.currentUserId()
    const id = await meetingRepository.create(body)
    operationLogService.writeLog({
      action: 'createMeeting',
      targetType: 'meeting',
      targetId: id,
      detail: `创建组会「${String(body.title).trim()}」`
    })
    return { success: true, message: '创建成功', data: { id } }
  } catch (err) {
    console.error('[meetingService.create] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// meeting:update —— 仅课题组管理员
async function update(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isGroupAdmin()) return { success: false, message: '无权限：仅课题组管理员可编辑组会' }
  const id = payload && payload.id
  if (!id) return { success: false, message: '缺少组会标识（id）' }
  try {
    await meetingRepository.update(id, payload || {})
    operationLogService.writeLog({
      action: 'updateMeeting',
      targetType: 'meeting',
      targetId: id,
      detail: '编辑组会'
    })
    return { success: true, message: '更新成功' }
  } catch (err) {
    console.error('[meetingService.update] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// meeting:remove —— 仅课题组管理员，软删除
async function remove(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isGroupAdmin()) return { success: false, message: '无权限：仅课题组管理员可删除组会' }
  const id = payload && payload.id
  if (!id) return { success: false, message: '缺少组会标识（id）' }
  try {
    await meetingRepository.delete(id)
    operationLogService.writeLog({
      action: 'removeMeeting',
      targetType: 'meeting',
      targetId: id,
      detail: '删除组会'
    })
    return { success: true, message: '已删除' }
  } catch (err) {
    console.error('[meetingService.remove] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

module.exports = {
  list,
  create,
  update,
  remove
}
