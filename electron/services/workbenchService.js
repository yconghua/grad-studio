/**
 * 工作台服务（Service Layer）—— 个人待办 / 日程安排 / 通知公告
 *
 * 待办 / 日程为纯个人数据（write='self'：只能操作自己的），公告为管理类写操作。
 * 「总览」是聚合展示（不落库），「快捷入口」复用资源中心的 link 表，均不在此建模。
 */
const { todoRepo, scheduleRepo, noticeRepo } = require('../db/repositories/workbenchRepository')
const { createCrudService } = require('./crudService')
const permission = require('./permission')
const userRepository = require('../db/repositories/userRepository')
const { taskRepo, approvalRepo, weeklyReportRepo } = require('../db/repositories/collabRepository')
const { joinLeaveRepo } = require('../db/repositories/studioRepository')
const { paperRepo, graduationMilestoneRepo } = require('../db/repositories/researchRepository')
const { TODO_STATUS_DONE, NOTICE_STATUS_PUBLISHED } = require('../../shared/constants')

const todoService = createCrudService(todoRepo, {
  label: '待办', write: 'self', creatorField: 'user_id', ownerField: 'user_id'
})
const scheduleService = createCrudService(scheduleRepo, {
  label: '日程', write: 'self', creatorField: 'user_id', ownerField: 'user_id'
})
const noticeService = createCrudService(noticeRepo, {
  label: '公告', write: 'manager', creatorField: 'publisher_id'
})

/**
 * 完成待办：置为已完成并记录完成时间（复用工厂的 self 归属校验）。
 * @param {number} id 待办 id
 */
async function completeTodo(id) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const res = await todoService.update(id, { status: TODO_STATUS_DONE, done_at: new Date() })
  if (res.success) res.message = '已完成'
  return res
}

// 待办 / 日程为「纯个人数据」：列表仅管理员可见全部，导师与学生都只能看到自己的。
// （工厂 write='self' 的 list 过滤只对学生生效、导师豁免，此处显式收敛导师的可见范围）
const _todoList = todoService.list
todoService.list = async (filters = {}) => {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isAdmin()) {
    return _todoList({ ...(filters || {}), user_id: permission.currentUserId() })
  }
  return _todoList(filters)
}

const _scheduleList = scheduleService.list
scheduleService.list = async (filters = {}) => {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isAdmin()) {
    return _scheduleList({ ...(filters || {}), user_id: permission.currentUserId() })
  }
  return _scheduleList(filters)
}

/**
 * 发布公告：置为已发布并记录发布时间。
 * @param {number} id 公告 id
 */
async function publishNotice(id) {
  if (!permission.isManager()) return { success: false, message: '无权限：仅导师或管理员可发布公告' }
  const res = await noticeService.update(id, { status: NOTICE_STATUS_PUBLISHED, published_at: new Date() })
  if (res.success) res.message = '已发布'
  return res
}

// 公告列表：普通用户（学生）只看「已发布」；已关闭的公告不再显示（记录保留，导师 / 管理员可见全部）
const _noticeList = noticeService.list
noticeService.list = async (filters) => {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isManager()) {
    return _noticeList({ ...(filters || {}), status: NOTICE_STATUS_PUBLISHED })
  }
  return _noticeList(filters)
}

// 本周一日期（YYYY-MM-DD）：判断学生是否已交本周周报
function thisMondayStr() {
  const now = new Date()
  const day = now.getDay() || 7
  const m = new Date(now)
  m.setDate(now.getDate() - day + 1)
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(m.getDate()).padStart(2, '0')}`
}

/**
 * 工作台角色化总览（Dashboard 数据源，不落库）：
 * - 管理员：全系统统计（成员/学生/导师/待办/任务/待审批/公告）；
 * - 导师：名下学生数、待审批（审批+入组离组）、本周未交周报学生、名下任务；
 * - 学生：我的待办、我的任务、我的论文、毕业进度。
 */
async function overview() {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const me = permission.currentUserId()
  const out = { role: 'user' }
  try {
    if (permission.isAdmin()) {
      const users = await userRepository.list()
      const todos = await todoRepo.list()
      const tasks = await taskRepo.list()
      const approvals = await approvalRepo.list({ status: 'pending' })
      const notices = await noticeRepo.list()
      out.role = 'admin'
      out.memberTotal = (users || []).length
      out.studentTotal = (users || []).filter((u) => u.role === 'student').length
      out.mentorTotal = (users || []).filter((u) => u.role === 'mentor').length
      out.todoTotal = (todos || []).length
      out.taskTotal = (tasks || []).length
      out.pendingApproval = (approvals || []).length
      out.noticeCount = (notices || []).length
    } else if (permission.isManager()) {
      const students = await userRepository.list({ advisor_id: me, role: 'student' })
      const studentIds = (students || []).map((s) => Number(s.id))
      const approvals = await approvalRepo.list({ status: 'pending' })
      const joinLeaves = await joinLeaveRepo.list({ status: 'pending' })
      const tasks = await taskRepo.list()
      // 本周未交周报：名下学生 - 本周已提交周报的学生
      const monday = thisMondayStr()
      let submittedIds = new Set()
      if (studentIds.length) {
        const reports = await weeklyReportRepo.list({ week_start: monday, student_id: { op: 'IN', value: studentIds } })
        submittedIds = new Set((reports || []).map((r) => Number(r.student_id)))
      }
      const missing = (students || []).filter((s) => !submittedIds.has(Number(s.id)))
      const idSet = new Set(studentIds)
      const myTasks = (tasks || []).filter(
        (t) => Number(t.created_by) === Number(me) || (t.assignee_id && idSet.has(Number(t.assignee_id)))
      )
      out.role = 'mentor'
      out.myStudentCount = (students || []).length
      out.pendingApproval = (approvals || []).length
      out.pendingJoinLeave = (joinLeaves || []).length
      out.missingWeeklyCount = missing.length
      out.missingWeeklyStudents = missing.slice(0, 5).map((s) => ({ id: s.id, real_name: s.real_name || s.username }))
      out.myTaskCount = myTasks.length
    } else {
      const todos = await todoRepo.list({ user_id: me })
      const tasks = await taskRepo.list({ assignee_id: me })
      const papers = await paperRepo.list({ created_by: me })
      const milestones = await graduationMilestoneRepo.list({ user_id: me })
      const doneMs = (milestones || []).filter((m) => m.status === 'done').length
      out.role = 'student'
      out.todoTotal = (todos || []).length
      out.taskTotal = (tasks || []).length
      out.paperTotal = (papers || []).length
      out.msTotal = (milestones || []).length
      out.msDone = doneMs
    }
    return { success: true, ...out }
  } catch (err) {
    console.error('[workbench.overview] 数据库异常:', err)
    return { success: false, message: '工作台总览加载失败' }
  }
}

module.exports = { todo: todoService, schedule: scheduleService, notice: noticeService, completeTodo, publishNotice, overview }
