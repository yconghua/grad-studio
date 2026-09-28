/**
 * 成果 Service（Service Layer）—— achievement:* / paper:* 通道的业务逻辑
 *
 * 学生侧：我的成果列表 / 申报 / 编辑待审 / 删除 / 论文子记录维护；
 * 教师侧（group_admin / mentor）：审核 / 全组列表。
 */
const permission = require('./permission')
const achievementRepository = require('../db/repositories/achievementRepository')
const paperRepository = require('../db/repositories/paperRepository')
const userGroupRepository = require('../db/repositories/userGroupRepository')
const operationLogService = require('./operationLogService')
const messageService = require('./messageService')

// ===== 成果 achievement =====

// 列出我的成果
async function listMine() {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const userId = permission.currentUserId()
  try {
    const data = await achievementRepository.listByUser(userId)
    return { success: true, data }
  } catch (err) {
    console.error('[achievementService.listMine] 数据库异常:', err)
    return { success: false, message: '读取成果列表失败，请稍后重试' }
  }
}

// 申报成果（初始 pending）
async function create(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const userId = permission.currentUserId()
  if (!payload.title || !String(payload.title).trim()) {
    return { success: false, message: '请填写成果标题' }
  }
  try {
    // 成果所属组按申报人所属课题组自动落（取第一个在组中的课题组；未入组时为 0）
    const myGroups = await userGroupRepository.listGroupsByUser(userId)
    const groupId = myGroups.length ? myGroups[0].id : 0
    const id = await achievementRepository.createForUser(userId, { ...payload, group_id: groupId })
    operationLogService.writeLog({
      action: 'createAchievement',
      targetType: 'achievement',
      targetId: id,
      detail: `申报成果「${String(payload.title).trim()}」（所属课题组 ${groupId}）`
    })
    return { success: true, data: { id }, message: '成果已申报，等待审核' }
  } catch (err) {
    console.error('[achievementService.create] 数据库异常:', err)
    return { success: false, message: '申报成果失败，请稍后重试' }
  }
}

// 更新本人待审核成果
async function update(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const userId = permission.currentUserId()
  const { id } = payload
  if (!id) return { success: false, message: '缺少成果 id' }
  try {
    const record = await achievementRepository.findById(id)
    if (!record || record.user_id !== userId) {
      return { success: false, message: '记录不存在或无权操作' }
    }
    if (record.status !== 'pending') {
      return { success: false, message: '仅待审核状态的成果可编辑' }
    }
    const affected = await achievementRepository.updateOwnedPending(id, userId, payload)
    return { success: true, data: { affected }, message: '成果已更新' }
  } catch (err) {
    console.error('[achievementService.update] 数据库异常:', err)
    return { success: false, message: '更新成果失败，请稍后重试' }
  }
}

// 删除本人成果（软删除）
async function remove(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const userId = permission.currentUserId()
  const { id } = payload
  if (!id) return { success: false, message: '缺少成果 id' }
  try {
    const record = await achievementRepository.findById(id)
    if (!record || record.user_id !== userId) {
      return { success: false, message: '记录不存在或无权操作' }
    }
    await achievementRepository.delete(id)
    return { success: true, message: '成果已删除' }
  } catch (err) {
    console.error('[achievementService.remove] 数据库异常:', err)
    return { success: false, message: '删除成果失败，请稍后重试' }
  }
}

// 教师审核成果（仅 group_admin / mentor）
async function review(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isManager()) return { success: false, message: '无审核权限' }
  const { id, status, audit_comment: auditComment, group_id: groupId } = payload
  if (!id) return { success: false, message: '缺少成果 id' }
  if (!['approved', 'rejected'].includes(status)) {
    return { success: false, message: '审核结果必须为 approved 或 rejected' }
  }
  if (!groupId) return { success: false, message: '缺少课题组标识（group_id）' }
  try {
    const record = await achievementRepository.findById(id)
    if (!record) return { success: false, message: '成果不存在' }
    if (Number(record.group_id) !== Number(groupId)) {
      return { success: false, message: '该成果不属于当前课题组' }
    }
    const ug = await userGroupRepository.findByUserAndGroup(permission.currentUserId(), Number(groupId))
    if (!ug || ug.status !== 'active' || ug.role_in_group === 'student') {
      return { success: false, message: '无权审核该组成果' }
    }
    const affected = await achievementRepository.review(id, {
      status,
      auditComment,
      auditBy: permission.currentUserId()
    })
    operationLogService.writeLog({
      action: 'reviewAchievement',
      targetType: 'achievement',
      targetId: id,
      detail: `审核成果「${record.title}」（结果 ${status}）`
    })
    // 站内通知：告知成果提交人审核结果
    if (record.user_id) {
      messageService.sendMessage({
        receiverId: record.user_id,
        msgType: 'achievement',
        title: status === 'approved' ? '成果审核通过' : '成果审核未通过',
        content: `您的成果「${record.title}」审核结果为：${status === 'approved' ? '通过' : '未通过'}`,
        refType: 'achievement',
        refId: id
      })
    }
    return { success: true, data: { affected }, message: '审核完成' }
  } catch (err) {
    console.error('[achievementService.review] 数据库异常:', err)
    return { success: false, message: '审核成果失败，请稍后重试' }
  }
}

// 列出本组成果（仅 group_admin / mentor，可按 status / ach_type 过滤；group_id 必传并校验归属）
async function listAll(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isManager()) return { success: false, message: '无查看权限' }
  const groupId = payload && payload.group_id
  if (!groupId) return { success: false, message: '缺少课题组标识（group_id）' }
  try {
    const ug = await userGroupRepository.findByUserAndGroup(permission.currentUserId(), Number(groupId))
    if (!ug || ug.status !== 'active' || ug.role_in_group === 'student') {
      return { success: false, message: '无权查看该组成果' }
    }
    const data = await achievementRepository.listAll({
      status: payload.status,
      achType: payload.ach_type,
      groupId
    })
    return { success: true, data }
  } catch (err) {
    console.error('[achievementService.listAll] 数据库异常:', err)
    return { success: false, message: '读取成果列表失败，请稍后重试' }
  }
}

// ===== 论文 paper（本人子记录） =====

// 列出论文：学生看本人；导师/组管传 group_id 时看全组
async function paperList(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const userId = permission.currentUserId()
  try {
    const groupId = payload && payload.group_id ? Number(payload.group_id) : null
    if (groupId && permission.isManager()) {
      const ug = await userGroupRepository.findByUserAndGroup(userId, groupId)
      if (!ug || ug.status !== 'active' || ug.role_in_group === 'student') {
        return { success: false, message: '无权查看该组论文' }
      }
      const data = await paperRepository.listByGroup(groupId)
      return { success: true, data }
    }
    const data = await paperRepository.listByUser(userId)
    return { success: true, data }
  } catch (err) {
    console.error('[achievementService.paperList] 数据库异常:', err)
    return { success: false, message: '读取论文列表失败，请稍后重试' }
  }
}

// 新增论文
async function paperCreate(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const userId = permission.currentUserId()
  if (!payload.title || !String(payload.title).trim()) {
    return { success: false, message: '请填写论文标题' }
  }
  try {
    const id = await paperRepository.createForUser(userId, payload)
    return { success: true, data: { id }, message: '论文记录已保存' }
  } catch (err) {
    console.error('[achievementService.paperCreate] 数据库异常:', err)
    return { success: false, message: '保存论文失败，请稍后重试' }
  }
}

// 更新本人论文
async function paperUpdate(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const userId = permission.currentUserId()
  const { id } = payload
  if (!id) return { success: false, message: '缺少论文 id' }
  try {
    const record = await paperRepository.findById(id)
    if (!record || record.user_id !== userId) {
      return { success: false, message: '记录不存在或无权操作' }
    }
    const affected = await paperRepository.updateOwned(id, userId, payload)
    return { success: true, data: { affected }, message: '论文已更新' }
  } catch (err) {
    console.error('[achievementService.paperUpdate] 数据库异常:', err)
    return { success: false, message: '更新论文失败，请稍后重试' }
  }
}

// 删除本人论文（软删除）
async function paperRemove(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const userId = permission.currentUserId()
  const { id } = payload
  if (!id) return { success: false, message: '缺少论文 id' }
  try {
    const record = await paperRepository.findById(id)
    if (!record || record.user_id !== userId) {
      return { success: false, message: '记录不存在或无权操作' }
    }
    await paperRepository.delete(id)
    return { success: true, message: '论文已删除' }
  } catch (err) {
    console.error('[achievementService.paperRemove] 数据库异常:', err)
    return { success: false, message: '删除论文失败，请稍后重试' }
  }
}

module.exports = {
  listMine,
  create,
  update,
  remove,
  review,
  listAll,
  paperList,
  paperCreate,
  paperUpdate,
  paperRemove
}
