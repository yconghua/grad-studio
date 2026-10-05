/**
 * 超管任务总览服务（Service Layer）—— 全局只读
 *
 * 权限模型：仅超级管理员可访问（当前会话角色校验，前端不可信）；
 * 超管不参与任何任务操作（不创建/编辑/删除/验收），本服务不提供写接口。
 * 数据形态：按课题组分类 → 组管/导师创建的任务（每任务一行，不随参与人重复）。
 * 统计口径：全局任务数 / 完成率 / 逾期 / 待验收 / 按课题组分布 / 按创建角色分布。
 */
const {
  ROLE_SUPER_ADMIN,
  ROLE_GROUP_ADMIN,
  ROLE_MENTOR,
  ROLE_STUDENT
} = require('../../shared/constants')
const groupRepository = require('../db/repositories/groupRepository')
const taskRepository = require('../db/repositories/taskRepository')
const taskParticipantRepository = require('../db/repositories/taskParticipantRepository')
const authService = require('./authService')
const ApiError = require('./apiError')

const TASK_STATUS_REVIEW = 3
const TASK_STATUS_DONE = 4

// 当前登录用户：仅超管
async function currentUser() {
  const me = await authService.getCurrentUser()
  if (!me) throw new ApiError('未登录，请重新登录', 401)
  if (me.role !== ROLE_SUPER_ADMIN) throw new ApiError('无权限：仅超级管理员可查看任务总览', 403)
  return me
}

function displayName(row) {
  const real = row ? row.real_name || row.creator_real_name || row.operator_real_name : null
  if (real && String(real).trim()) return real
  const username = row ? row.username || row.creator_username || row.operator_username : null
  if (username) return username
  return `用户#${row && row.id}`
}

// 任务行 → 总览 DTO（不含 description 等大字段）
function toOverviewTaskDto(row) {
  if (!row) return null
  return {
    id: Number(row.id),
    groupId: Number(row.group_id),
    title: row.title,
    creatorId: Number(row.creator_id),
    creatorName: displayName(row),
    creatorRole: row.creator_role || '',
    status: Number(row.status),
    priority: Number(row.priority),
    dueTime: row.due_time || null,
    finishTime: row.finish_time || null,
    progress: Number(row.progress) || 0,
    createdAt: row.created_at
  }
}

/**
 * 全局任务总览：按课题组分类，每个课题组下列出组管/导师创建的任务（每任务一行，不随参与人重复）。
 * 支持按课题组 / 状态筛选；只读数据，前端直接消费。
 * @param {{ groupId?:number, status?:number|string }} filters
 * @returns {{ groups: Array<{ groupId, groupName, tasks: Array }> }}
 */
async function overviewList(filters = {}) {
  await currentUser()

  const groupId = filters.groupId ? Number(filters.groupId) : null
  const status = filters.status === undefined || filters.status === null || filters.status === ''
    ? undefined
    : Number(filters.status)

  const groups = groupId
    ? [await groupRepository.findById(groupId)].filter(Boolean)
    : await groupRepository.listAllEnabled()

  const out = []
  for (const g of groups) {
    const tasks = await taskRepository.listAll({
      groupId: g.id,
      status,
      creatorRoles: [ROLE_GROUP_ADMIN, ROLE_MENTOR],
      sortField: filters.sortField,
      sortOrder: filters.sortOrder
    })
    out.push({
      groupId: g.id,
      groupName: g.name,
      tasks: tasks.map(toOverviewTaskDto)
    })
  }
  return { groups: out }
}

/**
 * 超管总览详情（只读）：任务基础信息 + 参与人
 * @param {number} id
 */
async function overviewDetail(id) {
  await currentUser()
  const task = await taskRepository.findById(Number(id))
  if (!task) throw new ApiError('任务不存在', 404)
  const participants = await taskParticipantRepository.listByTask(task.id)
  return {
    ...toOverviewTaskDto(task),
    groupName: task.group_name || '',
    description: task.description || '',
    startTime: task.start_time || null,
    creatorRole: task.creator_role || '',
    participants: participants.map((p) => ({
      userId: Number(p.user_id),
      username: p.username || '',
      realName: p.real_name || '',
      role: p.role || '',
      finishTime: p.finish_time || null
    }))
  }
}

/**
 * 全局统计：总数 / 状态分布 / 完成率 / 逾期 / 待验收 / 按课题组分布 / 按创建角色分布
 */
async function overviewStats() {
  await currentUser()

  const dist = await taskRepository.statusDistribution({})
  const total = Object.values(dist).reduce((a, b) => a + b, 0)
  const done = dist[TASK_STATUS_DONE] || 0

  const groups = await groupRepository.listAllEnabled()
  const byGroup = []
  for (const g of groups) {
    const gDist = await taskRepository.statusDistribution({ groupId: g.id })
    const gTotal = Object.values(gDist).reduce((a, b) => a + b, 0)
    byGroup.push({
      groupId: g.id,
      groupName: g.name,
      total: gTotal,
      done: gDist[TASK_STATUS_DONE] || 0,
      pendingReview: gDist[TASK_STATUS_REVIEW] || 0,
      completionRate: gTotal ? Math.round(((gDist[TASK_STATUS_DONE] || 0) / gTotal) * 10000) / 100 : 0
    })
  }
  byGroup.sort((a, b) => b.total - a.total || a.groupId - b.groupId)

  return {
    total,
    statusDist: dist,
    done,
    completionRate: total ? Math.round((done / total) * 10000) / 100 : 0,
    overdue: await taskRepository.countOverdue({}),
    pendingReview: dist[TASK_STATUS_REVIEW] || 0,
    byGroup,
    byCreatorRole: await taskRepository.creatorRoleDistribution()
  }
}

module.exports = {
  overviewList,
  overviewDetail,
  overviewStats
}
