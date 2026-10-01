/**
 * 课题组服务（Service Layer）—— 课题组设置 + 成员管理 + 导师学生关系
 *
 * 覆盖三类角色接口：
 *   - 超级管理员：全部课题组管理（增删改查，code 为后端生成的 UUID）；
 *   - 课题组管理员：仅本课题组的设置与成员管理（不能创建新用户，只能选择已有用户加入）；
 *   - 导师：仅查看自己名下的学生。
 * 权限闸门在 IPC 层（ipc/group.js）统一校验。
 */
const crypto = require('node:crypto')
const userRepository = require('../db/repositories/userRepository')
const groupRepository = require('../db/repositories/groupRepository')
const groupNoticeRepository = require('../db/repositories/groupNoticeRepository')
const groupNoticeReadRepository = require('../db/repositories/groupNoticeReadRepository')
const authService = require('./authService')
const userService = require('./userService')
const ApiError = require('./apiError')
const {
  ROLE_GROUP_ADMIN,
  ROLE_MENTOR,
  ROLE_STUDENT,
  ACCOUNT_STATUS_ENABLED
} = require('../../shared/constants')

// 行转 DTO（字段名转驼峰）
function toGroupDto(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description || '',
    adminUserId: row.admin_user_id == null ? null : Number(row.admin_user_id),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
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

// 当前课题组管理员绑定的课题组（校验存在）
async function ownGroup() {
  const me = await authService.getCurrentUser()
  if (!me) throw new ApiError('未登录，请重新登录', 401)
  const group = await groupRepository.findByAdminUserId(me.id)
  if (!group) throw new ApiError('当前账号未绑定课题组', 404)
  return group
}

// ===== 超级管理员：课题组管理 =====

/**
 * 课题组分页列表：关键字（名称/标识号）过滤
 */
async function listGroups({ page, keyword } = {}) {
  const result = await groupRepository.pagedList({ page, keyword })
  return pageResult(result, toGroupDto)
}

// 课题组名称 / 描述长度校验（与 groups 表列宽一致：name 100、description 500）
function assertGroupName(name) {
  const trimmed = String(name).trim()
  if (!trimmed) throw new ApiError('请输入课题组名称', 400)
  if (trimmed.length > 100) throw new ApiError('课题组名称不能超过 100 个字符', 400)
  return trimmed
}
function assertGroupDescription(description) {
  const trimmed = description === undefined || description === null ? '' : String(description).trim()
  if (trimmed.length > 500) throw new ApiError('课题组描述不能超过 500 个字符', 400)
  return trimmed || null
}

/**
 * 新增课题组：后端生成 UUID 作为唯一标识号（code），前端不可指定；
 * adminUserId 指定的用户必须是未绑定其他课题组的课题组管理员。
 */
async function createGroup({ name, description, adminUserId, status } = {}) {
  const trimmedName = assertGroupName(name)
  const trimmedDesc = assertGroupDescription(description)
  if (adminUserId) {
    await assertAdminAvailable(Number(adminUserId))
  }
  const id = await groupRepository.create({
    name: trimmedName,
    code: crypto.randomUUID(),
    description: trimmedDesc,
    admin_user_id: adminUserId ? Number(adminUserId) : null,
    status: status === undefined || status === '' ? 1 : Number(status)
  })
  // 同步管理员用户的所属课题组
  if (adminUserId) await userRepository.updateById(Number(adminUserId), { group_id: id })
  return getGroup(id)
}

/**
 * 新增 / 更换课题组管理员时的可用性校验
 */
async function assertAdminAvailable(adminUserId) {
  const admin = await userRepository.findById(adminUserId)
  if (!admin || admin.role !== ROLE_GROUP_ADMIN) {
    throw new ApiError('所选用户不是课题组管理员', 400)
  }
  if (admin.group_id) throw new ApiError('该课题组管理员已绑定其他课题组', 400)
  const bound = await groupRepository.findByAdminUserId(adminUserId)
  if (bound) throw new ApiError('该课题组管理员已绑定其他课题组', 400)
}

/**
 * 课题组详情
 */
async function getGroup(id) {
  const row = await groupRepository.findById(Number(id))
  if (!row) throw new ApiError('课题组不存在', 404)
  return toGroupDto(row)
}

/**
 * 编辑课题组：name / description / status / adminUserId 可改，
 * code（UUID）不可修改；更换管理员时同步解除旧管理员绑定。
 */
async function updateGroup(id, { name, description, adminUserId, status } = {}) {
  const idNum = Number(id)
  const row = await groupRepository.findById(idNum)
  if (!row) throw new ApiError('课题组不存在', 404)

  const data = {}
  if (name !== undefined) data.name = assertGroupName(name)
  if (description !== undefined) data.description = assertGroupDescription(description)
  if (status !== undefined) {
    const st = Number(status)
    if (st !== 0 && st !== 1) throw new ApiError('状态参数不合法', 400)
    data.status = st
  }

  let adminChanged = false
  if (adminUserId !== undefined) {
    const newAdmin = adminUserId === null || adminUserId === '' ? null : Number(adminUserId)
    if (newAdmin !== row.admin_user_id) {
      if (newAdmin !== null) {
        await assertAdminAvailable(newAdmin)
      }
      data.admin_user_id = newAdmin
      adminChanged = true
    }
  }

  await groupRepository.updateById(idNum, data)

  // 同步新旧管理员用户的所属课题组
  if (adminChanged) {
    if (row.admin_user_id) await userRepository.updateById(row.admin_user_id, { group_id: null })
    if (data.admin_user_id !== null) await userRepository.updateById(data.admin_user_id, { group_id: idNum })
  }
  return getGroup(idNum)
}

/**
 * 删除课题组（物理删除）：课题组下仍有导师/学生成员时禁止删除；
 * 删除时解除管理员用户的课题组绑定，并级联硬删该组全部公告及其已读记录
 * （公告属于课题组，组删除公告一并删除）。
 */
async function deleteGroup(id) {
  const idNum = Number(id)
  const row = await groupRepository.findById(idNum)
  if (!row) throw new ApiError('课题组不存在', 404)
  const members = await userRepository.countByGroup(idNum)
  if (members > 0) throw new ApiError('课题组下仍有成员，请先移除全部成员后再删除', 400)
  // 解除管理员绑定后再删除课题组
  if (row.admin_user_id) await userRepository.updateById(row.admin_user_id, { group_id: null })
  // 级联硬删公告及其已读记录（先清已读，再删公告，最后删课题组）
  await groupNoticeReadRepository.deleteByGroupId(idNum)
  await groupNoticeRepository.deleteByGroupId(idNum)
  await groupRepository.deleteById(idNum)
  return true
}

// ===== 课题组管理员：本课题组 =====

/**
 * 本课题组信息（课题组管理员）：只能查看自己绑定的课题组
 */
async function getOwnGroup() {
  const group = await ownGroup()
  return toGroupDto(group)
}

/**
 * 本课题组设置保存：name / description 可改；
 * code（UUID）由超管创建时生成、adminUserId 由超管管理，本处不可修改。
 */
async function updateOwnGroup({ name, description } = {}) {
  const group = await ownGroup()
  const data = {}
  if (name !== undefined) data.name = assertGroupName(name)
  if (description !== undefined) data.description = assertGroupDescription(description)
  await groupRepository.updateById(group.id, data)
  return getGroup(group.id)
}

/**
 * 本课题组成员列表：仅本组导师 / 学生（组管理员自身不计入成员），
 * 可按角色、关键字过滤
 */
async function listMembers({ page, keyword, role } = {}) {
  const group = await ownGroup()
  if (role && ![ROLE_MENTOR, ROLE_STUDENT].includes(role)) throw new ApiError('角色参数不合法', 400)
  const result = await userRepository.pagedList({
    page,
    keyword,
    role,
    roles: role ? undefined : [ROLE_MENTOR, ROLE_STUDENT],
    groupId: group.id,
    status: ACCOUNT_STATUS_ENABLED
  })
  return pageResult(result, userService.toUserDto)
}

/**
 * 选择已有用户加入本课题组（课题组管理员不能创建新用户）：
 * 只能加入导师 / 学生角色，且目标用户必须未入组。
 */
async function addMembers({ userIds, role } = {}) {
  const group = await ownGroup()
  if (!Array.isArray(userIds) || userIds.length === 0) throw new ApiError('请选择要加入的用户', 400)
  if (![ROLE_MENTOR, ROLE_STUDENT].includes(role)) throw new ApiError('角色参数不合法', 400)

  let added = 0
  for (const uid of userIds) {
    const u = await userRepository.findById(Number(uid))
    if (!u || u.status !== ACCOUNT_STATUS_ENABLED) continue
    if (u.role !== role) {
      throw new ApiError(`用户「${u.username}」不是${role === ROLE_MENTOR ? '导师' : '学生'}角色`, 400)
    }
    if (u.group_id) {
      throw new ApiError(`用户「${u.username}」已属于其他课题组`, 400)
    }
    await userRepository.updateById(Number(uid), { group_id: group.id })
    added++
  }
  return { added }
}

/**
 * 移除本课题组成员：导师名下还有学生时禁止移除；学生移除时同步解除导师关系。
 */
async function removeMember(userId) {
  const group = await ownGroup()
  const idNum = Number(userId)
  const u = await userRepository.findById(idNum)
  if (!u) throw new ApiError('用户不存在', 404)
  if (u.group_id !== group.id) throw new ApiError('该用户不属于当前课题组', 400)

  if (u.role === ROLE_MENTOR) {
    const { total } = await userRepository.pagedStudentsByMentor(idNum, {})
    if (total > 0) throw new ApiError('该导师名下还有学生，请先重新指定导师后再移除', 400)
  }
  const data = { group_id: null }
  if (u.role === ROLE_STUDENT) data.mentor_id = null
  await userRepository.updateById(idNum, data)
  return true
}

/**
 * 批量移除本课题组成员（课题组管理员）：逐条复用单条移除逻辑，
 * 一条失败不影响其余；不能移除当前登录账号（组管自身）。
 * 返回 { successCount, failCount, failList: [{ id, reason }] }
 */
async function batchRemoveMembers(ids) {
  const me = await authService.getCurrentUser()
  if (!me) throw new ApiError('未登录，请重新登录', 401)
  if (!Array.isArray(ids) || ids.length === 0) throw new ApiError('请选择要移除的成员', 400)

  let successCount = 0
  const failList = []
  for (const rawId of ids) {
    const idNum = Number(rawId)
    try {
      if (me.id === idNum) throw new ApiError('不能移除当前登录账号', 400)
      await removeMember(idNum)
      successCount++
    } catch (e) {
      failList.push({ id: idNum, reason: (e && e.message) ? e.message : '移除失败' })
    }
  }
  return { successCount, failCount: failList.length, failList }
}

/**
 * 批量给学生指定导师（课题组管理员）：仅对「属于本组的学生」生效，
 * 非学生跳过进 failList；已绑定其他导师的直接覆盖并计入 replacedCount。
 * 导师先整体校验（存在 / mentor 角色 / 属于本组）。
 */
async function batchAssignMentor(ids, mentorId) {
  const group = await ownGroup()
  if (!Array.isArray(ids) || ids.length === 0) throw new ApiError('请选择要指定导师的学生', 400)
  const mid = Number(mentorId)
  if (!mid) throw new ApiError('请选择导师', 400)
  const mentor = await userRepository.findById(mid)
  if (!mentor || mentor.role !== ROLE_MENTOR) throw new ApiError('所选导师不存在', 400)
  if (mentor.group_id !== group.id) throw new ApiError('导师与学生必须属于同一课题组', 400)

  let successCount = 0
  let replacedCount = 0
  const failList = []
  for (const rawId of ids) {
    const idNum = Number(rawId)
    try {
      const student = await userRepository.findById(idNum)
      if (!student) throw new ApiError('用户不存在', 404)
      if (student.role !== ROLE_STUDENT) throw new ApiError('仅学生可指定导师，非学生已跳过', 400)
      if (student.group_id !== group.id) throw new ApiError('该学生不属于当前课题组', 400)
      if (student.mentor_id) replacedCount++
      await userRepository.updateById(idNum, { mentor_id: mid })
      successCount++
    } catch (e) {
      failList.push({ id: idNum, reason: (e && e.message) ? e.message : '操作失败' })
    }
  }
  return { successCount, replacedCount, failCount: failList.length, failList }
}

/**
 * 本课题组学生列表（分页）
 */
async function listStudents({ page, keyword } = {}) {
  const group = await ownGroup()
  const result = await userRepository.pagedStudentsByGroup(group.id, { page, keyword })
  return pageResult(result, userService.toUserDto)
}

/**
 * 给学生指定导师：学生与导师必须同属本课题组；一个学生只能有一个导师。
 * mentorId 传空表示取消指定。
 */
async function setStudentMentor(studentId, { mentorId } = {}) {
  const group = await ownGroup()
  const student = await userRepository.findById(Number(studentId))
  if (!student || student.role !== ROLE_STUDENT) throw new ApiError('学生不存在', 404)
  if (student.group_id !== group.id) throw new ApiError('该学生不属于当前课题组', 400)

  if (mentorId === undefined || mentorId === null || mentorId === '') {
    await userRepository.updateById(Number(studentId), { mentor_id: null })
    return userService.getUser(studentId)
  }
  const mentor = await userRepository.findById(Number(mentorId))
  if (!mentor || mentor.role !== ROLE_MENTOR) throw new ApiError('导师不存在', 400)
  if (mentor.group_id !== group.id) throw new ApiError('导师与学生必须属于同一课题组', 400)
  await userRepository.updateById(Number(studentId), { mentor_id: Number(mentorId) })
  return userService.getUser(studentId)
}

// ===== 导师：我的学生 =====

/**
 * 当前导师名下的学生（分页）：只能查看自己的学生
 */
async function listMentorStudents({ page, keyword } = {}) {
  const me = await authService.getCurrentUser()
  if (!me) throw new ApiError('未登录，请重新登录', 401)
  const result = await userRepository.pagedStudentsByMentor(me.id, { page, keyword })
  return pageResult(result, userService.toUserDto)
}

module.exports = {
  listGroups,
  createGroup,
  getGroup,
  updateGroup,
  deleteGroup,
  getOwnGroup,
  updateOwnGroup,
  listMembers,
  addMembers,
  removeMember,
  batchRemoveMembers,
  batchAssignMentor,
  listStudents,
  setStudentMentor,
  listMentorStudents,
  toGroupDto
}
