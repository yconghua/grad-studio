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

module.exports = researchService
