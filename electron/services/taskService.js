/**
 * 任务服务（Service Layer）—— 任务全生命周期
 *
 * 权限模型（唯一可信来源：主进程会话 authService.getCurrentUser，前端一律不可信）：
 *   - 创建：仅组管（参与人 = 本组启用导师+学生）与导师（参与人 = 自己名下学生）；
 *   - 创建者即负责人/验收人：创建时固定为当前登录用户，表单无负责人字段，创建者不参与任务；
 *   - 编辑 / 删除 / 恢复 / 分配 / 移除参与人 / 取消 / 重新打开 / 验收：仅创建者；
 *   - 提交进展 / 完成任务：仅参与人；
 *   - 查看：按角色可见范围收敛（组管 = 本组；导师 = 我创建的 / 我参与的 / 名下学生；
 *     学生 = 我参与的；超管不走本服务，走 taskOverviewService 只读总览）。
 *
 * 状态机：1 待办 → 2 进行中 → 3 待验收 → 4 已完成；
 *         3 可驳回回 2；1/2 可取消（5）；4 可重新打开回 2。
 * 参与人提交完成一律进入待验收（无「无验收人直接完成」分支，验收人恒为创建者）。
 * 所有主表写操作走乐观锁（version 条件更新），冲突返回「任务已被他人更新，请刷新」。
 *
 * 数据边界：不提供评论 / 催办 / 提醒学生功能；公告与组会不生成任务、任务不记录来源。
 */
const { runTransaction } = require('../db/connection')
const {
  ROLE_SUPER_ADMIN,
  ROLE_GROUP_ADMIN,
  ROLE_MENTOR,
  ROLE_STUDENT
} = require('../../shared/constants')
const userRepository = require('../db/repositories/userRepository')
const groupRepository = require('../db/repositories/groupRepository')
const taskRepository = require('../db/repositories/taskRepository')
const taskParticipantRepository = require('../db/repositories/taskParticipantRepository')
const taskDynamicRepository = require('../db/repositories/taskDynamicRepository')
const authService = require('./authService')
const groupService = require('./groupService')
const notificationService = require('./notificationService')
const ApiError = require('./apiError')

// ===== 任务状态 / 优先级（与 schema 枚举一致） =====
const TASK_STATUS_TODO = 1
const TASK_STATUS_DOING = 2
const TASK_STATUS_REVIEW = 3
const TASK_STATUS_DONE = 4
const TASK_STATUS_CANCELED = 5

const TASK_PRIORITY_KEYS = [1, 2, 3, 4]

const TITLE_MAX = 100
const DESCRIPTION_MAX = 2000
const PROGRESS_MAX = 100
const NOTE_MAX = 500

// 动态动作（task_dynamic.action）
const ACT = {
  create: 'create', // 创建
  update: 'update', // 编辑
  assign: 'assign', // 新增参与人
  remove: 'remove', // 移除参与人
  progress: 'progress', // 提交进展
  statusChange: 'status_change', // 状态流转（进行中/待验收/取消/重新打开）
  verifyApprove: 'verify_approve', // 验收通过
  verifyReject: 'verify_reject', // 验收驳回
  delete: 'delete', // 删除
  restore: 'restore' // 恢复
}

// ===== 基础工具 =====

// 当前登录用户（401 兜底）
async function currentUser() {
  const me = await authService.getCurrentUser()
  if (!me) throw new ApiError('未登录，请重新登录', 401)
  return me
}

// 组管绑定的课题组（无绑定即无任务权限）
async function groupAdminGroupId(me) {
  const group = await groupRepository.findByAdminUserId(me.id)
  if (!group) throw new ApiError('当前账号未绑定课题组，无法进行任务操作', 403)
  return Number(group.id)
}

// 导师/学生当前有效课题组（实时查询，换组/离组立即生效）
async function memberGroupId(me) {
  const row = await userRepository.findActiveGroupOfUser(me.id)
  return row ? Number(row.group_id) : null
}

// 标题：非空 + 长度上限
function assertTitle(title) {
  const s = String(title == null ? '' : title).trim()
  if (!s) throw new ApiError('标题不能为空', 400)
  if (s.length > TITLE_MAX) throw new ApiError(`标题不能超过 ${TITLE_MAX} 字`, 400)
  return s
}

// 描述：可选，长度上限，空串归一为 null
function assertDescription(desc) {
  if (desc === undefined || desc === null) return null
  const s = String(desc).trim()
  if (!s) return null
  if (s.length > DESCRIPTION_MAX) throw new ApiError(`描述不能超过 ${DESCRIPTION_MAX} 字`, 400)
  return s
}

// 优先级：必须在 1~4
function assertPriority(priority) {
  const n = Number(priority)
  if (!TASK_PRIORITY_KEYS.includes(n)) throw new ApiError('优先级无效', 400)
  return n
}

// 时间：非空且可解析（YYYY-MM-DD HH:mm:ss 兼容秒级），空串归一为 null
function assertDateTime(value, label) {
  const s = String(value == null ? '' : value).trim()
  if (!s) return null
  if (Number.isNaN(Date.parse(s.replace(' ', 'T')))) throw new ApiError(`${label}格式无效`, 400)
  return s
}

// 当前时间（与库内 NOW() 对齐：秒级字符串）
function nowSql() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

// 参与人集合校验：去重 + 在可选范围内（组管=本组启用导师/学生；导师=自己名下学生）
async function assertParticipants(me, groupId, participantIds) {
  const list = Array.isArray(participantIds) ? participantIds : []
  const ids = []
  for (const raw of list) {
    const n = Number(raw)
    if (!Number.isInteger(n) || n <= 0 || ids.includes(n)) continue
    ids.push(n)
  }
  if (ids.length === 0) throw new ApiError('请选择任务参与人', 400)

  if (me.role === ROLE_GROUP_ADMIN) {
    const memberSet = new Set(
      (await userRepository.listEnabledAudienceByGroup(groupId)).map((r) => Number(r.id))
    )
    for (const uid of ids) {
      if (!memberSet.has(uid)) {
        throw new ApiError('参与人不在可选范围（只能选择本组启用的导师或学生）', 400)
      }
    }
  } else if (me.role === ROLE_MENTOR) {
    const studentSet = new Set(await userRepository.listEnabledStudentIdsByMentor(me.id))
    for (const uid of ids) {
      if (!studentSet.has(uid)) {
        throw new ApiError('参与人必须是当前导师名下的学生', 400)
      }
    }
  } else {
    throw new ApiError('无权限：无权分配参与人', 403)
  }
  return ids
}

// 任务可见性（查看类操作）：按角色收敛
async function assertTaskVisible(me, task) {
  if (me.role === ROLE_GROUP_ADMIN) {
    const myGroupId = await groupAdminGroupId(me)
    if (Number(task.group_id) !== myGroupId) throw new ApiError('无权限：只能查看本课题组的任务', 403)
    return
  }
  const myGroupId = await memberGroupId(me)
  if (!myGroupId || Number(myGroupId) !== Number(task.group_id)) {
    throw new ApiError('无权限：你不是该课题组的有效成员', 403)
  }
  if (Number(task.creator_id) === me.id) return
  const participantIds = await taskParticipantRepository.listUserIdsByTask(task.id)
  if (participantIds.includes(me.id)) return
  if (me.role === ROLE_MENTOR) {
    // 名下学生参与的任务
    const studentSet = new Set(await userRepository.listEnabledStudentIdsByMentor(me.id))
    if (participantIds.some((uid) => studentSet.has(uid))) return
  }
  throw new ApiError('无权限：无权查看该任务', 403)
}

// 读取系统配置键（不存在时返回默认值）
async function configNumber(key, fallback) {
  try {
    const systemConfigRepository = require('../db/repositories/systemConfigRepository')
    const row = await systemConfigRepository.findByKey(key)
    const n = Number(row && row.param_value)
    return n > 0 ? n : fallback
  } catch (e) {
    return fallback
  }
}

// 任务行 → 前端 DTO（名称回退：real_name → username → 用户#id）
function displayName(row, prefix) {
  const real = row ? row.real_name || row.creator_real_name || row.operator_real_name : null
  if (real && String(real).trim()) return real
  const username = row ? row.username || row.creator_username || row.operator_username : null
  if (username) return username
  return `${prefix}${row && row.id}`
}

function toTaskDto(row) {
  if (!row) return null
  return {
    id: Number(row.id),
    groupId: Number(row.group_id),
    groupName: row.group_name || '',
    title: row.title,
    description: row.description == null ? '' : row.description,
    creatorId: Number(row.creator_id),
    creatorRole: row.creator_role || '',
    creatorName: displayName(row, '用户#'),
    status: Number(row.status),
    priority: Number(row.priority),
    startTime: row.start_time || null,
    dueTime: row.due_time || null,
    finishTime: row.finish_time || null,
    progress: Number(row.progress) || 0,
    version: Number(row.version) || 0,
    participantCount: row.participant_count == null ? null : Number(row.participant_count),
    createdAt: row.created_at,
    changeTs: row.change_ts
  }
}

// 空列表结果（未入组成员返回，保持分页结构）
function emptyListResult() {
  return { list: [], total: 0, page: 1, pageSize: 8, totalPages: 0 }
}

// ===== 创建任务 =====

/**
 * 创建任务（仅组管/导师；创建者 = 负责人 = 验收人，创建者不参与任务）
 * @param {{ title, description, priority, startTime, dueTime, participantIds:number[] }} data
 */
async function createTask(data = {}) {
  const me = await currentUser()
  let targetGroupId
  if (me.role === ROLE_GROUP_ADMIN) {
    targetGroupId = await groupAdminGroupId(me)
  } else if (me.role === ROLE_MENTOR) {
    const gid = await memberGroupId(me)
    if (!gid) throw new ApiError('当前账号未加入课题组，无法创建任务', 400)
    targetGroupId = gid
  } else {
    throw new ApiError('无权限：无权创建任务', 403)
  }
  await groupService.assertGroupWritable(targetGroupId)

  const title = assertTitle(data.title)
  const description = assertDescription(data.description)
  const priority = assertPriority(data.priority)
  const startTime = assertDateTime(data.startTime, '开始时间')
  const dueTime = assertDateTime(data.dueTime, '截止时间')
  if (startTime && dueTime && dueTime < startTime) throw new ApiError('截止时间不能早于开始时间', 400)
  // 截止时间不能早于当前时间；组管例外（允许补录历史任务）
  if (dueTime && me.role !== ROLE_GROUP_ADMIN && dueTime < nowSql()) {
    throw new ApiError('截止时间不能早于当前时间', 400)
  }

  const participantIds = await assertParticipants(me, targetGroupId, data.participantIds)

  const taskId = await runTransaction(async () => {
    const id = await taskRepository.create({
      group_id: targetGroupId,
      title,
      description,
      creator_id: me.id,
      creator_role: me.role,
      status: TASK_STATUS_TODO,
      priority,
      start_time: startTime,
      due_time: dueTime,
      visible_scope: 1,
      progress: 0,
      sort_order: 0,
      version: 0
    })
    await taskParticipantRepository.createMany(id, participantIds)
    await taskDynamicRepository.create(id, me.id, ACT.create, {
      toStatus: TASK_STATUS_TODO,
      detail: `创建任务「${title}」`
    })
    return id
  })

  // 通知参与人（事务外发送；类型禁用时静默跳过）
  await notificationService.createForUsers({
    recipients: participantIds,
    typeKey: 'task_assigned',
    title,
    summary: `截止时间：${dueTime || '未设置'}`,
    bizType: 'task',
    bizId: taskId,
    groupId: targetGroupId
  })

  return getTaskDetail(taskId)
}

// ===== 列表查询 =====

/**
 * 任务分页列表（按角色 + scope 收敛范围）
 * @param {{ scope?: 'mine-created'|'mine-participated'|'my-students'|'group',
 *           page?:number, status?:number, priority?:number, keyword?:string, memberId?:number }} param
 */
async function listTasks({ scope = 'mine-created', page, status, priority, keyword, memberId, sortField, sortOrder } = {}) {
  const me = await currentUser()
  const filters = { page, status, priority, keyword, sortField, sortOrder }
  // 按成员（参与人）筛选：仅组管「组内成员任务」/ 导师「自己学生的任务」两处使用，
  // 服务端不再额外校验该成员身份（范围本身已限定在本组/名下学生内）
  if (memberId) filters.participantUserId = Number(memberId)
  if (me.role === ROLE_SUPER_ADMIN) throw new ApiError('无权限：无权查看任务', 403)

  if (me.role === ROLE_GROUP_ADMIN) {
    if (scope === 'group') {
      filters.groupId = await groupAdminGroupId(me) // 组内全部任务（只读）
    } else {
      filters.creatorId = me.id // 我创建的任务
    }
  } else if (me.role === ROLE_MENTOR) {
    if (scope === 'mine-participated') {
      const gid = await memberGroupId(me)
      if (!gid) return emptyListResult()
      filters.groupId = gid
      filters.participantUserId = me.id
    } else if (scope === 'my-students') {
      const gid = await memberGroupId(me)
      if (!gid) return emptyListResult()
      filters.groupId = gid
      filters.mentorId = me.id
    } else {
      filters.creatorId = me.id // 我创建的任务
    }
  } else {
    // 学生：只能看自己参与的任务
    const gid = await memberGroupId(me)
    if (!gid) return emptyListResult()
    filters.groupId = gid
    filters.participantUserId = me.id
  }

  const result = await taskRepository.pagedList(filters)
  // 附带当前用户所在课题组（前端未入组空态判定：groupId 为 null/undefined 即未入组）
  let resultGroupId = null
  if (me.role === ROLE_GROUP_ADMIN) {
    try {
      resultGroupId = await groupAdminGroupId(me)
    } catch (e) {
      resultGroupId = null
    }
  } else {
    resultGroupId = await memberGroupId(me)
  }
  return { ...result, groupId: resultGroupId, list: result.list.map(toTaskDto) }
}

/**
 * 任务详情（含参与人；超管走总览，不调用本接口）
 * @param {number} id
 */
async function getTaskDetail(id) {
  const me = await currentUser()
  const task = await taskRepository.findById(Number(id))
  if (!task) throw new ApiError('任务不存在', 404)
  await assertTaskVisible(me, task)

  const dto = toTaskDto(task)
  const participants = await taskParticipantRepository.listByTask(task.id)
  dto.participants = participants.map((p) => ({
    userId: Number(p.user_id),
    username: p.username || '',
    realName: p.real_name || '',
    role: p.role || '',
    userStatus: Number(p.user_status),
    finishTime: p.finish_time || null
  }))
  return dto
}

/**
 * 任务动态分页（倒序；查看前校验可见性）
 * @param {number} id
 * @param {{ page?: number }} param
 */
async function listDynamics(id, { page } = {}) {
  const me = await currentUser()
  const task = await taskRepository.findById(Number(id))
  if (!task) throw new ApiError('任务不存在', 404)
  await assertTaskVisible(me, task)
  const result = await taskDynamicRepository.listByTask(task.id, { page })
  return {
    ...result,
    list: result.list.map((d) => ({
      id: Number(d.id),
      action: d.action,
      operatorId: Number(d.operator_id),
      operatorName: displayName(d, '用户#'),
      fromStatus: d.from_status == null ? null : Number(d.from_status),
      toStatus: d.to_status == null ? null : Number(d.to_status),
      detail: d.detail || '',
      createdAt: d.created_at
    }))
  }
}

// ===== 编辑 / 删除 / 恢复 =====

/**
 * 编辑任务（仅创建者；标题/描述/优先级/开始/截止时间）
 * @param {number} id
 * @param {{ title?, description?, priority?, startTime?, dueTime? }} data
 */
async function updateTask(id, data = {}) {
  const me = await currentUser()
  const task = await taskRepository.findById(Number(id))
  if (!task) throw new ApiError('任务不存在', 404)
  if (Number(task.creator_id) !== me.id) throw new ApiError('只有创建者可以编辑任务', 403)
  await groupService.assertGroupWritable(task.group_id)

  const patch = {}
  if (data.title !== undefined) patch.title = assertTitle(data.title)
  if (data.description !== undefined) patch.description = assertDescription(data.description)
  if (data.priority !== undefined) patch.priority = assertPriority(data.priority)
  if (data.startTime !== undefined) patch.start_time = assertDateTime(data.startTime, '开始时间')
  if (data.dueTime !== undefined) patch.due_time = assertDateTime(data.dueTime, '截止时间')
  if (Object.keys(patch).length === 0) throw new ApiError('没有需要修改的内容', 400)

  const start = patch.start_time !== undefined ? patch.start_time : task.start_time
  const due = patch.due_time !== undefined ? patch.due_time : task.due_time
  if (start && due && due < start) throw new ApiError('截止时间不能早于开始时间', 400)
  if (due && me.role !== ROLE_GROUP_ADMIN && due < nowSql()) throw new ApiError('截止时间不能早于当前时间', 400)

  const affected = await taskRepository.updateWithVersion(task.id, patch, task.version)
  if (affected === 0) throw new ApiError('任务已被他人更新，请刷新', 400)
  await taskDynamicRepository.create(task.id, me.id, ACT.update, { detail: '编辑任务信息' })
  return getTaskDetail(task.id)
}

/**
 * 软删除任务（仅创建者；动态保留，任务恢复后可继续使用）
 * @param {number} id
 */
async function deleteTask(id) {
  const me = await currentUser()
  const task = await taskRepository.findById(Number(id))
  if (!task) throw new ApiError('任务不存在', 404)
  if (Number(task.creator_id) !== me.id) throw new ApiError('只有创建者可以删除任务', 403)

  await runTransaction(async () => {
    await taskRepository.softDelete(task.id)
    await taskDynamicRepository.create(task.id, me.id, ACT.delete, {
      fromStatus: task.status,
      detail: '删除任务'
    })
  })
  // 关联通知软删（保留历史）
  await notificationService.softDeleteByBiz('task', task.id)
  return { deleted: true }
}

/**
 * 恢复已删除任务（仅创建者）
 * @param {number} id
 */
async function restoreTask(id) {
  const me = await currentUser()
  const task = await taskRepository.findDeletedById(Number(id))
  if (!task) throw new ApiError('任务不存在或未删除', 404)
  if (Number(task.creator_id) !== me.id) throw new ApiError('只有创建者可以恢复任务', 403)
  await groupService.assertGroupWritable(task.group_id)

  await taskRepository.restore(task.id)
  await taskDynamicRepository.create(task.id, me.id, ACT.restore, {
    toStatus: task.status,
    detail: '恢复任务'
  })
  return getTaskDetail(task.id)
}

// ===== 参与人管理 =====

/**
 * 新增参与人（仅创建者；范围同创建时的可选范围）
 * @param {number} id
 * @param {{ participantIds:number[] }} data
 */
async function addParticipants(id, data = {}) {
  const me = await currentUser()
  const task = await taskRepository.findById(Number(id))
  if (!task) throw new ApiError('任务不存在', 404)
  if (Number(task.creator_id) !== me.id) throw new ApiError('只有创建者可以分配参与人', 403)
  await groupService.assertGroupWritable(task.group_id)

  const ids = await assertParticipants(me, task.group_id, data.participantIds)
  const existing = new Set(await taskParticipantRepository.listUserIdsByTask(task.id))
  const newIds = ids.filter((uid) => !existing.has(uid))
  if (newIds.length === 0) throw new ApiError('所选用户均已在任务中', 400)

  await runTransaction(async () => {
    await taskParticipantRepository.createMany(task.id, newIds)
    await taskRepository.bumpVersion(task.id, task.version)
    await taskDynamicRepository.create(task.id, me.id, ACT.assign, {
      detail: `新增参与人 ${newIds.length} 人`
    })
  })

  await notificationService.createForUsers({
    recipients: newIds,
    typeKey: 'task_assigned',
    title: task.title,
    summary: '你被添加为任务参与人',
    bizType: 'task',
    bizId: task.id,
    groupId: task.group_id
  })
  return getTaskDetail(task.id)
}

/**
 * 移除参与人（仅创建者）
 * @param {number} id
 * @param {{ userId:number }} data
 */
async function removeParticipant(id, data = {}) {
  const me = await currentUser()
  const task = await taskRepository.findById(Number(id))
  if (!task) throw new ApiError('任务不存在', 404)
  if (Number(task.creator_id) !== me.id) throw new ApiError('只有创建者可以移除参与人', 403)
  await groupService.assertGroupWritable(task.group_id)

  const userId = Number(data.userId)
  if (!Number.isInteger(userId) || userId <= 0) throw new ApiError('用户参数不合法', 400)
  const existed = await taskParticipantRepository.findByTaskAndUser(task.id, userId)
  if (!existed) throw new ApiError('该用户不在任务参与人中', 400)

  await runTransaction(async () => {
    await taskParticipantRepository.deleteByTaskAndUsers(task.id, [userId])
    await taskRepository.bumpVersion(task.id, task.version)
    await taskDynamicRepository.create(task.id, me.id, ACT.remove, { detail: `移除参与人 1 人` })
  })
  return getTaskDetail(task.id)
}

/**
 * 参与人候选列表（创建/分配任务的选人接口，仅组管/导师）
 */
async function listParticipantOptions() {
  const me = await currentUser()
  if (me.role === ROLE_GROUP_ADMIN) {
    const gid = await groupAdminGroupId(me)
    const rows = await userRepository.listEnabledAudienceByGroup(gid)
    return rows.map((r) => ({
      id: Number(r.id),
      username: r.username,
      realName: r.real_name || '',
      role: r.role
    }))
  }
  if (me.role === ROLE_MENTOR) {
    const rows = await userRepository.listEnabledStudentsByMentor(me.id)
    return rows.map((r) => ({
      id: Number(r.id),
      username: r.username,
      realName: r.real_name || '',
      role: ROLE_STUDENT
    }))
  }
  throw new ApiError('无权限：无权查看参与人列表', 403)
}

// ===== 进展 / 完成 / 验收 / 状态流转 =====

/**
 * 提交任务进展（仅参与人；待办状态下提交会自动进入进行中）
 * @param {number} id
 * @param {{ note:string }} data
 */
async function submitProgress(id, data = {}) {
  const me = await currentUser()
  const task = await taskRepository.findById(Number(id))
  if (!task) throw new ApiError('任务不存在', 404)
  const participant = await taskParticipantRepository.findByTaskAndUser(task.id, me.id)
  if (!participant) throw new ApiError('只有参与人可以提交进展', 403)

  // 进度记录必填（不再提交进度数字）
  const note = String(data.note || '').trim()
  if (!note) throw new ApiError('请填写进度记录', 400)
  const noteSafe = note.slice(0, NOTE_MAX)
  if (task.status !== TASK_STATUS_TODO && task.status !== TASK_STATUS_DOING) {
    throw new ApiError('当前状态不允许提交进展', 400)
  }

  const patch = {}
  // 待办 → 进行中（提交进展视为开始任务）
  if (task.status === TASK_STATUS_TODO) patch.status = TASK_STATUS_DOING

  if (Object.keys(patch).length > 0) {
    const affected = await taskRepository.updateWithVersion(task.id, patch, task.version)
    if (affected === 0) throw new ApiError('任务已被他人更新，请刷新', 400)
  }

  await taskDynamicRepository.create(task.id, me.id, ACT.progress, {
    detail: `提交进展：${noteSafe}`
  })
  await notificationService.createForUsers({
    recipients: [task.creator_id],
    typeKey: 'task_progress',
    title: task.title,
    summary: `${me.real_name || me.username || `用户#${me.id}`} 提交进展：${noteSafe}`,
    bizType: 'task',
    bizId: task.id,
    groupId: task.group_id
  })
  return getTaskDetail(task.id)
}

/**
 * 完成任务（仅参与人；一律进入待验收，由创建者验收）
 * @param {number} id
 */
async function completeTask(id) {
  const me = await currentUser()
  const task = await taskRepository.findById(Number(id))
  if (!task) throw new ApiError('任务不存在', 404)
  const participant = await taskParticipantRepository.findByTaskAndUser(task.id, me.id)
  if (!participant) throw new ApiError('只有参与人可以完成任务', 403)
  if (task.status !== TASK_STATUS_DOING) throw new ApiError('当前状态不允许该操作', 400)

  const affected = await taskRepository.updateWithVersion(
    task.id,
    { status: TASK_STATUS_REVIEW, progress: PROGRESS_MAX },
    task.version
  )
  if (affected === 0) throw new ApiError('任务已被他人更新，请刷新', 400)
  await taskDynamicRepository.create(task.id, me.id, ACT.statusChange, {
    fromStatus: TASK_STATUS_DOING,
    toStatus: TASK_STATUS_REVIEW,
    detail: `提交完成，等待验收`
  })
  await notificationService.createForUsers({
    recipients: [task.creator_id],
    typeKey: 'task_status',
    title: task.title,
    summary: '任务已提交完成，等待验收',
    bizType: 'task',
    bizId: task.id,
    groupId: task.group_id
  })
  return getTaskDetail(task.id)
}


/**
 * 验收（仅创建者=负责人）：通过 → 已完成；驳回 → 回到进行中
 * @param {number} id
 * @param {{ pass:boolean, note?:string }} data
 */
async function verifyTask(id, data = {}) {
  const me = await currentUser()
  const task = await taskRepository.findById(Number(id))
  if (!task) throw new ApiError('任务不存在', 404)
  if (Number(task.creator_id) !== me.id) throw new ApiError('只有创建者可以验收任务', 403)
  if (task.status !== TASK_STATUS_REVIEW) throw new ApiError('当前状态不允许该操作', 400)

  const pass = data.pass === true
  const note = data.note === undefined || data.note === null ? '' : String(data.note).slice(0, NOTE_MAX)
  const recipients = await taskParticipantRepository.listUserIdsByTask(task.id)

  if (pass) {
    await runTransaction(async () => {
      const affected = await taskRepository.updateWithVersion(
        task.id,
        { status: TASK_STATUS_DONE, finish_time: nowSql(), progress: PROGRESS_MAX },
        task.version
      )
      if (affected === 0) throw new ApiError('任务已被他人更新，请刷新', 400)
      await taskParticipantRepository.updateFinishByTask(task.id)
      await taskDynamicRepository.create(task.id, me.id, ACT.verifyApprove, {
        fromStatus: TASK_STATUS_REVIEW,
        toStatus: TASK_STATUS_DONE,
        detail: `验收通过${note ? `（${note}）` : ''}`
      })
    })
    await notificationService.createForUsers({
      recipients,
      typeKey: 'task_approved',
      title: task.title,
      summary: '任务验收通过',
      bizType: 'task',
      bizId: task.id,
      groupId: task.group_id
    })
  } else {
    const affected = await taskRepository.updateWithVersion(
      task.id,
      { status: TASK_STATUS_DOING },
      task.version
    )
    if (affected === 0) throw new ApiError('任务已被他人更新，请刷新', 400)
    await taskDynamicRepository.create(task.id, me.id, ACT.verifyReject, {
      fromStatus: TASK_STATUS_REVIEW,
      toStatus: TASK_STATUS_DOING,
      detail: `验收驳回${note ? `：${note}` : ''}`
    })
    await notificationService.createForUsers({
      recipients,
      typeKey: 'task_rejected',
      title: task.title,
      summary: note ? `任务验收驳回：${note}` : '任务验收驳回，请继续处理',
      bizType: 'task',
      bizId: task.id,
      groupId: task.group_id
    })
  }
  return getTaskDetail(task.id)
}

/**
 * 取消任务（仅创建者；待办/进行中可取消）
 * @param {number} id
 */
async function cancelTask(id) {
  const me = await currentUser()
  const task = await taskRepository.findById(Number(id))
  if (!task) throw new ApiError('任务不存在', 404)
  if (Number(task.creator_id) !== me.id) throw new ApiError('只有创建者可以取消任务', 403)
  if (task.status !== TASK_STATUS_TODO && task.status !== TASK_STATUS_DOING) {
    throw new ApiError('当前状态不允许该操作', 400)
  }

  const affected = await taskRepository.updateWithVersion(
    task.id,
    { status: TASK_STATUS_CANCELED },
    task.version
  )
  if (affected === 0) throw new ApiError('任务已被他人更新，请刷新', 400)
  await taskDynamicRepository.create(task.id, me.id, ACT.statusChange, {
    fromStatus: task.status,
    toStatus: TASK_STATUS_CANCELED,
    detail: '取消任务'
  })
  await notificationService.createForUsers({
    recipients: await taskParticipantRepository.listUserIdsByTask(task.id),
    typeKey: 'task_status',
    title: task.title,
    summary: '任务已取消',
    bizType: 'task',
    bizId: task.id,
    groupId: task.group_id
  })
  return getTaskDetail(task.id)
}

/**
 * 重新打开已完成任务（仅创建者；回到进行中）
 * @param {number} id
 */
async function reopenTask(id) {
  const me = await currentUser()
  const task = await taskRepository.findById(Number(id))
  if (!task) throw new ApiError('任务不存在', 404)
  if (Number(task.creator_id) !== me.id) throw new ApiError('只有创建者可以重新打开任务', 403)
  if (task.status !== TASK_STATUS_DONE) throw new ApiError('当前状态不允许该操作', 400)

  const affected = await taskRepository.updateWithVersion(
    task.id,
    { status: TASK_STATUS_DOING, finish_time: null },
    task.version
  )
  if (affected === 0) throw new ApiError('任务已被他人更新，请刷新', 400)
  await taskDynamicRepository.create(task.id, me.id, ACT.statusChange, {
    fromStatus: TASK_STATUS_DONE,
    toStatus: TASK_STATUS_DOING,
    detail: '重新打开任务'
  })
  await notificationService.createForUsers({
    recipients: await taskParticipantRepository.listUserIdsByTask(task.id),
    typeKey: 'task_status',
    title: task.title,
    summary: '任务已重新打开为进行中',
    bizType: 'task',
    bizId: task.id,
    groupId: task.group_id
  })
  return getTaskDetail(task.id)
}

// ===== 统计 =====

// 范围统计（同一口径）：状态分布 + 完成率 + 逾期 + 即将到期
async function buildScopeStats(filters = {}) {
  const dist = await taskRepository.statusDistribution(filters)
  const total = Object.values(dist).reduce((a, b) => a + b, 0)
  const done = dist[TASK_STATUS_DONE] || 0
  return {
    total,
    todo: dist[TASK_STATUS_TODO] || 0,
    doing: dist[TASK_STATUS_DOING] || 0,
    pendingReview: dist[TASK_STATUS_REVIEW] || 0,
    done,
    canceled: dist[TASK_STATUS_CANCELED] || 0,
    overdue: await taskRepository.countOverdue(filters),
    dueSoon: await taskRepository.countDueSoon(await configNumber('task.due_soon_hours', 24), filters),
    completionRate: total ? Math.round((done / total) * 10000) / 100 : 0
  }
}

/**
 * 统计看板（按角色返回不同口径）
 *   - 组管：本组全部 + 我创建的
 *   - 导师：我创建的 / 我参与的 / 名下学生完成情况
 *   - 学生：我的任务（含即将到期/逾期）
 */
async function getTaskStats() {
  const me = await currentUser()
  if (me.role === ROLE_SUPER_ADMIN) throw new ApiError('无权限：无权查看统计', 403)

  if (me.role === ROLE_GROUP_ADMIN) {
    const gid = await groupAdminGroupId(me)
    const group = await buildScopeStats({ groupId: gid })
    const mineCreated = await buildScopeStats({ creatorId: me.id })
    const memberCount = await userRepository.countAudienceByGroup(gid)
    // 按成员完成率（启用的导师/学生逐个统计参与任务数与完成数）
    const members = await userRepository.listEnabledAudienceByGroup(gid)
    const memberStats = []
    for (const m of members) {
      const mf = { groupId: gid, participantUserId: Number(m.id) }
      const dist = await taskRepository.statusDistribution(mf)
      const total = Object.values(dist).reduce((a, b) => a + b, 0)
      memberStats.push({
        userId: Number(m.id),
        realName: m.real_name || m.username,
        role: m.role,
        total,
        done: dist[TASK_STATUS_DONE] || 0,
        completionRate: total ? Math.round(((dist[TASK_STATUS_DONE] || 0) / total) * 10000) / 100 : 0
      })
    }
    memberStats.sort((a, b) => b.total - a.total || a.userId - b.userId)
    return {
      group,
      mineCreated: { ...mineCreated, count: mineCreated.total },
      memberCount,
      avgPerMember: memberCount ? Math.round((group.total / memberCount) * 100) / 100 : 0,
      memberStats
    }
  }

  if (me.role === ROLE_MENTOR) {
    const gid = await memberGroupId(me)
    const mineCreated = await buildScopeStats({ creatorId: me.id })
    const mineParticipated = gid ? await buildScopeStats({ groupId: gid, participantUserId: me.id }) : null
    const students = await userRepository.listEnabledStudentsByMentor(me.id)
    const studentStats = []
    for (const s of students) {
      if (!gid) break
      const sf = { groupId: gid, participantUserId: Number(s.id) }
      studentStats.push({
        userId: Number(s.id),
        realName: s.real_name || s.username,
        total: await taskRepository.countByFilter(sf),
        done: (await taskRepository.statusDistribution(sf))[TASK_STATUS_DONE] || 0,
        overdue: await taskRepository.countOverdue(sf)
      })
    }
    return {
      mineCreated,
      mineParticipated: mineParticipated || { total: 0, done: 0, overdue: 0, dueSoon: 0, completionRate: 0 },
      students: {
        total: studentStats.reduce((a, s) => a + s.total, 0),
        overdue: studentStats.reduce((a, s) => a + s.overdue, 0),
        list: studentStats
      }
    }
  }

  // 学生：我的任务
  const gid = await memberGroupId(me)
  if (!gid) {
    return { total: 0, done: 0, overdue: 0, dueSoon: 0, pendingReview: 0, completionRate: 0 }
  }
  return buildScopeStats({ groupId: gid, participantUserId: me.id })
}

/**
 * 工作台卡片摘要（每角色紧凑计数，一次返回）
 */
async function getTaskSummary() {
  const me = await currentUser()
  if (me.role === ROLE_SUPER_ADMIN) {
    const dist = await taskRepository.statusDistribution({})
    return {
      total: Object.values(dist).reduce((a, b) => a + b, 0),
      overdue: await taskRepository.countOverdue({}),
      pendingReview: dist[TASK_STATUS_REVIEW] || 0
    }
  }
  if (me.role === ROLE_GROUP_ADMIN) {
    const gid = await groupAdminGroupId(me)
    const mineCreated = await buildScopeStats({ creatorId: me.id })
    const group = await buildScopeStats({ groupId: gid })
    return {
      mineCreatedPendingReview: mineCreated.pendingReview,
      groupTotal: group.total,
      groupOverdue: group.overdue,
      groupPendingReview: group.pendingReview,
      groupCompletionRate: group.completionRate
    }
  }
  if (me.role === ROLE_MENTOR) {
    const gid = await memberGroupId(me)
    const mineCreated = await buildScopeStats({ creatorId: me.id })
    const mineParticipated = gid
      ? await buildScopeStats({ groupId: gid, participantUserId: me.id })
      : { total: 0, pendingReview: 0 }
    const studentOverdue = gid
      ? await taskRepository.countOverdue({ groupId: gid, mentorId: me.id })
      : 0
    return {
      mineCreatedTotal: mineCreated.total,
      mineCreatedPendingReview: mineCreated.pendingReview,
      mineParticipatedTotal: mineParticipated.total,
      mineParticipatedOverdue: mineParticipated.overdue || 0,
      studentOverdue
    }
  }
  // 学生
  const gid = await memberGroupId(me)
  if (!gid) {
    return { total: 0, doing: 0, done: 0, overdue: 0, dueSoon: 0 }
  }
  const mine = await buildScopeStats({ groupId: gid, participantUserId: me.id })
  return {
    total: mine.total,
    doing: mine.doing,
    done: mine.done,
    overdue: mine.overdue,
    dueSoon: mine.dueSoon
  }
}

module.exports = {
  createTask,
  listTasks,
  getTaskDetail,
  listDynamics,
  updateTask,
  deleteTask,
  restoreTask,
  addParticipants,
  removeParticipant,
  listParticipantOptions,
  submitProgress,
  completeTask,
  verifyTask,
  cancelTask,
  reopenTask,
  getTaskStats,
  getTaskSummary
}
