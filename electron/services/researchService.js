/**
 * 科研管理服务（Service Layer）—— 项目 / 论文 / 专利 / 科研日志 / 成果 / 经费 / 毕业里程碑
 */
const {
  projectRepo,
  paperRepo,
  patentRepo,
  researchLogRepo,
  achievementRepo,
  fundRecordRepo,
  graduationMilestoneRepo
} = require('../db/repositories/researchRepository')
const { createCrudService } = require('./crudService')
const permission = require('./permission')
const userRepository = require('../db/repositories/userRepository')

const researchService = {
  project: createCrudService(projectRepo, { label: '项目', write: 'manager', creatorField: 'created_by' }),
  paper: createCrudService(paperRepo, { label: '论文', write: 'member', creatorField: 'created_by' }),
  patent: createCrudService(patentRepo, { label: '专利软著', write: 'member', creatorField: 'created_by' }),
  researchLog: createCrudService(researchLogRepo, { label: '科研日志', write: 'member', creatorField: 'author_id' }),
  achievement: createCrudService(achievementRepo, { label: '成果', write: 'member', creatorField: 'created_by' }),
  fundRecord: createCrudService(fundRecordRepo, { label: '经费', write: 'manager', creatorField: 'created_by' }),
  graduationMilestone: createCrudService(graduationMilestoneRepo, { label: '毕业里程碑', write: 'manager' })
}

// 毕业里程碑列表：管理员看全部；导师看自己学生的；学生只看自己的
const _milestoneList = researchService.graduationMilestone.list
researchService.graduationMilestone.list = async (filters = {}) => {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (permission.isAdmin()) {
    return _milestoneList(filters)
  }
  const me = permission.currentUserId()
  if (permission.isManager()) {
    const students = await userRepository.list({ advisor_id: me, role: 'student' })
    const ids = (students || []).map((s) => s.id)
    if (!ids.length) return { success: true, list: [] }
    filters.user_id = { op: 'IN', value: ids }
  } else {
    filters.user_id = me
  }
  return _milestoneList(filters)
}

// ===== 科研记录可见性（论文 / 专利 / 科研日志 / 成果登记） =====
// 规则：管理员看全部；导师看「自己 + 名下学生」创建的；学生只看自己创建的。
// 归属字段由调用方传入：paper/patent/achievement 用 created_by，research_log 用 author_id。
async function myStudentIds(me) {
  const students = await userRepository.list({ advisor_id: me, role: 'student' })
  return (students || []).map((s) => s.id)
}

function wrapRecordVisibleList(service, ownerField) {
  const base = service.list
  service.list = async (filters = {}) => {
    if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
    if (permission.isAdmin()) return base(filters)
    const me = permission.currentUserId()
    if (permission.isManager()) {
      const ids = [me, ...(await myStudentIds(me))]
      filters[ownerField] = { op: 'IN', value: ids }
    } else {
      filters[ownerField] = me
    }
    return base(filters)
  }
}

// ===== 项目 / 课题可见性 =====
// 规则：管理员看全部；导师看自己创建的项目/课题；学生只能看自己导师创建的项目/课题。
function wrapProjectVisibleList(service) {
  const base = service.list
  service.list = async (filters = {}) => {
    if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
    if (permission.isAdmin()) return base(filters)
    const me = permission.currentUserId()
    if (permission.isManager()) {
      filters.created_by = me
    } else {
      // 学生：只能看自己导师创建的项目（无导师则看不到任何项目）
      const meRow = await userRepository.findById(me)
      const advisorId = meRow ? meRow.advisor_id : null
      if (!advisorId) return { success: true, list: [] }
      filters.created_by = advisorId
    }
    return base(filters)
  }
}

wrapRecordVisibleList(researchService.paper, 'created_by')
wrapRecordVisibleList(researchService.patent, 'created_by')
wrapRecordVisibleList(researchService.researchLog, 'author_id')
wrapRecordVisibleList(researchService.achievement, 'created_by')
wrapProjectVisibleList(researchService.project)

/**
 * 毕业进度总览（仪表盘数据源）：
 * 管理员看全部学生；导师看名下学生；学生只看自己。
 * 返回每个学生的里程碑统计：完成/进行/待办/延期、最近截止、剩余天数、预警。
 */
async function graduationOverview() {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const me = permission.currentUserId()
  try {
    // 1. 确定目标学生
    let studentRows = []
    if (permission.isAdmin()) {
      studentRows = await userRepository.list({ role: 'student' })
    } else if (permission.isManager()) {
      studentRows = await userRepository.list({ advisor_id: me, role: 'student' })
    } else {
      const self = await userRepository.findById(me)
      if (self) studentRows = [self]
    }
    const ids = new Set((studentRows || []).map((s) => Number(s.id)))

    // 2. 拉全部里程碑本地聚合
    const milestones = await graduationMilestoneRepo.list({}, 'deadline ASC')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dayMs = 24 * 60 * 60 * 1000
    const group = new Map()
    for (const ms of milestones || []) {
      if (!ids.has(Number(ms.user_id))) continue
      if (!group.has(Number(ms.user_id))) group.set(Number(ms.user_id), [])
      group.get(Number(ms.user_id)).push(ms)
    }

    // 3. 逐学生统计
    const students = []
    for (const s of studentRows || []) {
      const rows = group.get(Number(s.id)) || []
      const byStatus = { done: 0, in_progress: 0, pending: 0, delayed: 0 }
      let next = null
      const alerts = []
      for (const r of rows) {
        byStatus[r.status] = (byStatus[r.status] || 0) + 1
        if (!r.deadline) continue
        const due = new Date(`${String(r.deadline).slice(0, 10)}T00:00:00`)
        const diff = Math.floor((due - today) / dayMs)
        if (r.status !== 'done') {
          if (diff < 0) alerts.push({ level: 'danger', text: `「${r.type}」已逾期 ${-diff} 天` })
          else if (diff <= 3) alerts.push({ level: 'warn', text: `「${r.type}」${diff === 0 ? '今天到期' : diff + ' 天后到期'}` })
          if (!next || diff < next.days_left) {
            next = { type: r.type, deadline: String(r.deadline).slice(0, 10), days_left: diff }
          }
        }
      }
      students.push({
        user_id: s.id,
        real_name: s.real_name || '',
        username: s.username,
        total: rows.length,
        done: byStatus.done || 0,
        in_progress: byStatus.in_progress || 0,
        pending: byStatus.pending || 0,
        delayed: byStatus.delayed || 0,
        next,
        alerts
      })
    }
    // 有最近截止（未完成）的排前，按剩余天数升序；无里程碑的放后
    students.sort((a, b) => {
      const an = a.next ? a.next.days_left : 999999
      const bn = b.next ? b.next.days_left : 999999
      return an - bn
    })
    return { success: true, students }
  } catch (err) {
    console.error('[research.graduationOverview] 数据库异常:', err)
    return { success: false, message: '毕业进度统计失败' }
  }
}

module.exports = researchService
module.exports.graduationOverview = graduationOverview
