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

module.exports = researchService
