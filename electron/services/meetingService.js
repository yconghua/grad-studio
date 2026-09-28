/**
 * 组会服务（Service Layer）—— meeting 表
 *
 * 列表全员登录可见（按 group_id 过滤）；增删改仅课题组管理员（group_admin）。
 */
const permission = require('./permission')
const meetingRepository = require('../db/repositories/meetingRepository')
const noticeService = require('./noticeService')
const operationLogService = require('./operationLogService')

// 组会保存为「已发布」时自动生成 / 同步公告；草稿、已取消、已结束不通知，避免打扰
async function syncMeetingNotice(meeting) {
  if (!meeting || meeting.status !== 'published') return null
  try {
    return await noticeService.syncFromMeeting(meeting)
  } catch (err) {
    console.error('[meetingService.syncMeetingNotice] 自动生成 / 同步公告失败:', err)
    return null
  }
}

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
    const notice = await syncMeetingNotice({ id, ...body })
    operationLogService.writeLog({
      action: 'createMeeting',
      targetType: 'meeting',
      targetId: id,
      detail: `创建组会「${String(body.title).trim()}」`
    })
    const message = notice
      ? '组会已发布，并已自动发布公告通知全体成员'
      : '已保存（未发布，不通知成员）'
    return { success: true, message, data: { id, noticeId: notice ? notice.noticeId : null } }
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
    const exist = await meetingRepository.findById(id)
    if (!exist) return { success: false, message: '组会不存在' }
    await meetingRepository.update(id, payload || {})
    // 合并编辑后的字段，保存为「已发布」时同步公告（新建或更新）
    const merged = { ...exist, ...(payload || {}) }
    const notice = await syncMeetingNotice(merged)
    operationLogService.writeLog({
      action: 'updateMeeting',
      targetType: 'meeting',
      targetId: id,
      detail: '编辑组会'
    })
    const message = notice
      ? (notice.action === 'created' ? '组会已发布，并已自动发布公告通知全体成员' : '已更新，关联公告已同步')
      : '更新成功'
    return { success: true, message, data: { id, noticeId: notice ? notice.noticeId : null } }
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
