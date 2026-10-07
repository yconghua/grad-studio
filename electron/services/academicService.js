/**
 * 学业档案服务（Service Layer）—— 学生个人学业记录档案全生命周期
 *
 * 权限模型（唯一可信来源：主进程会话 authService.getCurrentUser + 实时查库）：
 *   - 学生：只能查看/填写自己的档案；confirmed 状态不可改（需导师退回）；
 *   - 导师：查看/确认/退回/代填名下学生；批量确认；
 *   - 组管：查看本组学生档案（只读）+ 维护本组阶段模板（增/停用/排序/改名/必填）；
 *   - 超管：全局查看 + 维护全局默认模板（group_id=0）。
 *
 * 数据与学生挂钩（user_id 为归属核心，group_id 仅按组筛选冗余）：
 *   - 学生换组/换导师 → 档案跟人走，权限按最新关系实时判断；
 *   - 学生删除 → deleteByUser 级联软删记录并清理附件文件（用户删除事务内调用）。
 *
 * 培养类型映射：users.degree（学士→bachelor / 硕士→master / 博士→doctor），未填默认 master。
 */
const path = require('node:path')
const fs = require('node:fs')
const userRepository = require('../db/repositories/userRepository')
const groupRepository = require('../db/repositories/groupRepository')
const academicRecordRepository = require('../db/repositories/academicRecordRepository')
const academicTemplateRepository = require('../db/repositories/academicTemplateRepository')
const authService = require('./authService')
const notificationService = require('./notificationService')
const ApiError = require('./apiError')
const { buildAcademicDocx } = require('./academicToDocx')
const {
  ROLE_STUDENT,
  ROLE_MENTOR,
  ROLE_GROUP_ADMIN,
  ROLE_SUPER_ADMIN
} = require('../../shared/constants')

const STAGE_TYPES = ['master', 'doctor', 'bachelor']
const STAGE_TYPE_LABELS = { master: '硕士', doctor: '博士', bachelor: '本科' }
const STATUS_ORDER = { pending: 0, submitted: 1, confirmed: 2 }

const REMIND_DAYS = 7 // 临近提醒窗口：计划时间距今 ≤7 天未完成即提醒

// 当前登录用户（401 兜底）
async function currentUser() {
  const me = await authService.getCurrentUser()
  if (!me) throw new ApiError('未登录，请重新登录', 401)
  return me
}

// 学生培养类型：学位字段映射（未填/未知默认硕士）
function stageTypeOf(row) {
  const d = String((row && row.degree) || '')
  if (d.includes('博士')) return 'doctor'
  if (d.includes('硕士')) return 'master'
  if (d.includes('学士')) return 'bachelor'
  return 'master'
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

// 用户当前有效课题组（未入组返回 null；返回完整组行含 name）。
// 绑定机制按角色分流：组管绑定存于 groups.admin_user_id（与其他组管功能一致，
// 不能查 users.group_id）；导师/学生存于 users.group_id。
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

// 解析学生生效的阶段模板节点（组模板优先，组未配置则回退全局默认）
async function resolveTemplateNodes(groupId, stageType) {
  if (groupId) {
    const groupNodes = await academicTemplateRepository.listEnabled(groupId, stageType)
    if (groupNodes.length) return groupNodes
  }
  return academicTemplateRepository.listEnabled(0, stageType)
}

// ===== 权限断言 =====

// 查看档案权限：学生=自己；导师=名下学生；组管=本组学生；超管=任意
async function assertCanView(userId, me) {
  const target = await userRepository.findById(Number(userId))
  if (!target) throw new ApiError('用户不存在', 404)
  if (target.role !== ROLE_STUDENT) throw new ApiError('学业档案仅对学生开放', 400)
  if (me.role === ROLE_STUDENT) {
    if (me.id !== Number(userId)) throw new ApiError('无权限：只能查看自己的档案', 403)
    return target
  }
  if (me.role === ROLE_MENTOR) {
    if (Number(target.mentor_id) !== me.id) throw new ApiError('无权限：只能查看名下学生的档案', 403)
    return target
  }
  if (me.role === ROLE_GROUP_ADMIN) {
    const myGroup = await groupOf(me.id)
    if (!myGroup || Number(target.group_id) !== Number(myGroup.id)) {
      throw new ApiError('无权限：只能查看本组学生的档案', 403)
    }
    return target
  }
  if (me.role === ROLE_SUPER_ADMIN) return target
  throw new ApiError('无权限：无权执行此操作', 403)
}

// 模板管理权限：组管=本组模板；超管=全局模板
async function assertTemplateScope(me) {
  if (me.role === ROLE_SUPER_ADMIN) return 0
  if (me.role === ROLE_GROUP_ADMIN) {
    const g = await groupOf(me.id)
    if (!g) throw new ApiError('无权限：需已绑定课题组', 403)
    return Number(g.id)
  }
  throw new ApiError('无权限：仅组管或超管可维护学业模板', 403)
}

// ===== 时间线构建 =====

// 学生档案时间线：模板节点 × 学生记录合并（未填节点显示为待填写）
async function recordsOf(userId, viewer) {
  const target = await assertCanView(userId, viewer)
  const group = await groupOf(userId)
  const stageType = stageTypeOf(target)
  const nodes = await resolveTemplateNodes(group && group.id, stageType)
  const records = await academicRecordRepository.listByUser(userId)
  const byKey = new Map(records.map((r) => [r.node_key, r]))
  const timeline = nodes.map((t, idx) => {
    const rec = byKey.get(t.node_key)
    return {
      sortOrder: idx + 1,
      nodeKey: t.node_key,
      nodeName: t.node_name,
      required: Number(t.required) === 1,
      planDate: fmtDate(t.plan_date),
      record: rec
        ? {
            id: rec.id,
            status: rec.status,
            happenDate: fmtDate(rec.happen_date),
            endDate: fmtDate(rec.end_date),
            content: rec.content,
            attachmentPath: rec.attachment_path,
            rejectReason: rec.reject_reason,
            createdBy: rec.created_by
          }
        : null
    }
  })
  const done = timeline.filter((n) => n.record && n.record.happenDate).length
  return {
    user: {
      id: target.id,
      realName: target.real_name,
      username: target.username,
      userNo: target.user_no,
      degree: target.degree
    },
    groupId: group ? group.id : null,
    groupName: group ? group.name : '',
    stageType,
    stageTypeLabel: STAGE_TYPE_LABELS[stageType],
    nodes: timeline,
    summary: { total: timeline.length, done }
  }
}

// ===== 学生填写 / 提交 =====

// 填写/修改节点（学生填自己；导师/组管/超管可代填）：confirmed 状态不可改
async function saveRecord({ userId, nodeKey, happenDate, endDate, content, attachmentPath }, viewer) {
  const me = await currentUser()
  // 缺省视为学生本人（学生端调用不传 userId，服务端注入归属）
  const targetId = userId || me.id
  const target = await assertCanView(Number(targetId), me)
  if (me.role === ROLE_STUDENT && me.id !== Number(targetId)) {
    throw new ApiError('无权限：只能填写自己的档案', 403)
  }
  const group = await groupOf(targetId)
  if (!group) throw new ApiError('该学生尚未加入课题组', 400)
  const stageType = stageTypeOf(target)
  const templates = await resolveTemplateNodes(group.id, stageType)
  const tpl = templates.find((t) => t.node_key === nodeKey)
  if (!tpl) throw new ApiError('节点不存在或已停用', 400)

  const existing = await academicRecordRepository.findByUserAndNode(targetId, nodeKey)
  if (existing && existing.status === 'confirmed') {
    throw new ApiError('该节点已被导师确认，如需修改请导师退回后重填', 400)
  }

  // 时间校验：结束时间 ≥ 发生时间
  const h = fmtDate(happenDate)
  const e = fmtDate(endDate)
  if (h && e && e < h) throw new ApiError('结束时间不能早于发生时间', 400)

  const patch = {}
  if (happenDate !== undefined) patch.happen_date = h
  if (endDate !== undefined) patch.end_date = e
  if (content !== undefined) patch.content = String(content == null ? '' : content).slice(0, 100000)
  if (attachmentPath !== undefined) patch.attachment_path = attachmentPath || null
  patch.status = 'pending'
  patch.reject_reason = null
  patch.created_by = me.id
  // 模板快照（改名不影响历史；新记录写入当前模板值）
  patch.group_id = group.id
  patch.stage_type = stageType
  patch.node_name = tpl.node_name
  patch.plan_date = tpl.plan_date ? fmtDate(tpl.plan_date) : null

  const id = await academicRecordRepository.upsertByUserNode(targetId, nodeKey, patch)
  return { id: id || (existing && existing.id) || null }
}

// 通知：学生提交节点 → 通知该生当前导师（mentor_id）确认；失败不影响主流程
async function notifySubmitToMentor(rec) {
  try {
    const owner = await userRepository.findById(Number(rec.user_id))
    if (!owner || !owner.mentor_id) return
    const name = owner.real_name || owner.username
    await notificationService.createForUsers({
      recipients: [Number(owner.mentor_id)],
      typeKey: 'academic_submit',
      title: `学生「${name}」提交了节点「${rec.node_name}」`,
      summary: '请在学业档案中确认或退回',
      bizType: 'academic',
      bizId: Number(rec.user_id),
      groupId: rec.group_id == null ? null : Number(rec.group_id)
    })
  } catch (e) {
    // 通知失败不阻断提交
  }
}

// 提交节点：pending → submitted（待导师确认）
async function submitRecord(recordId, viewer) {
  const me = await currentUser()
  const rec = await academicRecordRepository.findByIdWithOwner(Number(recordId))
  if (!rec) throw new ApiError('记录不存在', 404)
  await assertCanView(rec.user_id, me)
  if (me.role === ROLE_STUDENT && me.id !== Number(rec.user_id)) {
    throw new ApiError('无权限：只能提交自己的档案', 403)
  }
  if (rec.status === 'confirmed') throw new ApiError('该节点已确认，无需提交', 400)
  await academicRecordRepository.updateStatus(rec.id, rec.user_id, 'submitted', { reject_reason: null })
  await notifySubmitToMentor(rec)
  return { success: true }
}

// ===== 导师确认 / 退回 =====

// 确认节点：submitted → confirmed（清空退回意见）
async function confirmRecord(recordId, viewer) {
  const me = await currentUser()
  if (me.role !== ROLE_MENTOR) throw new ApiError('无权限：仅导师可确认', 403)
  const rec = await academicRecordRepository.findByIdWithOwner(Number(recordId))
  if (!rec) throw new ApiError('记录不存在', 404)
  await assertCanView(rec.user_id, me)
  if (rec.status !== 'submitted') throw new ApiError('仅可确认已提交的节点', 400)
  await academicRecordRepository.updateStatus(rec.id, rec.user_id, 'confirmed', { reject_reason: null })
  return { success: true }
}

// 退回节点：submitted/confirmed → pending + 退回意见（通知学生）
async function returnRecord(recordId, reason, viewer) {
  const me = await currentUser()
  if (me.role !== ROLE_MENTOR) throw new ApiError('无权限：仅导师可退回', 403)
  const rec = await academicRecordRepository.findByIdWithOwner(Number(recordId))
  if (!rec) throw new ApiError('记录不存在', 404)
  await assertCanView(rec.user_id, me)
  if (rec.status === 'pending') throw new ApiError('该节点尚未提交', 400)
  const r = String(reason == null ? '' : reason).trim().slice(0, 255)
  if (!r) throw new ApiError('请填写退回意见', 400)
  await academicRecordRepository.updateStatus(rec.id, rec.user_id, 'pending', { reject_reason: r })
  try {
    await notificationService.createForUsers({
      recipients: [Number(rec.user_id)],
      typeKey: 'academic_return',
      title: `节点「${rec.node_name}」被退回`,
      summary: `退回意见：${r}`,
      bizType: 'academic',
      bizId: Number(rec.user_id),
      groupId: rec.group_id == null ? null : Number(rec.group_id)
    })
  } catch (e) {
    // 通知失败不阻断退回
  }
  return { success: true }
}

// 批量确认：某学生多个 submitted 节点一次确认
async function batchConfirm({ userId, nodeKeys }, viewer) {
  const me = await currentUser()
  if (me.role !== ROLE_MENTOR) throw new ApiError('无权限：仅导师可确认', 403)
  await assertCanView(Number(userId), me)
  const keys = (nodeKeys || []).map((k) => String(k)).filter(Boolean)
  if (!keys.length) throw new ApiError('请选择要确认的节点', 400)
  const affected = await academicRecordRepository.batchConfirm(Number(userId), keys)
  return { success: true, confirmed: affected }
}

// ===== 模板管理 =====

// 建组初始快照：课题组创建瞬间，把当时全局默认模板（group_id=0）的三套培养类型
// 一次性整批拷贝为本组模板；之后组管全权管理本组模板，超管后续增删改全局模板
// 不再影响任何已建课题组（只影响之后新建的组）。
// 幂等：重复执行/并发冲突（ER_DUP_ENTRY）跳过，不覆盖组管已有的自定义行。
async function initGroupTemplates(groupId) {
  for (const type of STAGE_TYPES) {
    const globals = await academicTemplateRepository.listAll(0, type)
    for (const g of globals) {
      try {
        await academicTemplateRepository.create({
          group_id: groupId,
          stage_type: g.stage_type,
          node_key: g.node_key,
          node_name: g.node_name,
          sort_order: Number(g.sort_order),
          required: Number(g.required),
          plan_term: g.plan_term == null ? null : Number(g.plan_term),
          enabled: Number(g.enabled)
        })
      } catch (e) {
        if (e && e.code === 'ER_DUP_ENTRY') continue
        throw e
      }
    }
  }
}

// 模板列表（管理视图，含停用项）：组管=本组（建组时已含全局快照，不再与全局同步）；超管=全局。
// 之后所有增删改都落本组行，全局默认模板不受影响。
async function listTemplates({ stageType }, viewer) {
  const me = await currentUser()
  const scope = await assertTemplateScope(me)
  const type = String(stageType || '')
  if (!STAGE_TYPES.includes(type)) throw new ApiError('培养类型不合法', 400)
  const list = await academicTemplateRepository.listAll(scope, type)
  return {
    groupId: scope,
    stageType: type,
    list: list.map((t) => ({
      id: t.id,
      nodeKey: t.node_key,
      nodeName: t.node_name,
      sortOrder: Number(t.sort_order),
      required: Number(t.required) === 1,
      planTerm: t.plan_term == null ? null : Number(t.plan_term),
      enabled: Number(t.enabled) === 1
    }))
  }
}

// 新增/更新模板节点（组管=本组，超管=全局）
async function saveTemplate({ id, stageType, nodeKey, nodeName, sortOrder, required, planTerm, enabled }, viewer) {
  const me = await currentUser()
  const scope = await assertTemplateScope(me)
  if (!STAGE_TYPES.includes(String(stageType || ''))) throw new ApiError('培养类型不合法', 400)
  const name = String(nodeName == null ? '' : nodeName).trim().slice(0, 100)
  if (!name) throw new ApiError('请输入节点名称', 400)
  const key = String(nodeKey || '').trim().slice(0, 50)
  if (!key) throw new ApiError('缺少节点标识', 400)
  const order = Number.isInteger(Number(sortOrder)) ? Number(sortOrder) : 0
  const isRequired = required ? 1 : 0
  const term = planTerm == null || planTerm === '' ? null : Number(planTerm)
  const isEnabled = enabled === false ? 0 : 1

  if (id) {
    const existing = await academicTemplateRepository.findById(Number(id))
    if (!existing) throw new ApiError('模板节点不存在', 404)
    if (Number(existing.group_id) !== scope) {
      throw new ApiError('无权限：只能维护本范围模板', 403)
    }
    await academicTemplateRepository.update(Number(id), {
      node_name: name,
      node_key: key,
      sort_order: order,
      required: isRequired,
      plan_term: term,
      enabled: isEnabled
    })
    return { id: Number(id), created: false }
  }
  const dup = await academicTemplateRepository.findByGroupTypeNode(scope, stageType, key)
  if (dup) throw new ApiError('该节点标识已存在', 400)
  const newId = await academicTemplateRepository.create({
    group_id: scope,
    stage_type: stageType,
    node_key: key,
    node_name: name,
    sort_order: order,
    required: isRequired,
    plan_term: term,
    enabled: isEnabled,
    created_by: me.id
  })
  return { id: newId, created: true }
}

// 停用/启用模板节点（组管/超管；停用后学生时间线隐藏，已填历史保留）
async function toggleTemplate(id, enabled, viewer) {
  const me = await currentUser()
  const scope = await assertTemplateScope(me)
  const tpl = await academicTemplateRepository.findById(Number(id))
  if (!tpl) throw new ApiError('模板节点不存在', 404)
  if (Number(tpl.group_id) !== scope) {
    throw new ApiError('无权限：只能维护本范围模板', 403)
  }
  await academicTemplateRepository.update(Number(id), { enabled: enabled ? 1 : 0 })
  return { success: true }
}

// 删除模板节点（组管/超管：彻底移除；前端常规「删除」建议用停用）
async function removeTemplate(id, viewer) {
  const me = await currentUser()
  const scope = await assertTemplateScope(me)
  const tpl = await academicTemplateRepository.findById(Number(id))
  if (!tpl) throw new ApiError('模板节点不存在', 404)
  if (Number(tpl.group_id) !== scope) {
    throw new ApiError('无权限：只能维护本范围模板', 403)
  }
  await academicTemplateRepository.delete(Number(id))
  return { success: true }
}

// ===== 统计 =====

// 统计范围解析：组管固定本组；超管按 groupId 可选组（缺省全局）
async function resolveScope(groupId, me) {
  if (me.role === ROLE_GROUP_ADMIN) {
    const scopeGroup = await groupOf(me.id)
    if (!scopeGroup) throw new ApiError('无权限：需已绑定课题组', 403)
    return scopeGroup
  }
  if (me.role === ROLE_SUPER_ADMIN) {
    if (groupId) {
      const g = await groupRepository.findById(Number(groupId))
      if (!g) throw new ApiError('课题组不存在', 404)
      return g
    }
    return null
  }
  throw new ApiError('无权限：仅组管或超管可查看统计', 403)
}

// 单个学生档案进度统计（模板+记录并行取回）
async function statOne(s, today) {
  const stageType = stageTypeOf(s)
  // 统计口径：优先用学生所在组自定义模板（组未配置回退全局）
  const [nodes, records] = await Promise.all([
    resolveTemplateNodes(s.group_id, stageType),
    academicRecordRepository.listByUser(s.id)
  ])
  const byKey = new Map(records.map((r) => [r.node_key, r]))
  const nodeCount = nodes.length
  let done = 0
  let submitted = 0
  let confirmed = 0
  let overdue = 0
  for (const t of nodes) {
    const rec = byKey.get(t.node_key)
    if (rec && rec.happen_date) done++
    if (rec && rec.status === 'submitted') submitted++
    if (rec && rec.status === 'confirmed') confirmed++
    if (!rec && t.plan_date && fmtDate(t.plan_date) < today) overdue++
  }
  return {
    user: { id: s.id, realName: s.real_name, username: s.username, userNo: s.user_no },
    stageType,
    nodeCount,
    done,
    submitted,
    confirmed,
    overdue,
    progress: nodeCount ? Math.round((done / nodeCount) * 100) : 0
  }
}

// 学生分页列表：与其他列表统一（每页 8 条，后端分页+排序），返回 { list, total, page, pageSize, totalPages }
async function stats({ groupId, page, pageSize, sortField, sortOrder }, viewer) {
  const me = await currentUser()
  const scopeGroup = await resolveScope(groupId, me)
  // 学生清单分页（组为空 = 全部学生）
  const { list, total, page: curPage, pageSize: size, totalPages } = await userRepository.pagedList({
    roles: [ROLE_STUDENT],
    groupId: scopeGroup ? scopeGroup.id : undefined,
    page,
    pageSize,
    sortField,
    sortOrder
  })
  const today = fmtDate(new Date())
  const out = await Promise.all(list.map((s) => statOne(s, today)))

  return {
    groupId: scopeGroup ? scopeGroup.id : null,
    groupName: scopeGroup ? scopeGroup.name : '全部课题组',
    list: out,
    total,
    page: curPage,
    pageSize: size,
    totalPages
  }
}

// 全量统计摘要（顶部统计卡用）：范围学生数 / 平均完成率 / 逾期节点总数。
// 只在本页加载、切换范围或数据变化时调用一次（聚合全量学生，按 20 人一批并发）
async function statsSummary({ groupId }, viewer) {
  const me = await currentUser()
  const scopeGroup = await resolveScope(groupId, me)
  const students = scopeGroup
    ? await userRepository.listAllStudentsOfGroup(scopeGroup.id)
    : await userRepository.listAllStudents()
  const today = fmtDate(new Date())

  const out = []
  const BATCH = 20
  for (let i = 0; i < students.length; i += BATCH) {
    const chunk = students.slice(i, i + BATCH)
    const chunkResults = await Promise.all(chunk.map((s) => statOne(s, today)))
    out.push(...chunkResults)
  }
  const studentCount = out.length
  const avgRate = studentCount ? Math.round(out.reduce((acc, r) => acc + r.progress, 0) / studentCount) : 0
  const totalOverdue = out.reduce((acc, r) => acc + r.overdue, 0)

  return {
    groupId: scopeGroup ? scopeGroup.id : null,
    groupName: scopeGroup ? scopeGroup.name : '全部课题组',
    studentCount,
    avgRate,
    totalOverdue
  }
}

// ===== 导出 =====

// 构建某学生档案 Word buffer（查看权限内可导出）
async function exportDocx(userId, viewer) {
  const me = await currentUser()
  const data = await recordsOf(userId, me)
  const group = await groupOf(userId)
  return buildAcademicDocx({
    user: {
      real_name: data.user.realName,
      username: data.user.username,
      user_no: data.user.userNo
    },
    stageType: data.stageType,
    groupName: group ? group.name : '',
    nodes: data.nodes
  })
}

// ===== 定时提醒 =====

// 学业节点临近/逾期提醒：计划时间 ≤ 今天+7天 且未完成 → 通知学生与导师；remind_at 去重（7天）
async function remindDueNodes() {
  const rows = await academicRecordRepository.listRemindable()
  let sent = 0
  for (const rec of rows) {
    try {
      const student = await userRepository.findById(rec.user_id)
      if (!student || Number(student.status) !== 1) continue
      const recipients = [rec.user_id]
      if (student.mentor_id) recipients.push(Number(student.mentor_id))
      const group = await groupOf(rec.user_id)
      await notificationService.createForUsers({
        recipients,
        typeKey: 'academic_remind',
        title: `学业节点提醒：${rec.node_name}`,
        summary: `「${rec.node_name}」计划 ${fmtDate(rec.plan_date)}，尚未记录，请及时填写`,
        bizType: 'academic',
        bizId: rec.user_id,
        groupId: group ? group.id : null
      })
      await academicRecordRepository.markReminded(rec.id)
      sent++
    } catch (e) {
      // 单条失败不影响本轮其余节点
    }
  }
  return sent
}

// ===== 删除级联 =====

// 学生删除时调用（userService.deleteUser 事务内）：软删档案记录 + 清理附件文件
async function deleteByUser(userId) {
  const records = await academicRecordRepository.listByUser(userId)
  for (const r of records) {
    if (r.attachment_path) {
      try {
        const filePath = path.join(process.cwd(), 'uploads', path.basename(r.attachment_path))
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      } catch (e) {
        // 文件清理失败不阻断删除
      }
    }
  }
  await academicRecordRepository.softDeleteByUser(userId)
  return records.length
}

module.exports = {
  recordsOf,
  saveRecord,
  submitRecord,
  confirmRecord,
  returnRecord,
  batchConfirm,
  initGroupTemplates,
  listTemplates,
  saveTemplate,
  toggleTemplate,
  removeTemplate,
  stats,
  statsSummary,
  exportDocx,
  remindDueNodes,
  deleteByUser
}
