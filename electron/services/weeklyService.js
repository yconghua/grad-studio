/**
 * 周报 Service（Service Layer）—— weekly:* 通道的业务逻辑
 *
 * 学生侧：列表 / 新建 / 编辑草稿 / 提交；
 * 教师侧（group_admin / mentor）：批阅 / 全组列表。
 *
 * 可见范围约束（批阅侧）：
 *   - group_admin：本人管理课题组内的学生（user_group.role_in_group = student）；
 *   - mentor：本人名下学生（mentor_student 表）；
 *   - 两者取并集，防止跨组 / 跨导师越权查看或批阅他人学生周报。
 */
const permission = require('./permission')
const weeklyReportRepository = require('../db/repositories/weeklyReportRepository')
const userGroupRepository = require('../db/repositories/userGroupRepository')
const mentorStudentRepository = require('../db/repositories/mentorStudentRepository')
const operationLogService = require('./operationLogService')
const messageService = require('./messageService')

// 计算当前批阅者可见的学生 id 集合：组管=管理组内学生，导师=名下学生，取并集
async function getVisibleStudentIds(userId) {
  const ids = new Set()
  const groups = await userGroupRepository.listGroupsByUser(userId)
  const adminGroupIds = groups.filter((g) => g.role_in_group === 'group_admin').map((g) => g.id)
  for (const gid of adminGroupIds) {
    const members = await userGroupRepository.listByGroup({ group_id: gid, role_in_group: 'student', status: 'active' })
    members.forEach((m) => ids.add(m.user_id))
  }
  const students = await mentorStudentRepository.listByMentor(userId, 'active')
  students.forEach((s) => ids.add(s.student_id))
  return [...ids]
}

// 列出我的周报
async function listMine() {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const studentId = permission.currentUserId()
  try {
    const data = await weeklyReportRepository.listByStudent(studentId)
    return { success: true, data }
  } catch (err) {
    console.error('[weeklyService.listMine] 数据库异常:', err)
    return { success: false, message: '读取周报失败，请稍后重试' }
  }
}

// 新建周报（草稿）
async function create(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const studentId = permission.currentUserId()
  if (!payload.week_start || !payload.week_end) {
    return { success: false, message: '请选择周起始与结束日期' }
  }
  try {
    const id = await weeklyReportRepository.createForStudent(studentId, payload)
    return { success: true, data: { id }, message: '周报草稿已保存' }
  } catch (err) {
    console.error('[weeklyService.create] 数据库异常:', err)
    return { success: false, message: '保存周报失败，请稍后重试' }
  }
}

// 更新本人草稿周报
async function update(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const studentId = permission.currentUserId()
  const { id } = payload
  if (!id) return { success: false, message: '缺少周报 id' }
  try {
    const record = await weeklyReportRepository.findById(id)
    if (!record || record.student_id !== studentId) {
      return { success: false, message: '记录不存在或无权操作' }
    }
    if (record.status !== 'draft') {
      return { success: false, message: '仅草稿状态的周报可编辑' }
    }
    const affected = await weeklyReportRepository.updateOwnedDraft(id, studentId, payload)
    return { success: true, data: { affected }, message: '周报已更新' }
  } catch (err) {
    console.error('[weeklyService.update] 数据库异常:', err)
    return { success: false, message: '更新周报失败，请稍后重试' }
  }
}

// 提交周报（draft → submitted）
async function submit(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const studentId = permission.currentUserId()
  const { id } = payload
  if (!id) return { success: false, message: '缺少周报 id' }
  try {
    const record = await weeklyReportRepository.findById(id)
    if (!record || record.student_id !== studentId) {
      return { success: false, message: '记录不存在或无权操作' }
    }
    if (record.status !== 'draft') {
      return { success: false, message: '仅草稿状态的周报可提交' }
    }
    const affected = await weeklyReportRepository.submit(id, studentId)
    // 站内通知：告知学生的导师「周报待批阅」，形成「提交 → 导师知晓」闭环
    try {
      const mentorRel = await mentorStudentRepository.findByStudent(studentId)
      if (mentorRel && mentorRel.mentor_id) {
        messageService.sendMessage({
          receiverId: mentorRel.mentor_id,
          msgType: 'weekly',
          title: '周报待批阅',
          content: `学生提交了周报${record.title ? `「${String(record.title).trim()}」` : ''}，请批阅`,
          refType: 'weekly',
          refId: id
        })
      }
    } catch (err) {
      console.error('[weeklyService.submit] 通知发送失败:', err)
    }
    return { success: true, data: { affected }, message: '周报已提交' }
  } catch (err) {
    console.error('[weeklyService.submit] 数据库异常:', err)
    return { success: false, message: '提交周报失败，请稍后重试' }
  }
}

// 教师批阅周报（仅 group_admin / mentor；可见范围校验：仅可批阅名下 / 管理组内学生）
async function review(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isManager()) return { success: false, message: '无批阅权限' }
  const { id, review_comment: reviewComment } = payload
  if (!id) return { success: false, message: '缺少周报 id' }
  try {
    const record = await weeklyReportRepository.findById(id)
    if (!record) return { success: false, message: '周报不存在' }
    if (record.status !== 'submitted') {
      return { success: false, message: '仅待批阅状态的周报可批阅' }
    }
    const visibleStudentIds = await getVisibleStudentIds(permission.currentUserId())
    if (!visibleStudentIds.includes(record.student_id)) {
      return { success: false, message: '无权批阅该学生的周报' }
    }
    const affected = await weeklyReportRepository.review(id, {
      reviewedBy: permission.currentUserId(),
      reviewComment
    })
    operationLogService.writeLog({
      action: 'reviewWeekly',
      targetType: 'weekly_report',
      targetId: id,
      detail: '批阅周报'
    })
    // 站内通知：告知学生周报已批阅
    if (record.student_id) {
      messageService.sendMessage({
        receiverId: record.student_id,
        msgType: 'other',
        title: '周报已批阅',
        content: '您的周报已被导师批阅，请查看意见',
        refType: 'weekly',
        refId: id
      })
    }
    return { success: true, data: { affected }, message: '批阅完成' }
  } catch (err) {
    console.error('[weeklyService.review] 数据库异常:', err)
    return { success: false, message: '批阅周报失败，请稍后重试' }
  }
}

// 列出可见范围周报（仅 group_admin / mentor，可按 student_id 过滤）
async function listAll(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isManager()) return { success: false, message: '无查看权限' }
  try {
    const visibleStudentIds = await getVisibleStudentIds(permission.currentUserId())
    if (!visibleStudentIds.length) return { success: true, data: [] }
    const data = await weeklyReportRepository.listAll({
      studentIds: visibleStudentIds,
      studentId: payload.student_id
    })
    return { success: true, data }
  } catch (err) {
    console.error('[weeklyService.listAll] 数据库异常:', err)
    return { success: false, message: '读取周报列表失败，请稍后重试' }
  }
}

module.exports = { listMine, create, update, submit, review, listAll }
