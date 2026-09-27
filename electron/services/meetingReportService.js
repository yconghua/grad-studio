/**
 * 组会汇报服务（Service Layer）—— meeting_report 表
 *
 * 列表：组管 / 导师经 meeting 关联看本组全部；学生只看本人提交。
 * 提交：仅学生，student_id 取当前登录用户；审阅：仅组管 / 导师。
 */
const permission = require('./permission')
const meetingReportRepository = require('../db/repositories/meetingReportRepository')
const meetingRepository = require('../db/repositories/meetingRepository')
const operationLogService = require('./operationLogService')
const { ROLE_STUDENT } = require('../../shared/constants')

// meeting-report:list
async function list(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  try {
    let data
    if (permission.isManager()) {
      const groupId = payload && payload.group_id
      if (!groupId) return { success: false, message: '缺少课题组标识（group_id）' }
      data = await meetingReportRepository.listByGroup(groupId)
    } else if (permission.currentRole() === ROLE_STUDENT) {
      data = await meetingReportRepository.listByStudent(permission.currentUserId())
    } else {
      return { success: false, message: '无权限查看汇报列表' }
    }
    return { success: true, data }
  } catch (err) {
    console.error('[meetingReportService.list] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// meeting-report:submit —— 仅学生提交本人汇报
async function submit(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (permission.currentRole() !== ROLE_STUDENT) {
    return { success: false, message: '无权限：仅学生可提交组会汇报' }
  }
  const body = payload || {}
  if (!body.meeting_id) return { success: false, message: '缺少组会标识（meeting_id）' }
  // 校验组会存在且未删除
  const meeting = await meetingRepository.findById(body.meeting_id)
  if (!meeting) return { success: false, message: '组会不存在或已删除' }
  try {
    body.student_id = permission.currentUserId()
    const id = await meetingReportRepository.create(body)
    return { success: true, message: '提交成功', data: { id } }
  } catch (err) {
    console.error('[meetingReportService.submit] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// meeting-report:review —— 仅组管 / 导师审阅，写状态 / 意见 / 审阅人 / 时间
async function review(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isManager()) return { success: false, message: '无权限：仅课题组管理员与导师可审阅汇报' }
  const body = payload || {}
  if (!body.id) return { success: false, message: '缺少汇报标识（id）' }
  if (!body.status) return { success: false, message: '缺少审阅状态（status）' }
  try {
    body.reviewed_by = permission.currentUserId()
    body.reviewed_at = new Date()
    await meetingReportRepository.update(body.id, body)
    operationLogService.writeLog({
      action: 'reviewMeetingReport',
      targetType: 'meeting_report',
      targetId: body.id,
      detail: `审阅组会汇报（结果 ${body.status}）`
    })
    return { success: true, message: '审阅完成' }
  } catch (err) {
    console.error('[meetingReportService.review] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

module.exports = {
  list,
  submit,
  review
}
