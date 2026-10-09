/**
 * 待办服务（Service Layer）—— 个人轻量待办
 *
 * 权限模型（唯一可信来源：主进程会话 authService.getCurrentUser + 实时查库）：
 *   - 学生 / 导师：新建/编辑/完成/删除自己的待办；可将可见范围内的
 *     任务 / 组会 / 周报（仅学生）/ 公告 一键转为待办（单向，原数据不动）；
 *   - 组管：只读本组待办总览（调写操作一律拒绝）；
 *   - 超管：只读全平台待办总览（可按组筛选，调写操作一律拒绝）。
 *
 * 数据与归属人挂钩（owner_id 为归属核心，group_id 仅按组筛选冗余）：
 *   - 学生/导师换组 → 待办跟人走；
 *   - 用户删除 → softDeleteByUser 级联软删待办（用户删除事务内调用）。
 *
 * 转换单向：source_type + source_id 仅复制来源信息，不修改原模块数据；
 * 唯一约束 uk_owner_source 防止同一条来源被同一人重复转换。
 */
const todoRepository = require('../db/repositories/todoRepository')
const userRepository = require('../db/repositories/userRepository')
const groupRepository = require('../db/repositories/groupRepository')
const taskRepository = require('../db/repositories/taskRepository')
const taskParticipantRepository = require('../db/repositories/taskParticipantRepository')
const groupMeetingRepository = require('../db/repositories/groupMeetingRepository')
const groupMeetingParticipantRepository = require('../db/repositories/groupMeetingParticipantRepository')
const reportRepository = require('../db/repositories/reportRepository')
const groupNoticeRepository = require('../db/repositories/groupNoticeRepository')
const authService = require('./authService')
const ApiError = require('./apiError')
const { ROLE_STUDENT, ROLE_MENTOR, ROLE_GROUP_ADMIN, ROLE_SUPER_ADMIN } = require('../../shared/constants')

const PRIORITIES = ['low', 'medium', 'high']
const REMINDS = ['none', '1h', '1d']
const SOURCE_TYPES = ['task', 'meeting', 'report', 'notice']
const SOURCE_LABELS = { task: '任务', meeting: '组会', report: '周报', notice: '公告' }
// 任务优先级（1低 2中 3高 4紧急）→ 待办紧急程度
const TASK_PRIORITY_MAP = { 1: 'low', 2: 'medium', 3: 'high', 4: 'high' }

// 当前登录用户（401 兜底）
async function currentUser() {
  const me = await authService.getCurrentUser()
  if (!me) throw new ApiError('未登录，请重新登录', 401)
  return me
}

// 用户当前有效课题组（未入组返回 null；返回完整组行含 name）。
// 绑定机制按角色分流：组管绑定存于 groups.admin_user_id；导师/学生存于 users.group_id。
async function groupOf(userId) {
  try {
    const u = await userRepository.findById(Number(userId))
    if (!u) return null
    if (u.role === ROLE_GROUP_ADMIN) {
      return await groupRepository.findByAdminUserId(u.id)
    }
    const ref = await userRepository.findActiveGroupOfUser(u.id)
    if (!ref) return null
    return await groupRepository.findById(ref.group_id)
  } catch (e) {
    return null
  }
}

// 日期时间格式化：MySQL DATETIME 返回 Date 对象，统一转 'YYYY-MM-DD HH:mm:ss'
function fmtDateTime(v) {
  if (v == null || v === '') return null
  const d = v instanceof Date ? v : new Date(v)
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 19)
  const pad2 = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

// 周报截止时间：week_key（如 2026-40）对应 ISO 周的周一 00:00:00
function mondayOfWeek(weekKey) {
  const m = String(weekKey || '').match(/^(\d{4})-(\d{1,2})$/)
  if (!m) return null
  const year = Number(m[1])
  const week = Number(m[2])
  const jan4 = new Date(year, 0, 4)
  const day = jan4.getDay() || 7
  const firstMonday = jan4.getTime() - (day - 1) * 86400000
  return new Date(firstMonday + (week - 1) * 7 * 86400000)
}

// 待办行转 DTO
function toDto(row) {
  if (!row) return null
  return {
    id: Number(row.id),
    ownerId: Number(row.owner_id),
    groupId: Number(row.group_id),
    title: row.title,
    priority: row.priority,
    dueTime: fmtDateTime(row.due_time),
    allDay: Number(row.all_day) === 1,
    note: row.note || '',
    tag: row.tag || '',
    remind: row.remind,
    sourceType: row.source_type || '',
    sourceLabel: SOURCE_LABELS[row.source_type] || '',
    sourceId: row.source_id == null ? null : Number(row.source_id),
    status: row.status,
    doneAt: fmtDateTime(row.done_at),
    createdAt: row.created_at,
    owner: {
      id: Number(row.owner_id),
      realName: row.real_name || '',
      username: row.username || '',
      userNo: row.user_no || ''
    }
  }
}

// ===== 权限断言 =====

// 断言当前用户是学生或导师（转换/写操作的开放角色；组管/超管只读，不参与使用）
function assertPersonalRole(me) {
  if (me.role !== ROLE_STUDENT && me.role !== ROLE_MENTOR) {
    throw new ApiError('无权限：待办仅对导师和学生开放', 403)
  }
}

// 断言待办归属人是当前用户（普通写操作；组管/超管调写操作一律拒绝）
async function assertOwner(id, me) {
  const todo = await todoRepository.findByIdWithOwner(Number(id))
  if (!todo) throw new ApiError('待办不存在', 404)
  if (Number(todo.owner_id) !== me.id) throw new ApiError('无权限：只能操作自己的待办', 403)
  return todo
}

// 总览范围解析：组管=本组；超管=全局或指定组；学生/导师无总览权限
async function resolveOverviewScope(me, groupId) {
  if (me.role === ROLE_GROUP_ADMIN) {
    const g = await groupOf(me.id)
    if (!g) throw new ApiError('无权限：需已绑定课题组', 403)
    return { groupId: Number(g.id), label: g.name, groupName: g.name }
  }
  if (me.role === ROLE_SUPER_ADMIN) {
    if (groupId) {
      const g = await groupRepository.findById(Number(groupId))
      if (!g) throw new ApiError('课题组不存在', 404)
      return { groupId: Number(g.id), label: g.name, groupName: g.name }
    }
    return { groupId: null, label: '全部课题组', groupName: '全部课题组' }
  }
  throw new ApiError('无权限：导师和学生无待办总览', 403)
}

// ===== 来源可见性校验（转换前） =====

// 校验并读取来源记录，返回预填字段（title/dueTime/priority/note）
async function assertSourceVisible(me, sourceType, sourceId) {
  assertPersonalRole(me)
  const group = await groupOf(me.id)
  if (!group) throw new ApiError('请先加入课题组后再转换待办', 400)

  if (sourceType === 'task') {
    const t = await taskRepository.findById(Number(sourceId))
    if (!t) throw new ApiError('任务不存在或已删除', 404)
    // 可见：任务创建者本人，或任务参与人（task_participant）
    const participant = await taskParticipantRepository.findByTaskAndUser(Number(t.id), me.id)
    if (Number(t.creator_id) !== me.id && !participant) throw new ApiError('无权限：只能转换参与的任务', 403)
    return {
      title: t.title,
      dueTime: t.due_time,
      priority: TASK_PRIORITY_MAP[Number(t.priority)] || 'medium',
      note: t.description || ''
    }
  }

  if (sourceType === 'meeting') {
    const m = await groupMeetingRepository.findById(Number(sourceId))
    if (!m) throw new ApiError('组会不存在或已删除', 404)
    const meetingIds = await groupMeetingParticipantRepository.listMeetingIdsByUser(me.id)
    if (!meetingIds.includes(Number(m.id))) {
      throw new ApiError('无权限：只能转换参与的组会', 403)
    }
    const noteParts = []
    if (m.location) noteParts.push(`地点：${m.location}`)
    if (m.agenda) noteParts.push(`议题：${m.agenda}`)
    return {
      title: m.title,
      dueTime: m.meeting_time,
      priority: 'medium',
      note: noteParts.join('\n')
    }
  }

  if (sourceType === 'report') {
    if (me.role !== ROLE_STUDENT) throw new ApiError('无权限：周报仅学生可转为待办', 403)
    const r = await reportRepository.findById(Number(sourceId))
    if (!r) throw new ApiError('周报不存在或已删除', 404)
    if (Number(r.user_id) !== me.id) throw new ApiError('无权限：只能转换自己的周报', 403)
    return {
      title: r.title ? r.title : `第${r.week_key}周周报`,
      dueTime: mondayOfWeek(r.week_key),
      priority: 'medium',
      note: String(r.content || '').slice(0, 500)
    }
  }

  if (sourceType === 'notice') {
    const n = await groupNoticeRepository.findById(Number(sourceId))
    if (!n) throw new ApiError('公告不存在或已删除', 404)
    if (Number(n.group_id) !== Number(group.id)) throw new ApiError('无权限：只能转换本组公告', 403)
    return {
      title: n.title,
      dueTime: n.publish_time,
      priority: 'medium',
      note: String(n.content || '').slice(0, 500)
    }
  }

  throw new ApiError('来源类型不合法', 400)
}

// ===== 列表 / 统计 =====

// 我的待办分页列表（学生/导师只看自己的）
async function listMine({ status, priority, sourceType, keyword, page, pageSize, sortField, sortOrder }, viewer) {
  const me = await currentUser()
  assertPersonalRole(me)
  const { list, total, page: cur, pageSize: size } = await todoRepository.paged({
    ownerId: me.id,
    status,
    priority,
    sourceType,
    keyword,
    page,
    pageSize,
    sortField,
    sortOrder
  })
  return {
    label: '我的待办',
    groupName: null,
    list: list.map(toDto),
    total,
    page: cur,
    pageSize: size,
    totalPages: total ? Math.ceil(total / size) : 0
  }
}

// 我的待办统计（总数 / 未完成 / 已完成 / 逾期）
async function summaryMine(viewer) {
  const me = await currentUser()
  assertPersonalRole(me)
  return todoRepository.summary({ ownerId: me.id })
}

// 日历取数：某时间范围内我的待办（学生/导师本人）
async function calendarMine({ start, end }, viewer) {
  const me = await currentUser()
  assertPersonalRole(me)
  if (!start || !end) throw new ApiError('请提供时间范围', 400)
  const rows = await todoRepository.listByOwnerRange(me.id, start, end)
  return rows.map(toDto)
}

// ===== 我的待办写操作 =====

// 新建/编辑待办（仅本人；已完成不可编辑）
async function saveTodo({ id, title, priority, dueTime, allDay, note, tag, remind }, viewer) {
  const me = await currentUser()
  assertPersonalRole(me)
  const name = String(title == null ? '' : title).trim().slice(0, 200)
  if (!name) throw new ApiError('请输入待办名称', 400)
  const p = String(priority || 'medium')
  if (!PRIORITIES.includes(p)) throw new ApiError('紧急程度不合法', 400)
  const r = String(remind || 'none')
  if (!REMINDS.includes(r)) throw new ApiError('提醒设置不合法', 400)
  const tagStr = String(tag == null ? '' : tag).trim().slice(0, 50) || null
  const noteStr = String(note == null ? '' : note).slice(0, 5000) || null
  const allDayFlag = allDay ? 1 : 0
  const due = dueTime ? fmtDateTime(dueTime) : null

  if (id) {
    const existing = await assertOwner(Number(id), me)
    if (existing.status === 'done') throw new ApiError('已完成的待办不可编辑，请先取消完成', 400)
    await todoRepository.update(Number(id), {
      title: name,
      priority: p,
      due_time: due,
      all_day: allDayFlag,
      note: noteStr,
      tag: tagStr,
      remind: r,
      source_type: existing.source_type,
      source_id: existing.source_id
    })
    return { id: Number(id), created: false }
  }

  const group = await groupOf(me.id)
  if (!group) throw new ApiError('请先加入课题组', 400)
  const newId = await todoRepository.create({
    owner_id: me.id,
    group_id: Number(group.id),
    title: name,
    priority: p,
    due_time: due,
    all_day: allDayFlag,
    note: noteStr,
    tag: tagStr,
    remind: r,
    source_type: null,
    source_id: null,
    status: 'pending'
  })
  return { id: newId, created: true }
}

// 来源判重（转换弹窗打开时探测）：返回 { already, id, todo } 或 { already: false }
async function checkSource({ sourceType, sourceId }, viewer) {
  const me = await currentUser()
  assertPersonalRole(me)
  const type = String(sourceType || '')
  if (!SOURCE_TYPES.includes(type)) throw new ApiError('来源类型不合法', 400)
  const srcId = Number(sourceId)
  if (!srcId) throw new ApiError('来源记录不存在', 400)
  const existed = await todoRepository.findBySource(me.id, type, srcId)
  if (existed) return { already: true, id: Number(existed.id), todo: toDto(existed) }
  return { already: false }
}

// 来源转待办：校验可见性 + 判重 + 预填创建
async function createFromSource({ sourceType, sourceId, title, dueTime, allDay, priority, note, tag, remind }, viewer) {
  const me = await currentUser()
  assertPersonalRole(me)
  const type = String(sourceType || '')
  if (!SOURCE_TYPES.includes(type)) throw new ApiError('来源类型不合法', 400)
  const srcId = Number(sourceId)
  if (!srcId) throw new ApiError('来源记录不存在', 400)

  // 判重（唯一索引兜底，此处先查用于友好提示）
  const existed = await todoRepository.findBySource(me.id, type, srcId)
  if (existed) return { already: true, id: Number(existed.id), todo: toDto(existed) }

  // 来源可见性 + 预填字段（用户可改，服务端仅校验可见性，预填值以传入为准）
  await assertSourceVisible(me, type, srcId)
  const name = String(title == null ? '' : title).trim().slice(0, 200)
  if (!name) throw new ApiError('请输入待办名称', 400)
  const p = String(priority || 'medium')
  if (!PRIORITIES.includes(p)) throw new ApiError('紧急程度不合法', 400)
  const r = String(remind || 'none')
  if (!REMINDS.includes(r)) throw new ApiError('提醒设置不合法', 400)
  const group = await groupOf(me.id)
  if (!group) throw new ApiError('请先加入课题组', 400)

  const newId = await todoRepository.create({
    owner_id: me.id,
    group_id: Number(group.id),
    title: name,
    priority: p,
    due_time: dueTime ? fmtDateTime(dueTime) : null,
    all_day: allDay ? 1 : 0,
    note: String(note == null ? '' : note).slice(0, 5000) || null,
    tag: String(tag == null ? '' : tag).trim().slice(0, 50) || null,
    remind: r,
    source_type: type,
    source_id: srcId,
    status: 'pending'
  })
  return { already: false, id: Number(newId), todo: null }
}

// 完成 / 取消完成（仅本人）
async function toggleDone(id, viewer) {
  const me = await currentUser()
  assertPersonalRole(me)
  const existing = await assertOwner(Number(id), me)
  const next = existing.status === 'done' ? 'pending' : 'done'
  await todoRepository.updateStatus(Number(id), me.id, next)
  return { id: Number(id), status: next }
}

// 删除待办（仅本人）：软删
async function removeTodo(id, viewer) {
  const me = await currentUser()
  assertPersonalRole(me)
  await assertOwner(Number(id), me)
  await todoRepository.delete(Number(id))
  return { id: Number(id) }
}

// ===== 超管 / 组管只读总览 =====

// 总览分页列表：超管=全平台或按组；组管=本组；只读
async function overview({ groupId, ownerId, status, priority, sourceType, keyword, dueFrom, dueTo, page, pageSize, sortField, sortOrder }, viewer) {
  const me = await currentUser()
  const scope = await resolveOverviewScope(me, groupId)
  const { list, total, page: cur, pageSize: size } = await todoRepository.paged({
    groupId: scope.groupId,
    filterOwnerId: ownerId || null,
    status,
    priority,
    sourceType,
    keyword,
    dueFrom,
    dueTo,
    page,
    pageSize,
    sortField,
    sortOrder
  })
  return {
    label: scope.label,
    groupName: scope.groupName,
    groupId: scope.groupId,
    list: list.map(toDto),
    total,
    page: cur,
    pageSize: size,
    totalPages: total ? Math.ceil(total / size) : 0
  }
}

// 总览统计卡（总数 / 未完成 / 已完成 / 逾期）
async function overviewSummary({ groupId, ownerId }, viewer) {
  const me = await currentUser()
  const scope = await resolveOverviewScope(me, groupId)
  return todoRepository.summary({ groupId: scope.groupId })
}

module.exports = {
  listMine,
  summaryMine,
  calendarMine,
  saveTodo,
  checkSource,
  createFromSource,
  toggleDone,
  removeTodo,
  overview,
  overviewSummary
}
