/**
 * 科研成果「时间进度」服务（Service Layer）
 *
 * 与学业档案同模式：
 *   - 节点模板：超管维护全局（group_id=0），组管维护本组快照（建组时整批拷贝，之后全权归组管）；
 *   - 节点时间记录：成果 × 节点 唯一，学生填写（created_by=学生本人，与成果代填人区分）、
 *     导师审核（submitted→confirmed / 退回 pending+意见）；组管/超管只读；
 *   - 通知：学生提交节点 → 通知导师（achievement_stage_submit）；导师退回 → 通知学生
 *     （achievement_stage_return）；确认与填写不发通知；
 *   - 级联：删除成果 / 删除学生时物理清理节点记录。
 */
const achievementRepository = require('../db/repositories/achievementRepository')
const achievementStageTemplateRepository = require('../db/repositories/achievementStageTemplateRepository')
const achievementStageRecordRepository = require('../db/repositories/achievementStageRecordRepository')
const userRepository = require('../db/repositories/userRepository')
const groupRepository = require('../db/repositories/groupRepository')
const authService = require('./authService')
const notificationService = require('./notificationService')
const ApiError = require('./apiError')
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
// 与学业档案 academicService.groupOf 完全一致：组管直接按 groups.admin_user_id 返回，
// 导师/学生走活跃组关系；不在本层追加 is_deleted 过滤（否则返回形态差异会导致误判未绑定）。
async function groupOf(userId) {
  const u = await userRepository.findById(Number(userId))
  if (!u) return null
  if (u.role === ROLE_GROUP_ADMIN) {
    return await groupRepository.findByAdminUserId(u.id)
  }
  const ref = await userRepository.findActiveGroupOfUser(u.id)
  if (!ref) return null
  return await groupRepository.findById(ref.group_id)
}

// 日期格式化（空/非法返回 null）
function fmtDate(v) {
  if (v == null || v === '') return null
  if (v instanceof Date) {
    const pad2 = (n) => String(n).padStart(2, '0')
    return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}`
  }
  return String(v).slice(0, 10)
}

// 只读校验：当前用户可查看某条成果（学生=自己；导师=名下；组管=本组；超管=任意）
async function assertCanViewAchievement(row, me) {
  if (me.role === ROLE_STUDENT) {
    if (me.id !== Number(row.user_id)) throw new ApiError('无权限：只能查看自己的成果', 403)
  } else if (me.role === ROLE_MENTOR) {
    const target = await userRepository.findById(Number(row.user_id))
    if (!target || Number(target.mentor_id) !== me.id) throw new ApiError('无权限：只能查看名下学生的成果', 403)
  } else if (me.role === ROLE_GROUP_ADMIN) {
    const g = await groupOf(me.id)
    if (!g || Number(g.id) !== Number(row.group_id)) throw new ApiError('无权限：只能查看本组学生的成果', 403)
  } else if (me.role !== ROLE_SUPER_ADMIN) {
    throw new ApiError('无权限', 403)
  }
}

// 模板管理权限：组管=本组模板；超管=全局模板
async function assertTemplateScope(me) {
  if (me.role === ROLE_SUPER_ADMIN) return 0
  if (me.role === ROLE_GROUP_ADMIN) {
    const g = await groupOf(me.id)
    if (!g) throw new ApiError('无权限：需已绑定课题组', 403)
    return Number(g.id)
  }
  throw new ApiError('无权限：仅组管或超管可维护成果节点模板', 403)
}

// 解析某成果实际使用的节点：本组快照优先，无快照回退超管全局
async function resolveStageNodes(groupId, type) {
  if (groupId) {
    const groupNodes = await achievementStageTemplateRepository.listEnabled(groupId, type)
    if (groupNodes.length) return groupNodes
  }
  return achievementStageTemplateRepository.listEnabled(0, type)
}

// ===== 模板管理 =====

// 建组初始快照：课题组创建瞬间，把当时全局默认节点（group_id=0）的六类成果节点
// 一次性整批拷贝为本组模板；之后组管全权管理本组，超管后续增删改全局不再影响已建组。
// 幂等：重复执行/并发冲突（ER_DUP_ENTRY）跳过。
async function initGroupTemplates(groupId) {
  for (const type of TYPES) {
    const globals = await achievementStageTemplateRepository.listAll(0, type)
    for (const g of globals) {
      try {
        await achievementStageTemplateRepository.create({
          group_id: groupId,
          type: g.type,
          node_key: g.node_key,
          node_name: g.node_name,
          sort_order: Number(g.sort_order),
          enabled: Number(g.enabled)
        })
      } catch (e) {
        if (e && e.code === 'ER_DUP_ENTRY') continue
        throw e
      }
    }
  }
}

// 模板列表（管理视图，含停用项）：组管=本组；超管=全局
async function listTemplates({ type }, viewer) {
  const me = await currentUser()
  const scope = await assertTemplateScope(me)
  const t = String(type || '')
  if (!TYPES.includes(t)) throw new ApiError('成果类型不合法', 400)
  const list = await achievementStageTemplateRepository.listAll(scope, t)
  return {
    groupId: scope,
    type: t,
    typeLabel: TYPE_LABELS[t] || t,
    list: list.map((n) => ({
      id: n.id,
      nodeKey: n.node_key,
      nodeName: n.node_name,
      sortOrder: Number(n.sort_order),
      enabled: Number(n.enabled) === 1
    }))
  }
}

// 新增/更新模板节点（组管=本组，超管=全局）
async function saveTemplate({ id, type, nodeKey, nodeName, sortOrder, enabled }, viewer) {
  const me = await currentUser()
  const scope = await assertTemplateScope(me)
  const t = String(type || '')
  if (!TYPES.includes(t)) throw new ApiError('成果类型不合法', 400)
  const name = String(nodeName == null ? '' : nodeName).trim().slice(0, 100)
  if (!name) throw new ApiError('请输入节点名称', 400)
  const key = String(nodeKey || '').trim().slice(0, 50)
  if (!key) throw new ApiError('缺少节点标识', 400)
  const order = Number.isInteger(Number(sortOrder)) ? Number(sortOrder) : 0
  const isEnabled = enabled === false ? 0 : 1

  if (id) {
    const existing = await achievementStageTemplateRepository.findById(Number(id))
    if (!existing) throw new ApiError('模板节点不存在', 404)
    if (Number(existing.group_id) !== scope) {
      throw new ApiError('无权限：只能维护本范围模板', 403)
    }
    await achievementStageTemplateRepository.update(Number(id), {
      node_name: name,
      node_key: key,
      sort_order: order,
      enabled: isEnabled
    })
    return { id: Number(id), created: false }
  }
  const dup = await achievementStageTemplateRepository.findByGroupTypeNode(scope, t, key)
  if (dup) throw new ApiError('该节点标识已存在', 400)
  const newId = await achievementStageTemplateRepository.create({
    group_id: scope,
    type: t,
    node_key: key,
    node_name: name,
    sort_order: order,
    enabled: isEnabled
  })
  return { id: newId, created: true }
}

// 停用/启用模板节点（组管/超管；停用后成果时间线隐藏，已填历史保留）
async function toggleTemplate(id, enabled, viewer) {
  const me = await currentUser()
  const scope = await assertTemplateScope(me)
  const tpl = await achievementStageTemplateRepository.findById(Number(id))
  if (!tpl) throw new ApiError('模板节点不存在', 404)
  if (Number(tpl.group_id) !== scope) {
    throw new ApiError('无权限：只能维护本范围模板', 403)
  }
  await achievementStageTemplateRepository.update(Number(id), { enabled: enabled ? 1 : 0 })
  return { success: true }
}

// 彻底删除模板节点（组管/超管；已填记录保留 node_name 快照不受影响）
async function removeTemplate(id, viewer) {
  const me = await currentUser()
  const scope = await assertTemplateScope(me)
  const tpl = await achievementStageTemplateRepository.findById(Number(id))
  if (!tpl) throw new ApiError('模板节点不存在', 404)
  if (Number(tpl.group_id) !== scope) {
    throw new ApiError('无权限：只能维护本范围模板', 403)
  }
  await achievementStageTemplateRepository.delete(Number(id))
  return { success: true }
}

// ===== 成果时间线 =====

// 某成果的时间进度：模板节点 × 节点记录合并（未填节点显示为待填写）
async function recordsOf(achievementId, viewer) {
  const me = await currentUser()
  const row = await achievementRepository.findByIdWithOwner(Number(achievementId))
  if (!row) throw new ApiError('成果不存在', 404)
  await assertCanViewAchievement(row, me)
  const nodes = await resolveStageNodes(row.group_id, row.type)
  const records = await achievementStageRecordRepository.listByAchievement(Number(achievementId))
  const byKey = new Map(records.map((r) => [r.node_key, r]))
  const timeline = nodes.map((t, idx) => {
    const rec = byKey.get(t.node_key)
    return {
      sortOrder: idx + 1,
      nodeKey: t.node_key,
      nodeName: t.node_name,
      record: rec
        ? {
            id: rec.id,
            status: rec.status,
            happenDate: fmtDate(rec.happen_date),
            remark: rec.remark,
            rejectReason: rec.reject_reason,
            createdBy: Number(rec.created_by),
            reviewedBy: rec.reviewed_by == null ? null : Number(rec.reviewed_by),
            reviewedAt: rec.reviewed_at ? String(rec.reviewed_at).slice(0, 10) : null
          }
        : null
    }
  })
  return {
    achievementId: Number(achievementId),
    type: row.type,
    typeLabel: TYPE_LABELS[row.type] || row.type,
    timeline
  }
}

// ===== 学生填写 / 提交 =====

// 填写/修改节点时间（仅学生本人；成果 confirmed 冻结；节点已确认需导师退回后重填）
async function saveRecord({ achievementId, nodeKey, happenDate, remark }, viewer) {
  const me = await currentUser()
  if (me.role !== ROLE_STUDENT) throw new ApiError('无权限：仅学生本人可填写成果进度', 403)
  const row = await achievementRepository.findByIdWithOwner(Number(achievementId))
  if (!row) throw new ApiError('成果不存在', 404)
  if (me.id !== Number(row.user_id)) throw new ApiError('无权限：只能填写自己的成果', 403)
  if (row.status === 'confirmed') throw new ApiError('成果已确认，时间进度已冻结', 400)

  const nodes = await resolveStageNodes(row.group_id, row.type)
  const tpl = nodes.find((n) => n.node_key === nodeKey)
  if (!tpl) throw new ApiError('节点不存在或已停用', 400)

  const existing = await achievementStageRecordRepository.findByAchievementNode(Number(achievementId), String(nodeKey))
  if (existing && existing.status === 'confirmed') {
    throw new ApiError('该节点已被导师确认，如需修改请导师退回后重填', 400)
  }

  const h = fmtDate(happenDate)
  const patch = {}
  patch.happen_date = h
  patch.remark = String(remark == null ? '' : remark).trim().slice(0, 500) || null
  patch.status = 'pending'
  patch.reject_reason = null
  patch.created_by = me.id
  // 模板快照（改名/改类型不影响历史）
  patch.node_name = tpl.node_name
  patch.type = row.type
  patch.group_id = row.group_id

  const id = await achievementStageRecordRepository.upsertByAchievementNode(Number(achievementId), String(nodeKey), patch)
  return { id: id || (existing && existing.id) || null }
}

// 通知：学生提交节点 → 通知该生当前导师（mentor_id）审核；失败不影响主流程
async function notifySubmitToMentor(rec, achievementTitle) {
  try {
    const owner = await userRepository.findById(Number(rec.created_by))
    if (!owner || !owner.mentor_id) return
    const name = owner.real_name || owner.username
    await notificationService.createForUsers({
      recipients: [Number(owner.mentor_id)],
      typeKey: 'achievement_stage_submit',
      title: `学生「${name}」提交了成果「${achievementTitle}」的进度节点「${rec.node_name}」`,
      summary: '请在科研成果中确认或退回',
      bizType: 'achievement',
      bizId: Number(rec.achievement_id),
      groupId: rec.group_id == null ? null : Number(rec.group_id)
    })
  } catch (e) {
    // 通知失败不阻断提交
  }
}

// 提交节点：pending → submitted（待导师审核）
async function submitRecord(recordId, viewer) {
  const me = await currentUser()
  if (me.role !== ROLE_STUDENT) throw new ApiError('无权限：仅学生本人可提交进度', 403)
  const rec = await achievementStageRecordRepository.findByIdWithOwner(Number(recordId))
  if (!rec) throw new ApiError('记录不存在', 404)
  const row = await achievementRepository.findByIdWithOwner(Number(rec.achievement_id))
  if (!row) throw new ApiError('成果不存在', 404)
  if (me.id !== Number(row.user_id)) throw new ApiError('无权限：只能提交自己的成果进度', 403)
  if (rec.status === 'confirmed') throw new ApiError('该节点已确认，无需提交', 400)
  await achievementStageRecordRepository.updateStatus(rec.id, rec.achievement_id, 'submitted', { reject_reason: null })
  await notifySubmitToMentor(rec, row.title)
  return { success: true }
}

// ===== 导师确认 / 退回 =====

// 确认节点：submitted → confirmed（记录审核人）
async function confirmRecord(recordId, viewer) {
  const me = await currentUser()
  if (me.role !== ROLE_MENTOR) throw new ApiError('无权限：仅导师可确认', 403)
  const rec = await achievementStageRecordRepository.findByIdWithOwner(Number(recordId))
  if (!rec) throw new ApiError('记录不存在', 404)
  const row = await achievementRepository.findByIdWithOwner(Number(rec.achievement_id))
  if (!row) throw new ApiError('成果不存在', 404)
  await assertCanViewAchievement(row, me)
  if (rec.status !== 'submitted') throw new ApiError('仅可确认已提交的节点', 400)
  await achievementStageRecordRepository.updateStatus(rec.id, rec.achievement_id, 'confirmed', {
    reject_reason: null,
    reviewed_by: me.id,
    reviewed_at: new Date()
  })
  return { success: true }
}

// 退回节点：submitted/confirmed → pending + 退回意见（通知学生）
async function returnRecord(recordId, reason, viewer) {
  const me = await currentUser()
  if (me.role !== ROLE_MENTOR) throw new ApiError('无权限：仅导师可退回', 403)
  const rec = await achievementStageRecordRepository.findByIdWithOwner(Number(recordId))
  if (!rec) throw new ApiError('记录不存在', 404)
  const row = await achievementRepository.findByIdWithOwner(Number(rec.achievement_id))
  if (!row) throw new ApiError('成果不存在', 404)
  await assertCanViewAchievement(row, me)
  if (rec.status === 'pending') throw new ApiError('该节点尚未提交', 400)
  const r = String(reason == null ? '' : reason).trim().slice(0, 255)
  if (!r) throw new ApiError('请填写退回意见', 400)
  await achievementStageRecordRepository.updateStatus(rec.id, rec.achievement_id, 'pending', {
    reject_reason: r,
    reviewed_by: me.id,
    reviewed_at: new Date()
  })
  try {
    await notificationService.createForUsers({
      recipients: [Number(row.user_id)],
      typeKey: 'achievement_stage_return',
      title: `成果「${row.title}」的进度节点「${rec.node_name}」被退回`,
      summary: `退回意见：${r}`,
      bizType: 'achievement',
      bizId: Number(rec.achievement_id),
      groupId: rec.group_id == null ? null : Number(rec.group_id)
    })
  } catch (e) {
    // 通知失败不阻断退回
  }
  return { success: true }
}

// ===== 级联清理 =====

// 删除成果时清理（删除成果事务内调用）
async function deleteByAchievement(achievementId) {
  await achievementStageRecordRepository.deleteByAchievement(Number(achievementId))
}

// 删除学生时清理（删除用户事务内调用）
async function deleteByUser(userId) {
  await achievementStageRecordRepository.deleteByUser(Number(userId))
}

module.exports = {
  initGroupTemplates,
  listTemplates,
  saveTemplate,
  toggleTemplate,
  removeTemplate,
  recordsOf,
  saveRecord,
  submitRecord,
  confirmRecord,
  returnRecord,
  deleteByAchievement,
  deleteByUser
}
