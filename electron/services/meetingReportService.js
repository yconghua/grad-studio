/**
 * 组会汇报服务（Service Layer）—— meeting_report 表
 *
 * 列表：组管 / 导师经 meeting 关联看本组全部；学生只看本人提交。
 * 提交：仅学生，student_id 取当前登录用户；审阅：仅组管 / 导师。
 * 通知：提交后告知本组组管与汇报人导师，审阅后告知汇报学生，形成双向闭环。
 */
const permission = require('./permission')
const meetingReportRepository = require('../db/repositories/meetingReportRepository')
const meetingRepository = require('../db/repositories/meetingRepository')
const userGroupRepository = require('../db/repositories/userGroupRepository')
const mentorStudentRepository = require('../db/repositories/mentorStudentRepository')
const operationLogService = require('./operationLogService')
const messageService = require('./messageService')
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
  // 校验组会存在、未删除且已发布（草稿 / 已取消的组会不接受汇报）
  const meeting = await meetingRepository.findById(body.meeting_id)
  if (!meeting) return { success: false, message: '组会不存在或已删除' }
  if (meeting.status !== 'published') {
    return { success: false, message: '该组会未发布（草稿 / 已取消），无法提交汇报' }
  }
  try {
    body.student_id = permission.currentUserId()
    const id = await meetingReportRepository.create(body)
    // 站内通知：告知本组组管与汇报人导师「有新汇报待审阅」，形成「提交 → 知晓」闭环
    try {
      const receivers = new Set()
      const gid = meeting.group_id
      if (gid) {
        const admins = await userGroupRepository.listByGroup({ group_id: gid, role_in_group: 'group_admin', status: 'active' })
        admins.forEach((a) => receivers.add(a.user_id))
      }
      const mentorRel = await mentorStudentRepository.findByStudent(body.student_id)
      if (mentorRel && mentorRel.mentor_id) receivers.add(mentorRel.mentor_id)
      receivers.delete(permission.currentUserId())
      const topic = String(body.topic || '').trim()
      for (const receiverId of receivers) {
        messageService.sendMessage({
          receiverId,
          msgType: 'meeting_report',
          title: '组会汇报待审阅',
          content: `学生提交了组会汇报${topic ? `「${topic}」` : ''}，请审阅`,
          refType: 'meeting_report',
          refId: id
        })
      }
    } catch (err) {
      console.error('[meetingReportService.submit] 通知发送失败:', err)
    }
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
    const record = await meetingReportRepository.findById(body.id)
    if (!record) return { success: false, message: '汇报不存在或已删除' }
    body.reviewed_by = permission.currentUserId()
    body.reviewed_at = new Date()
    await meetingReportRepository.update(body.id, body)
    operationLogService.writeLog({
      action: 'reviewMeetingReport',
      targetType: 'meeting_report',
      targetId: body.id,
      detail: `审阅组会汇报（结果 ${body.status}）`
    })
    // 站内通知：告知汇报学生审阅结果，形成「审阅 → 反馈」闭环
    try {
      const approved = body.status === 'approved'
      messageService.sendMessage({
        receiverId: record.student_id,
        msgType: 'meeting_report',
        title: approved ? '组会汇报已通过' : '组会汇报已打回',
        content: approved ? '您的组会汇报已通过审阅' : `您的组会汇报被打回${body.review_comment ? '：' + body.review_comment : '，请按意见修改后重新提交'}`,
        refType: 'meeting_report',
        refId: body.id
      })
    } catch (err) {
      console.error('[meetingReportService.review] 通知发送失败:', err)
    }
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
