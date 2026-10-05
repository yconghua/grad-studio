/**
 * 课题组组会服务（Service Layer）—— 组会记录与「发布为公告」
 *
 * 权限模型（唯一可信来源为主进程内存会话 authService.getCurrentUser，
 * 不信任前端传入的 role / groupId / meetingId / hostId）：
 *   - 超级管理员：全平台任意课题组会议的查看、创建、编辑、删除、归档、
 *     参与人管理、统计、发布为公告；可只读查看任意组草稿，但编辑/发布仅自己的草稿；
 *   - 课题组管理员：仅本组会议的创建、编辑、删除、归档、参与人管理、统计、
 *     发布为公告；可只读查看本组草稿（含他人），删除本组任意草稿，编辑/发布仅自己的草稿；
 *   - 导师 / 学生：仅只读自己参与的（当前有效课题组）已发布/已归档会议，无任何写权限。
 * 会议归属课题组：删除组会不删公告；课题组删除时由 groupService 级联删会议、参与人、公告、公告已读。
 */
const { runTransaction } = require('../db/connection')
const userRepository = require('../db/repositories/userRepository')
const groupRepository = require('../db/repositories/groupRepository')
const groupMeetingRepository = require('../db/repositories/groupMeetingRepository')
const groupMeetingParticipantRepository = require('../db/repositories/groupMeetingParticipantRepository')
const groupNoticeRepository = require('../db/repositories/groupNoticeRepository')
const authService = require('./authService')
const groupService = require('./groupService')
const notificationService = require('./notificationService')
const ApiError = require('./apiError')
const {
  ROLE_SUPER_ADMIN,
  ROLE_GROUP_ADMIN,
  ROLE_MENTOR,
  ROLE_STUDENT
} = require('../../shared/constants')

// 会议状态：1草稿 / 2已发布 / 3已归档
const MEETING_STATUS_DRAFT = 1
const MEETING_STATUS_PUBLISHED = 2
const MEETING_STATUS_ARCHIVED = 3

// 同步公告内容上限（与公告表一致）
const NOTICE_CONTENT_MAX = 10000
// 公告标题上限（与公告表一致）
const NOTICE_TITLE_MAX = 100

// 当前登录用户（401 兜底）
async function currentUser() {
  const me = await authService.getCurrentUser()
  if (!me) throw new ApiError('未登录，请重新登录', 401)
  return me
}

// 课题组管理员绑定的课题组（权威来源：groups.admin_user_id）
async function groupAdminGroupId(me) {
  const group = await groupRepository.findByAdminUserId(me.id)
  if (!group) throw new ApiError('当前账号未绑定课题组', 404)
  return group.id
}

// 导师/学生当前有效课题组（实时查用户表，不读会话缓存）
async function memberGroupId(me) {
  const row = await userRepository.findActiveGroupOfUser(me.id)
  return row && row.group_id ? Number(row.group_id) : null
}

// ===== 字段校验 =====

function assertTitle(title) {
  const t = String(title).trim()
  if (!t) throw new ApiError('请输入会议主题', 400)
  if (t.length > 100) throw new ApiError('会议主题不能超过 100 个字符', 400)
  return t
}
function assertMeetingTime(meetingTime) {
  if (meetingTime === undefined || meetingTime === null || String(meetingTime).trim() === '') {
    throw new ApiError('请选择会议时间', 400)
  }
  const d = new Date(String(meetingTime).replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) throw new ApiError('会议时间不合法', 400)
  return String(meetingTime).trim()
}
function assertLocation(location) {
  const l = location === undefined || location === null ? '' : String(location).trim()
  if (l.length > 100) throw new ApiError('地点不能超过 100 个字符', 400)
  return l || null
}
function assertAgenda(agenda) {
  const a = agenda === undefined || agenda === null ? '' : String(agenda).trim()
  if (a.length > 2000) throw new ApiError('议题不能超过 2000 个字符', 400)
  return a || null
}
function assertContent(content) {
  const c = content === undefined || content === null ? '' : String(content).trim()
  if (c.length > 20000) throw new ApiError('会议纪要不能超过 20000 个字符', 400)
  // 服务端第一道安全闸（主要 XSS 防护由渲染层 DOMPurify 白名单过滤承担）
  if (/<script|<iframe|javascript:/i.test(c)) {
    throw new ApiError('会议纪要包含不允许的代码片段', 400)
  }
  return c
}
// 创建时只允许 1 草稿 / 2 已发布（不允许直接归档）
function assertCreateStatus(status) {
  const st = status === undefined || status === null || status === '' ? MEETING_STATUS_PUBLISHED : Number(status)
  if (![MEETING_STATUS_DRAFT, MEETING_STATUS_PUBLISHED].includes(st)) throw new ApiError('状态参数不合法', 400)
  return st
}

// 按码点安全截断（避免切断多字节字符），截断处加省略号
function truncateByCodePoint(str, max) {
  const arr = Array.from(String(str))
  if (arr.length <= max) return String(str)
  return arr.slice(0, max).join('') + '…'
}

// 行转 DTO（发起人被删除时姓名回退「用户 #id」；列表行无 content 字段时取空串）
function toMeetingDto(row) {
  if (!row) return null
  return {
    id: row.id,
    groupId: row.group_id,
    groupName: row.group_name || '',
    title: row.title,
    meetingTime: row.meeting_time,
    location: row.location || '',
    hostId: row.host_id,
    hostName: row.host_real_name || row.host_username || `用户 #${row.host_id}`,
    agenda: row.agenda || '',
    content: row.content || '',
    status: row.status,
    noticeId: row.notice_id == null ? null : Number(row.notice_id),
    participantCount: Number(row.participant_count) || 0,
    createTime: row.create_time,
    changeTs: row.change_ts
  }
}

// 分页结果包装
function pageResult(result, mapper) {
  return {
    list: result.list.map(mapper),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages
  }
}

// ===== 权限判定 =====

// 已发布/已归档会议的管理权限：超管任意；组管仅本组；导师/学生一律拒绝
async function assertManagePublished(me, meeting) {
  if (me.role === ROLE_SUPER_ADMIN) return
  if (me.role === ROLE_GROUP_ADMIN) {
    const myGroupId = await groupAdminGroupId(me)
    if (meeting.group_id !== myGroupId) throw new ApiError('无权限：只能操作本课题组的会议', 403)
    return
  }
  throw new ApiError('无权限：无权执行此操作', 403)
}

// 编辑草稿：仅创建者
function assertOwnDraft(me, meeting) {
  if (meeting.status !== MEETING_STATUS_DRAFT) throw new ApiError('仅草稿可编辑', 400)
  if (meeting.host_id !== me.id) throw new ApiError('无权限：只能编辑自己创建的草稿', 403)
}

// 发布草稿：仅创建者
function assertPublishable(me, meeting) {
  if (meeting.status !== MEETING_STATUS_DRAFT) throw new ApiError('仅草稿可发布', 400)
  if (meeting.host_id !== me.id) throw new ApiError('无权限：只能发布自己创建的草稿', 403)
}

// 删除草稿：创建者本人，或本组组管/超管
async function assertDraftDeletable(me, meeting) {
  if (meeting.status !== MEETING_STATUS_DRAFT) throw new ApiError('仅草稿适用该删除权限', 400)
  if (meeting.host_id === me.id) return
  if (me.role === ROLE_SUPER_ADMIN) return
  if (me.role === ROLE_GROUP_ADMIN) {
    const myGroupId = await groupAdminGroupId(me)
    if (meeting.group_id === myGroupId) return
  }
  throw new ApiError('无权限：无权删除该草稿', 403)
}

// 详情可见性：草稿仅创建者/本组组管/超管；已发布/已归档按角色收敛
async function assertDetailVisible(me, meeting) {
  if (meeting.status === MEETING_STATUS_DRAFT) {
    if (meeting.host_id === me.id) return
    if (me.role === ROLE_SUPER_ADMIN) return
    if (me.role === ROLE_GROUP_ADMIN) {
      const myGroupId = await groupAdminGroupId(me)
      if (meeting.group_id === myGroupId) return
    }
    throw new ApiError('无权限：无权查看该草稿', 403)
  }
  if (me.role === ROLE_SUPER_ADMIN) return
  if (me.role === ROLE_GROUP_ADMIN) {
    const myGroupId = await groupAdminGroupId(me)
    if (meeting.group_id !== myGroupId) throw new ApiError('无权限：只能查看本课题组的会议', 403)
    return
  }
  // 导师/学生：自己参与 + 当前有效课题组
  const myGroupId = await memberGroupId(me)
  if (!myGroupId || myGroupId !== meeting.group_id) throw new ApiError('无权限：你不是该课题组的有效成员', 403)
  const ids = await groupMeetingParticipantRepository.listMeetingIdsByUser(me.id)
  if (!ids.includes(meeting.id)) throw new ApiError('无权限：未参与该会议', 403)
}

// ===== 参与人 =====

// 该组有效成员 id 集合（启用状态的导师/学生；组管/超管不作为可选参与人）
async function enabledMemberIds(groupId) {
  const rows = await userRepository.listEnabledAudienceByGroup(groupId)
  return new Set(rows.map((r) => Number(r.id)))
}

// 校验参与人：必须全部是该组启用状态的导师/学生；返回去重后的 userId 数组
async function assertParticipants(groupId, participantIds) {
  const list = Array.isArray(participantIds) ? participantIds : []
  const ids = []
  for (const raw of list) {
    const n = Number(raw)
    if (!n || ids.includes(n)) continue
    ids.push(n)
  }
  if (ids.length === 0) return ids
  const memberSet = await enabledMemberIds(groupId)
  for (const uid of ids) {
    if (!memberSet.has(uid)) throw new ApiError(`参与人用户 #${uid} 不是该组启用状态的导师或学生`, 400)
  }
  return ids
}

// ===== 会议列表 / 详情 =====

/**
 * 会议分页列表：角色可见范围在服务端强制收敛。
 * 草稿不出现在本列表（草稿走 listMyDrafts / listGroupDrafts 视图）。
 */
async function listMeetings({ page, keyword, groupId, status, hostId, startTime, endTime, sortField, sortOrder } = {}) {
  const me = await currentUser()
  const filters = { page, keyword, startTime, endTime, sortField, sortOrder }
  let effectiveGroupId = null
  let effectiveStatus = status === undefined || status === null || status === '' ? null : status

  if (me.role === ROLE_SUPER_ADMIN) {
    // 全部课题组已发布 + 已归档，支持按课题组 / 发起人筛选
    if (groupId !== undefined && groupId !== null && groupId !== '') effectiveGroupId = Number(groupId)
    if (hostId !== undefined && hostId !== null && hostId !== '') filters.hostId = Number(hostId)
  } else if (me.role === ROLE_GROUP_ADMIN) {
    // 仅本组（忽略前端传值）
    effectiveGroupId = await groupAdminGroupId(me)
  } else {
    // 导师/学生：自己参与 + 当前有效组；默认只看已发布
    const myGroupId = await memberGroupId(me)
    if (!myGroupId) {
      return { list: [], total: 0, page: 1, pageSize: 8, totalPages: 1, groupId: null, notInGroup: true }
    }
    effectiveGroupId = myGroupId
    filters.participantUserId = me.id
    if (!effectiveStatus) effectiveStatus = MEETING_STATUS_PUBLISHED
  }

  // 超管/组管未显式筛选状态时，默认只返回已发布 + 已归档（草稿仅草稿视图可见）
  if (effectiveGroupId) filters.groupId = effectiveGroupId
  if (effectiveStatus) {
    filters.status = Number(effectiveStatus)
  } else {
    filters.status = [MEETING_STATUS_PUBLISHED, MEETING_STATUS_ARCHIVED]
  }

  const result = await groupMeetingRepository.pagedList(filters)
  const data = pageResult(result, toMeetingDto)
  data.groupId = effectiveGroupId
  return data
}

/** 我的草稿：当前用户创建的草稿（仅超管/组管有草稿；导师/学生 403） */
async function listMyDrafts({ page, sortField, sortOrder } = {}) {
  const me = await currentUser()
  if (me.role !== ROLE_SUPER_ADMIN && me.role !== ROLE_GROUP_ADMIN) {
    throw new ApiError('无权限：无权查看草稿', 403)
  }
  const result = await groupMeetingRepository.listMyDrafts(me.id, { page, sortField, sortOrder })
  return pageResult(result, toMeetingDto)
}

/** 本组草稿：组管仅本组；超管可指定任意组；导师/学生 403（只读视图） */
async function listGroupDrafts({ page, groupId } = {}) {
  const me = await currentUser()
  let effectiveGroupId
  if (me.role === ROLE_SUPER_ADMIN) {
    if (groupId === undefined || groupId === null || groupId === '') throw new ApiError('请选择课题组', 400)
    effectiveGroupId = Number(groupId)
    const g = await groupRepository.findById(effectiveGroupId)
    if (!g) throw new ApiError('课题组不存在', 404)
  } else if (me.role === ROLE_GROUP_ADMIN) {
    effectiveGroupId = await groupAdminGroupId(me)
  } else {
    throw new ApiError('无权限：无权查看草稿', 403)
  }
  const result = await groupMeetingRepository.listGroupDrafts(effectiveGroupId, { page })
  const data = pageResult(result, toMeetingDto)
  data.groupId = effectiveGroupId
  return data
}

/** 会议详情：返回完整信息 + 参与人名单 + noticeId */
async function getMeetingDetail(id) {
  const me = await currentUser()
  const meeting = await groupMeetingRepository.findById(Number(id))
  if (!meeting) throw new ApiError('会议不存在', 404)
  await assertDetailVisible(me, meeting)
  const participants = await groupMeetingParticipantRepository.listByMeeting(meeting.id)
  const dto = toMeetingDto(meeting)
  dto.participants = participants.map((p) => ({
    userId: p.user_id,
    username: p.username || '',
    realName: p.real_name || '',
    role: p.role || '',
    roleInMeeting: p.role_in_meeting || ''
  }))
  return dto
}

// ===== 创建 / 编辑 / 发布 =====

/**
 * 创建会议（超管可指定任意组；组管强制本组；导师/学生禁止）。
 * host_id = 当前登录用户；创建时不生成公告，notice_id 为空。
 */
async function createMeeting(data = {}) {
  const me = await currentUser()
  let targetGroupId
  if (me.role === ROLE_SUPER_ADMIN) {
    targetGroupId = data.groupId === undefined || data.groupId === null || data.groupId === '' ? null : Number(data.groupId)
    if (!targetGroupId) throw new ApiError('请选择要创建会议的课题组', 400)
    const g = await groupRepository.findById(targetGroupId)
    if (!g) throw new ApiError('课题组不存在', 404)
  } else if (me.role === ROLE_GROUP_ADMIN) {
    targetGroupId = await groupAdminGroupId(me)
  } else {
    throw new ApiError('无权限：无权创建会议', 403)
  }

  // 状态校验：停用组禁止新建会议
  await groupService.assertGroupWritable(targetGroupId)

  const status = assertCreateStatus(data.status)
  const participantIds = await assertParticipants(targetGroupId, data.participantIds)
  if (status === MEETING_STATUS_PUBLISHED && participantIds.length === 0) {
    throw new ApiError('已发布的会议至少需要一位参与人', 400)
  }
  const title = assertTitle(data.title)
  const meetingTime = assertMeetingTime(data.meetingTime)
  const location = assertLocation(data.location)
  const agenda = assertAgenda(data.agenda)
  const content = assertContent(data.content)

  const id = await runTransaction(async () => {
    const meetingId = await groupMeetingRepository.create({
      group_id: targetGroupId,
      title,
      meeting_time: meetingTime,
      location,
      host_id: me.id,
      agenda,
      content,
      status,
      notice_id: null
    })
    await groupMeetingParticipantRepository.createMany(meetingId, participantIds)
    return meetingId
  })
  // 通知中心：以已发布状态直接创建 → 通知全部参与人（草稿创建不发）
  if (status === MEETING_STATUS_PUBLISHED) {
    await notificationService.createForUsers({
      recipients: participantIds,
      typeKey: 'meeting',
      title,
      summary: `${meetingTime}${location ? `，地点：${location}` : ''}`,
      bizType: 'meeting',
      bizId: id,
      groupId: targetGroupId
    })
  }
  return getMeetingDetail(id)
}

/**
 * 编辑会议：草稿仅创建者；已发布/已归档：超管任意 / 组管本组。
 * 允许改 title/meeting_time/location/agenda/content；groupId、hostId 不可改；
 * 已归档编辑后保持归档状态；参与人全量替换（先删后插，同一事务）。
 */
async function updateMeeting(id, data = {}) {
  const me = await currentUser()
  const meeting = await groupMeetingRepository.findById(Number(id))
  if (!meeting) throw new ApiError('会议不存在', 404)

  if (meeting.status === MEETING_STATUS_DRAFT) {
    assertOwnDraft(me, meeting)
  } else {
    await assertManagePublished(me, meeting)
  }

  // 状态校验：停用组禁止编辑会议
  await groupService.assertGroupWritable(meeting.group_id)

  const patch = {}
  if (data.title !== undefined) patch.title = assertTitle(data.title)
  if (data.meetingTime !== undefined) patch.meeting_time = assertMeetingTime(data.meetingTime)
  if (data.location !== undefined) patch.location = assertLocation(data.location)
  if (data.agenda !== undefined) patch.agenda = assertAgenda(data.agenda)
  if (data.content !== undefined) patch.content = assertContent(data.content)
  if (Object.keys(patch).length === 0 && data.participantIds === undefined) {
    throw new ApiError('没有需要修改的内容', 400)
  }

  // 参与人全量替换：已发布/已归档会议的新参与人必须全部是当前有效成员
  let participantIds = null
  if (data.participantIds !== undefined) {
    participantIds = await assertParticipants(meeting.group_id, data.participantIds)
    if (meeting.status !== MEETING_STATUS_DRAFT && participantIds.length === 0) {
      throw new ApiError('已发布的会议至少需要一位参与人', 400)
    }
  }

  await runTransaction(async () => {
    if (Object.keys(patch).length > 0) {
      await groupMeetingRepository.updateById(meeting.id, patch)
    }
    if (participantIds !== null) {
      await groupMeetingParticipantRepository.deleteByMeeting(meeting.id)
      await groupMeetingParticipantRepository.createMany(meeting.id, participantIds)
    }
  })
  return getMeetingDetail(meeting.id)
}

/**
 * 发布草稿：仅创建者；发布前重新校验参与人——
 * 同事务移除已失效成员，有效参与人为 0 拒绝发布；不生成公告。
 */
async function publishMeeting(id) {
  const me = await currentUser()
  const meeting = await groupMeetingRepository.findById(Number(id))
  if (!meeting) throw new ApiError('会议不存在', 404)
  assertPublishable(me, meeting)
  // 状态校验：停用组禁止发布草稿
  await groupService.assertGroupWritable(meeting.group_id)

  const currentIds = (await groupMeetingParticipantRepository.listByMeeting(meeting.id)).map((p) => Number(p.user_id))
  const memberSet = await enabledMemberIds(meeting.group_id)
  const staleIds = currentIds.filter((uid) => !memberSet.has(uid))
  const validCount = currentIds.length - staleIds.length
  if (validCount === 0) throw new ApiError('会议参与人已全部失效，无法发布，请先编辑补充参与人', 400)

  await runTransaction(async () => {
    if (staleIds.length > 0) {
      await groupMeetingParticipantRepository.deleteByMeetingAndUsers(meeting.id, staleIds)
    }
    await groupMeetingRepository.updateStatus(meeting.id, MEETING_STATUS_PUBLISHED)
  })
  // 通知中心：组会发布 → 通知全部有效参与人（标题=组会主题，摘要=时间+地点）
  const participants = await groupMeetingParticipantRepository.listByMeeting(meeting.id)
  await notificationService.createForUsers({
    recipients: participants.map((p) => p.user_id),
    typeKey: 'meeting',
    title: meeting.title,
    summary: `${meeting.meeting_time}${meeting.location ? `，地点：${meeting.location}` : ''}`,
    bizType: 'meeting',
    bizId: meeting.id,
    groupId: meeting.group_id
  })
  return { removedCount: staleIds.length }
}

// ===== 发布为公告 =====

// 公告标题：`【组会】` + 主题，超 100 按码点安全截断
function buildNoticeTitle(meeting) {
  return truncateByCodePoint(`【组会】${meeting.title || ''}`, NOTICE_TITLE_MAX)
}

// 公告内容拼接：主题 → 时间地点 → 纪要 → 参与人名单；
// 超 10000 先整体砍参与人名单，仍超再按码点截纪要，最后加省略号。
function buildNoticeContent(meeting, participants) {
  const headParts = []
  headParts.push(`主题：${meeting.title || ''}`)
  headParts.push(`时间：${meeting.meeting_time}${meeting.location ? `，地点：${meeting.location}` : ''}`)
  if (meeting.content) headParts.push(`纪要：\n${meeting.content}`)

  const names = participants.map((p) => {
    const name = p.real_name || p.username || `用户 #${p.user_id}`
    const uname = p.username ? `（${p.username}）` : ''
    return `${name}${uname}`
  })
  const fullParts = [...headParts]
  if (names.length > 0) fullParts.push(`参与人：${names.join('、')}`)

  const full = fullParts.join('\n\n')
  if (full.length <= NOTICE_CONTENT_MAX) return full

  // 超限：先整体砍参与人名单
  const withoutNames = headParts.join('\n\n')
  if (withoutNames.length <= NOTICE_CONTENT_MAX) return withoutNames

  // 仍超：截纪要（保证主题与时间地点完整保留）
  const base = [headParts[0], headParts[1]].join('\n\n')
  const prefix = `${base}\n\n纪要：\n`
  const remain = NOTICE_CONTENT_MAX - prefix.length - 1
  if (remain <= 0) return truncateByCodePoint(base, NOTICE_CONTENT_MAX)
  return prefix + truncateByCodePoint(meeting.content, remain) + '…'
}

/**
 * 发布为公告：仅超管任意已发布组会 / 组管本组已发布组会。
 * 条件更新防并发重复（UPDATE ... AND notice_id IS NULL），
 * 生成公告与回写 notice_id 同一事务，任一步失败整体回滚。
 */
async function publishAsNotice(id) {
  const me = await currentUser()
  const meeting = await groupMeetingRepository.findById(Number(id))
  if (!meeting) throw new ApiError('会议不存在', 404)
  if (meeting.status !== MEETING_STATUS_PUBLISHED) {
    throw new ApiError('仅已发布的会议可发布为公告', 400)
  }
  await assertManagePublished(me, meeting)
  // 状态校验：停用组禁止发布为公告
  await groupService.assertGroupWritable(meeting.group_id)

  const participants = await groupMeetingParticipantRepository.listByMeeting(meeting.id)
  const title = buildNoticeTitle(meeting)
  const content = buildNoticeContent(meeting, participants)

  const noticeId = await runTransaction(async () => {
    const createdNoticeId = await groupNoticeRepository.create({
      group_id: meeting.group_id,
      publisher_id: me.id,
      publisher_role: me.role,
      title,
      content,
      is_top: 0,
      status: 1,
      publish_time: nowSql()
    })
    const affected = await groupMeetingRepository.updateNoticeId(meeting.id, createdNoticeId)
    if (affected === 0) {
      throw new ApiError('该组会已发布过公告', 400)
    }
    return createdNoticeId
  })
  // 通知中心：组会发布为公告 → 通知该组全部启用成员（与直接发公告同语义）
  await notificationService.createForGroup({
    groupId: meeting.group_id,
    typeKey: 'notice',
    title,
    summary: Array.from(String(content).trim()).slice(0, 50).join(''),
    bizType: 'notice',
    bizId: noticeId
  })
  return { noticeId }
}

// ===== 归档 / 删除 / 统计 =====

/**
 * 归档 / 取消归档：status 在 2 和 3 之间切换；草稿不允许归档；
 * 不影响已生成的公告。
 */
async function toggleArchive(id) {
  const me = await currentUser()
  const meeting = await groupMeetingRepository.findById(Number(id))
  if (!meeting) throw new ApiError('会议不存在', 404)
  if (meeting.status === MEETING_STATUS_DRAFT) throw new ApiError('草稿不允许归档', 400)
  await assertManagePublished(me, meeting)
  const next = meeting.status === MEETING_STATUS_ARCHIVED ? MEETING_STATUS_PUBLISHED : MEETING_STATUS_ARCHIVED
  await groupMeetingRepository.updateStatus(meeting.id, next)
  return { status: next }
}

/**
 * 删除会议：草稿（创建者本人 / 本组组管/超管）；已发布/已归档（超管任意 / 组管本组）。
 * 同事务删参与人 + 删会议；已生成公告不联动删除。
 */
async function deleteMeeting(id) {
  const me = await currentUser()
  const meeting = await groupMeetingRepository.findById(Number(id))
  if (!meeting) throw new ApiError('会议不存在', 404)
  if (meeting.status === MEETING_STATUS_DRAFT) {
    await assertDraftDeletable(me, meeting)
  } else {
    await assertManagePublished(me, meeting)
  }
  await runTransaction(async () => {
    await groupMeetingParticipantRepository.deleteByMeeting(meeting.id)
    await groupMeetingRepository.deleteById(meeting.id)
    // 通知中心：删除组会 → 关联通知软删（保留历史，不硬删）
    await notificationService.softDeleteByBiz('meeting', meeting.id)
  })
  return true
}

/**
 * 会议统计：只统计已发布会议。
 * 超管可指定任意组（不传则全平台）；组管仅本组；导师/学生 403。
 * 参与率 = 已发布会议累计参与人次 ÷ (已发布会议数 × 有效导师+学生人数)，保留两位小数。
 */
async function getMeetingStats(groupId) {
  const me = await currentUser()
  let effectiveGroupId = null
  if (me.role === ROLE_SUPER_ADMIN) {
    if (groupId !== undefined && groupId !== null && groupId !== '') {
      effectiveGroupId = Number(groupId)
      const g = await groupRepository.findById(effectiveGroupId)
      if (!g) throw new ApiError('课题组不存在', 404)
    }
  } else if (me.role === ROLE_GROUP_ADMIN) {
    effectiveGroupId = await groupAdminGroupId(me)
  } else {
    throw new ApiError('无权限：无权查看统计', 403)
  }

  const stats = await groupMeetingRepository.statsByGroup(effectiveGroupId)
  const total = Number(stats.total) || 0
  const monthTotal = Number(stats.month_total) || 0
  const attendSum = Number(stats.attend_sum) || 0
  const audience = effectiveGroupId
    ? await userRepository.countAudienceByGroup(effectiveGroupId)
    : await userRepository.countAudienceAll()
  const participationRate = total > 0 && audience > 0
    ? Math.round((attendSum / (total * audience)) * 100) / 100
    : 0

  const latest = await groupMeetingRepository.latestByGroup(effectiveGroupId)
  return {
    groupId: effectiveGroupId,
    total,
    monthTotal,
    latestTime: latest ? latest.meeting_time : null,
    latestTitle: latest ? latest.title : null,
    audience,
    participationRate
  }
}

/** 参与人候选：该组启用状态的导师+学生（新建/编辑弹窗选人用） */
async function listMemberOptions(groupId) {
  const me = await currentUser()
  let effectiveGroupId
  if (me.role === ROLE_SUPER_ADMIN) {
    if (groupId === undefined || groupId === null || groupId === '') throw new ApiError('请选择课题组', 400)
    effectiveGroupId = Number(groupId)
    const g = await groupRepository.findById(effectiveGroupId)
    if (!g) throw new ApiError('课题组不存在', 404)
  } else if (me.role === ROLE_GROUP_ADMIN) {
    effectiveGroupId = await groupAdminGroupId(me)
  } else {
    throw new ApiError('无权限：无权查看参与人列表', 403)
  }
  const rows = await userRepository.listEnabledAudienceByGroup(effectiveGroupId)
  return rows.map((r) => ({
    id: Number(r.id),
    username: r.username,
    realName: r.real_name || '',
    role: r.role
  }))
}

/**
 * 最近一次已发布会议（工作台卡片用）：
 * 超管 = 全平台最近；组管 = 本组最近；导师/学生 = 自己参与的最近（限当前有效组）。
 * 草稿与已归档不出现在卡片。
 */
async function getRecentMeeting() {
  const me = await currentUser()
  let row = null
  if (me.role === ROLE_SUPER_ADMIN) {
    row = await groupMeetingRepository.latestByGroup(null)
  } else if (me.role === ROLE_GROUP_ADMIN) {
    const myGroupId = await groupAdminGroupId(me)
    row = await groupMeetingRepository.latestByGroup(myGroupId)
  } else {
    const myGroupId = await memberGroupId(me)
    if (myGroupId) {
      row = await groupMeetingRepository.latestParticipatedByGroup(me.id, myGroupId)
    }
  }
  return row ? toMeetingDto(row) : null
}

// 本地时间格式化（YYYY-MM-DD HH:mm:ss，DATETIME 列写入用）
function nowSql() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  )
}

module.exports = {
  listMeetings,
  listMyDrafts,
  listGroupDrafts,
  getMeetingDetail,
  createMeeting,
  updateMeeting,
  publishMeeting,
  publishAsNotice,
  toggleArchive,
  deleteMeeting,
  getMeetingStats,
  listMemberOptions,
  getRecentMeeting
}
