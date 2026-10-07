/**
 * 科研成果服务（Service Layer）—— 学生科研成果全生命周期
 *
 * 权限模型（唯一可信来源：主进程会话 authService.getCurrentUser + 实时查库）：
 *   - 学生：增删改/提交自己的成果；
 *   - 导师：查看/确认/退回/批量确认/代填名下学生；导出 Excel；
 *   - 组管：查看本组学生成果（只读）+ 导出 Excel；
 *   - 超管：全局查看/按组筛选 + 代填 + 删除 + 导出 Excel。
 *
 * 数据与学生挂钩（user_id 为归属核心，group_id 仅按组筛选冗余）：
 *   - 学生换组/换导师 → 成果跟人走，权限按最新关系实时判断；
 *   - 学生删除 → deleteByUser 级联软删成果并清理附件文件（用户删除事务内调用）。
 *
 * 状态机：pending 待填写 / submitted 已提交待确认 / confirmed 已确认（导师）；
 * 退回后回到 pending 可改再提交。
 */
const achievementRepository = require('../db/repositories/achievementRepository')
const userRepository = require('../db/repositories/userRepository')
const groupRepository = require('../db/repositories/groupRepository')
const authService = require('./authService')
const notificationService = require('./notificationService')
const ApiError = require('./apiError')
const { buildAchievementDocx } = require('./achievementToDocx')
const { buildAchievementXlsx } = require('./achievementToXlsx')
const {
  ROLE_STUDENT,
  ROLE_MENTOR,
  ROLE_GROUP_ADMIN,
  ROLE_SUPER_ADMIN
} = require('../../shared/constants')

const TYPES = ['paper', 'patent', 'software', 'award', 'project', 'other']
const TYPE_LABELS = { paper: '论文', patent: '专利', software: '软件著作权', award: '获奖', project: '项目', other: '其他' }

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

// 日期格式化：MySQL DATE 列经连接层返回 Date 对象，统一转 YYYY-MM-DD
function fmtDate(v) {
  if (v == null || v === '') return null
  if (v instanceof Date) {
    const pad2 = (n) => String(n).padStart(2, '0')
    return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}`
  }
  return String(v).slice(0, 10)
}

// 成果行转 DTO
function toDto(row) {
  if (!row) return null
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    groupId: Number(row.group_id),
    type: row.type,
    typeLabel: TYPE_LABELS[row.type] || row.type,
    title: row.title,
    venue: row.venue || '',
    level: row.level || '',
    authors: row.authors || '',
    isFirst: Number(row.is_first) === 1,
    publishDate: fmtDate(row.publish_date),
    description: row.description || '',
    attachmentPath: row.attachment_path || '',
    status: row.status,
    rejectReason: row.reject_reason || '',
    createdAt: row.created_at,
    user: {
      id: Number(row.user_id),
      realName: row.real_name || '',
      username: row.username || '',
      userNo: row.user_no || ''
    }
  }
}

// ===== 权限断言 =====

// 统计/导出范围解析：组管=本组；超管=全局或指定组；导师=名下学生；学生=自己
async function resolveScope(me, groupId) {
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
  if (me.role === ROLE_MENTOR) return { mentorId: me.id, label: '名下学生', groupName: '名下学生' }
  if (me.role === ROLE_STUDENT) {
    // 学生范围：展示当前所在课题组名（未入组则为 null，前端显示「未入组」）
    let groupName = null
    const active = await userRepository.findActiveGroupOfUser(me.id)
    if (active && active.group_id) {
      const g = await groupRepository.findById(Number(active.group_id))
      groupName = g ? g.name : null
    }
    return { userId: me.id, label: '我的成果', groupName }
  }
  throw new ApiError('无权限：无权访问科研成果', 403)
}

// 校验目标学生可被当前用户操作（学生=自己；导师=名下；超管=任意；组管无操作权）
async function assertCanManage(targetId, me) {
  const target = await userRepository.findById(Number(targetId))
  if (!target) throw new ApiError('用户不存在', 404)
  if (target.role !== ROLE_STUDENT) throw new ApiError('科研成果仅对学生开放', 400)
  if (me.role === ROLE_STUDENT) {
    if (me.id !== Number(targetId)) throw new ApiError('无权限：只能操作自己的成果', 403)
    return target
  }
  if (me.role === ROLE_MENTOR) {
    if (Number(target.mentor_id) !== me.id) throw new ApiError('无权限：只能操作名下学生的成果', 403)
    return target
  }
  if (me.role === ROLE_SUPER_ADMIN) return target
  throw new ApiError('无权限：组管对科研成果只读', 403)
}

// ===== 列表 / 统计 =====

// 分页列表（与其他列表统一：每页 8 条，后端分页+排序）
async function stats({ groupId, type, status, keyword, page, pageSize, sortField, sortOrder }, viewer) {
  const me = await currentUser()
  const scope = await resolveScope(me, groupId)
  const { list, total, page: cur, pageSize: size } = await achievementRepository.paged({
    ...scope,
    type,
    status,
    keyword,
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

// 统计摘要（顶部统计卡）：范围总数 / 待确认 / 已确认 / 按类型分布
async function statsSummary({ groupId, type, status, keyword }, viewer) {
  const me = await currentUser()
  const scope = await resolveScope(me, groupId)
  const rows = await achievementRepository.listAll({ ...scope, type, status, keyword })
  const summary = {
    label: scope.label,
    groupName: scope.groupName,
    total: rows.length,
    submitted: 0,
    confirmed: 0,
    pending: 0,
    byType: {}
  }
  for (const r of rows) {
    if (r.status === 'submitted') summary.submitted += 1
    else if (r.status === 'confirmed') summary.confirmed += 1
    else summary.pending += 1
    summary.byType[r.type] = (summary.byType[r.type] || 0) + 1
  }
  return summary
}

// ===== 学生填写 / 提交 =====

// 新增/编辑成果（学生填自己；导师/超管可代填）：confirmed 状态不可改
async function saveAchievement({ id, userId, type, title, venue, level, authors, isFirst, publishDate, description, attachmentPath }, viewer) {
  const me = await currentUser()
  const targetId = userId || me.id
  await assertCanManage(Number(targetId), me)
  const t = String(type || '')
  if (!TYPES.includes(t)) throw new ApiError('成果类型不合法', 400)
  const name = String(title == null ? '' : title).trim().slice(0, 200)
  if (!name) throw new ApiError('请输入成果名称', 400)
  const venueStr = String(venue == null ? '' : venue).trim().slice(0, 200) || null
  const levelStr = String(level == null ? '' : level).trim().slice(0, 50) || null
  const authorsStr = String(authors == null ? '' : authors).trim().slice(0, 500) || null
  const descStr = String(description == null ? '' : description).slice(0, 100000)
  const first = isFirst ? 1 : 0
  const pDate = fmtDate(publishDate)
  const att = attachmentPath || null

  if (id) {
    const existing = await achievementRepository.findByIdWithOwner(Number(id))
    if (!existing) throw new ApiError('成果不存在', 404)
    if (Number(existing.user_id) !== Number(targetId)) throw new ApiError('无权限：成果归属不符', 403)
    if (existing.status === 'confirmed') throw new ApiError('该成果已被导师确认，如需修改请导师退回后重填', 400)
    await achievementRepository.update(Number(id), {
      type: t,
      title: name,
      venue: venueStr,
      level: levelStr,
      authors: authorsStr,
      is_first: first,
      publish_date: pDate,
      description: descStr,
      attachment_path: att,
      status: 'pending',
      reject_reason: null,
      created_by: me.id
    })
    return { id: Number(id), created: false }
  }

  const group = await groupOf(targetId)
  if (!group) throw new ApiError('该学生尚未加入课题组', 400)
  const newId = await achievementRepository.create({
    user_id: Number(targetId),
    group_id: Number(group.id),
    type: t,
    title: name,
    venue: venueStr,
    level: levelStr,
    authors: authorsStr,
    is_first: first,
    publish_date: pDate,
    description: descStr,
    attachment_path: att,
    status: 'pending',
    created_by: me.id
  })
  return { id: newId, created: true }
}

// 通知：学生提交成果 → 通知该生当前导师；失败不影响主流程
async function notifySubmitToMentor(row) {
  try {
    const owner = await userRepository.findById(Number(row.user_id))
    if (!owner || !owner.mentor_id) return
    const name = owner.real_name || owner.username
    await notificationService.createForUsers({
      recipients: [Number(owner.mentor_id)],
      typeKey: 'achievement_submit',
      title: `学生「${name}」提交了成果「${row.title}」`,
      summary: '请在科研成果中确认或退回',
      bizType: 'achievement',
      bizId: Number(row.user_id),
      groupId: row.group_id == null ? null : Number(row.group_id)
    })
  } catch (e) {
    // 通知失败不阻断提交
  }
}

// 提交成果：pending → submitted（待导师确认）
async function submitAchievement(id, viewer) {
  const me = await currentUser()
  const row = await achievementRepository.findByIdWithOwner(Number(id))
  if (!row) throw new ApiError('成果不存在', 404)
  if (me.role === ROLE_STUDENT && me.id !== Number(row.user_id)) {
    throw new ApiError('无权限：只能提交自己的成果', 403)
  }
  if (row.status === 'confirmed') throw new ApiError('该成果已确认，无需提交', 400)
  await achievementRepository.updateStatus(row.id, row.user_id, 'submitted', { reject_reason: null })
  await notifySubmitToMentor(row)
  return { success: true }
}

// ===== 导师确认 / 退回 =====

// 确认成果：submitted → confirmed（清空退回意见）
async function confirmAchievement(id, viewer) {
  const me = await currentUser()
  if (me.role !== ROLE_MENTOR) throw new ApiError('无权限：仅导师可确认', 403)
  const row = await achievementRepository.findByIdWithOwner(Number(id))
  if (!row) throw new ApiError('成果不存在', 404)
  await assertCanManage(row.user_id, me)
  if (row.status !== 'submitted') throw new ApiError('仅可确认已提交的成果', 400)
  await achievementRepository.updateStatus(row.id, row.user_id, 'confirmed', { reject_reason: null })
  return { success: true }
}

// 退回成果：submitted/confirmed → pending + 退回意见（通知学生）
async function returnAchievement(id, reason, viewer) {
  const me = await currentUser()
  if (me.role !== ROLE_MENTOR) throw new ApiError('无权限：仅导师可退回', 403)
  const row = await achievementRepository.findByIdWithOwner(Number(id))
  if (!row) throw new ApiError('成果不存在', 404)
  await assertCanManage(row.user_id, me)
  if (row.status === 'pending') throw new ApiError('该成果尚未提交', 400)
  const r = String(reason == null ? '' : reason).trim().slice(0, 255)
  if (!r) throw new ApiError('请填写退回意见', 400)
  await achievementRepository.updateStatus(row.id, row.user_id, 'pending', { reject_reason: r })
  try {
    await notificationService.createForUsers({
      recipients: [Number(row.user_id)],
      typeKey: 'achievement_return',
      title: `成果「${row.title}」被退回`,
      summary: `退回意见：${r}`,
      bizType: 'achievement',
      bizId: Number(row.user_id),
      groupId: row.group_id == null ? null : Number(row.group_id)
    })
  } catch (e) {
    // 通知失败不阻断退回
  }
  return { success: true }
}

// 批量确认：某学生多条 submitted 成果一次确认
async function batchConfirm({ userId, ids }, viewer) {
  const me = await currentUser()
  if (me.role !== ROLE_MENTOR) throw new ApiError('无权限：仅导师可批量确认', 403)
  await assertCanManage(Number(userId), me)
  const idList = (ids || []).map((i) => Number(i)).filter((n) => n > 0)
  if (!idList.length) throw new ApiError('请选择要确认的成果', 400)
  const affected = await achievementRepository.batchConfirm(Number(userId), idList)
  return { success: true, confirmed: affected }
}

// 导师名下全部已提交成果一次确认（导师页「全部确认」）
async function batchConfirmAll(viewer) {
  const me = await currentUser()
  if (me.role !== ROLE_MENTOR) throw new ApiError('无权限：仅导师可批量确认', 403)
  const affected = await achievementRepository.batchConfirmByMentor(me.id)
  return { success: true, confirmed: affected }
}

// 删除成果（学生本人任意状态可删；超管可删）：软删
async function removeAchievement(id, viewer) {
  const me = await currentUser()
  const row = await achievementRepository.findByIdWithOwner(Number(id))
  if (!row) throw new ApiError('成果不存在', 404)
  if (me.role !== ROLE_SUPER_ADMIN && me.role !== ROLE_STUDENT) {
    throw new ApiError('无权限：仅学生本人或超管可删除成果', 403)
  }
  if (me.role === ROLE_STUDENT && me.id !== Number(row.user_id)) {
    throw new ApiError('无权限：只能删除自己的成果', 403)
  }
  await achievementRepository.delete(Number(id))
  return { success: true }
}

// ===== 导出 =====

// 学生个人成果清单 Word（学生自己 / 导师 / 超管）
async function exportDocx(userId, viewer) {
  const me = await currentUser()
  const targetId = userId || me.id
  const target = await assertCanManage(Number(targetId), me)
  const rows = await achievementRepository.listAll({ userId: Number(targetId) })
  const group = await groupOf(targetId)
  return buildAchievementDocx({
    user: { ...target, group_name: group ? group.name : '' },
    list: rows.map(toDto)
  })
}

// 范围成果 Excel（导师=名下；组管=本组；超管=全局/指定组）
async function exportXlsx({ groupId, type, status, keyword }, viewer) {
  const me = await currentUser()
  const scope = await resolveScope(me, groupId)
  const rows = await achievementRepository.listAll({ ...scope, type, status, keyword })
  return buildAchievementXlsx({
    label: scope.label,
    list: rows.map(toDto)
  })
}

// 学生删除时级联清理（用户删除事务内调用）：软删全部成果
async function deleteByUser(userId) {
  await achievementRepository.softDeleteByUser(Number(userId))
}

module.exports = {
  stats,
  statsSummary,
  saveAchievement,
  submitAchievement,
  confirmAchievement,
  returnAchievement,
  batchConfirm,
  batchConfirmAll,
  removeAchievement,
  exportDocx,
  exportXlsx,
  deleteByUser
}
