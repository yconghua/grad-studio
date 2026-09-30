/**
 * 成员服务（Service Layer）—— 模块 member
 *
 * 组管理员维护本组成员：列表 / 添加 / 改角色状态 / 移除。
 * 列表联 user 表取 username / role；唯一索引 (user_id, group_id) 防重复入组。
 */
const permission = require('./permission')
const userGroupRepository = require('../db/repositories/userGroupRepository')
const userRepository = require('../db/repositories/userRepository')
const operationLogService = require('./operationLogService')
const { runTransaction } = require('../db/connection')
// 级联软删：移除成员时一并软删该成员在本组的组内关联数据
const userCascadeService = require('./userCascadeService')

// 按课题组列出成员（仅组管理员）
async function list(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isGroupAdmin()) return { success: false, message: '无权限：仅课题组管理员可管理成员' }
  const { group_id } = payload || {}
  if (!group_id) return { success: false, message: '缺少课题组标识' }
  try {
    const members = await userGroupRepository.listByGroup(payload || {})
    return { success: true, members }
  } catch (err) {
    console.error('[memberService.list] 数据库异常:', err)
    return { success: false, message: '读取失败，请稍后重试' }
  }
}

// 添加成员到组（仅组管理员）：组内角色按账号全局角色自动归类（导师→导师、学生→学生），不接收前端指定
async function add(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isGroupAdmin()) return { success: false, message: '无权限：仅课题组管理员可管理成员' }
  const { user_id, group_id } = payload || {}
  if (!user_id || !group_id) return { success: false, message: '缺少用户或课题组标识' }
  try {
    const dup = await userGroupRepository.findByUserAndGroup(user_id, group_id)
    if (dup) return { success: false, message: '该用户已在本组中' }
    const targetUser = await userRepository.findById(Number(user_id))
    if (!targetUser) return { success: false, message: '用户不存在' }
    // 组内角色自动归类：导师账号→导师、学生账号→学生；组管 / 超管账号不可作为成员添加
    const AUTO_ROLE = { mentor: 'mentor', student: 'student' }
    const role = AUTO_ROLE[targetUser.role]
    if (!role) return { success: false, message: '仅导师/学生账号可添加为成员' }
    // 学生 / 导师账号仅可属于一个课题组（组管 / 超管可管理多个组）：
    // 按账号全局角色判断，避免以其他组内角色绕过归属限制
    if (targetUser.role === 'student' || targetUser.role === 'mentor') {
      const other = await userGroupRepository.findActiveInOtherGroup(user_id, group_id)
      if (other) {
        const who = targetUser.role === 'student' ? '该学生' : '该导师'
        return { success: false, message: `${who}已属于课题组「${other.group_name || ('#' + other.group_id)}」，${who}不能重复加入` }
      }
    }
    const id = await addOrRestoreMembership(user_id, group_id, role, payload && payload.remark)
    operationLogService.writeLog({
      action: 'addMember',
      targetType: 'user_group',
      targetId: id,
      detail: `添加成员 ${user_id} 至课题组 ${group_id}（角色 ${role}）`
    })
    return { success: true, message: '成员已添加', id }
  } catch (err) {
    console.error('[memberService.add] 数据库异常:', err)
    return { success: false, message: '添加失败，请稍后重试' }
  }
}

// 修改成员状态 / 备注（仅组管理员）。组内角色由账号全局角色自动归类，编辑时不可变更
async function update(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isGroupAdmin()) return { success: false, message: '无权限：仅课题组管理员可管理成员' }
  const { id, status, remark } = payload || {}
  if (!id) return { success: false, message: '缺少成员记录标识' }
  try {
    const exist = await userGroupRepository.findById(id)
    if (!exist) return { success: false, message: '成员记录不存在' }
    const data = {}
    // role_in_group 忽略：组内角色只由账号全局角色自动归类（导师→导师、学生→学生），不允许在成员编辑中修改
    if (status !== undefined) {
      data.status = status
      if (status === 'left' && exist.status !== 'left') data.left_at = new Date()
    }
    if (remark !== undefined) data.remark = remark
    if (Object.keys(data).length) {
      await userGroupRepository.update(id, data)
    }
    operationLogService.writeLog({
      action: 'updateMember',
      targetType: 'user_group',
      targetId: id,
      detail: `更新成员记录（状态 ${data.status || exist.status}${data.remark !== undefined ? '，修改备注' : ''}）`
    })
    return { success: true, message: '保存成功' }
  } catch (err) {
    console.error('[memberService.update] 数据库异常:', err)
    return { success: false, message: '更新失败，请稍后重试' }
  }
}

// 从组移除（软删除成员记录 + 该成员在本组的组内关联数据；仅组管理员）
async function remove(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isGroupAdmin()) return { success: false, message: '无权限：仅课题组管理员可管理成员' }
  const { id } = payload || {}
  if (!id) return { success: false, message: '缺少成员记录标识' }
  try {
    const exist = await userGroupRepository.findById(id)
    if (!exist) return { success: false, message: '成员记录不存在' }
    // 级联软删：成员记录本身 + 该成员在本组的组内关联数据（指导关系 / 学位记录 / 任务 / 汇报 / 课题成员），同一事务内完成
    const result = await userCascadeService.softRemoveMember({
      userGroupId: exist.id,
      groupId: exist.group_id,
      userId: exist.user_id
    })
    if (!result.success) return result
    operationLogService.writeLog({
      action: 'removeMember',
      targetType: 'user_group',
      targetId: id,
      detail: `移除成员 ${exist.user_id} 出课题组 ${exist.group_id}（级联软删 ${result.data ? JSON.stringify(result.data.counts) : '组内关联数据'}）`
    })
    return { success: true, message: '已移除' }
  } catch (err) {
    console.error('[memberService.remove] 数据库异常:', err)
    return { success: false, message: '移除失败，请稍后重试' }
  }
}

// 超级管理员将用户加入课题组（成员资料「所属课题组」tab 变更操作）：
// 组管可同时属于多个组；导师 / 学生沿用「仅属一个组」约束，已在其他组时提示用替换操作；
// 组内角色按账号全局角色自动归类（组管→group_admin、导师→mentor、学生→student），不接收前端指定；超管不入组。
async function adminAdd(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isAdmin()) return { success: false, message: '无权限：仅超级管理员可操作' }
  const { user_id, group_id } = payload || {}
  if (!user_id || !group_id) return { success: false, message: '缺少用户或课题组标识' }
  try {
    const dup = await userGroupRepository.findByUserAndGroup(user_id, group_id)
    if (dup) return { success: false, message: '该用户已在本组中' }
    const targetUser = await userRepository.findById(Number(user_id))
    if (!targetUser) return { success: false, message: '用户不存在' }
    const AUTO_ROLE = { group_admin: 'group_admin', mentor: 'mentor', student: 'student' }
    const role = AUTO_ROLE[targetUser.role]
    if (!role) return { success: false, message: '超级管理员无需加入课题组' }
    if (targetUser.role === 'mentor' || targetUser.role === 'student') {
      const other = await userGroupRepository.findActiveInOtherGroup(user_id, group_id)
      if (other) {
        const who = targetUser.role === 'student' ? '该学生' : '该导师'
        return { success: false, message: `${who}已属于课题组「${other.group_name || ('#' + other.group_id)}」，请使用「替换课题组」操作` }
      }
    }
    const id = await addOrRestoreMembership(user_id, group_id, role, payload && payload.remark)
    operationLogService.writeLog({
      action: 'addMember',
      targetType: 'user_group',
      targetId: id,
      detail: `超级管理员将用户 ${user_id}（${targetUser.username}）加入课题组 ${group_id}（角色 ${role}）`
    })
    return { success: true, message: '已加入课题组', id }
  } catch (err) {
    console.error('[memberService.adminAdd] 数据库异常:', err)
    return { success: false, message: '加入失败，请稍后重试' }
  }
}

// 超级管理员将用户移出课题组（软删记录 + 级联清理该用户在组内的关联数据）
async function adminRemove(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isAdmin()) return { success: false, message: '无权限：仅超级管理员可操作' }
  const { id } = payload || {}
  if (!id) return { success: false, message: '缺少成员记录标识' }
  try {
    const exist = await userGroupRepository.findById(id)
    if (!exist) return { success: false, message: '成员记录不存在' }
    const result = await userCascadeService.softRemoveMember({
      userGroupId: exist.id,
      groupId: exist.group_id,
      userId: exist.user_id
    })
    if (!result.success) return result
    operationLogService.writeLog({
      action: 'removeMember',
      targetType: 'user_group',
      targetId: id,
      detail: `超级管理员将用户 ${exist.user_id} 移出课题组 ${exist.group_id}（级联软删 ${result.data ? JSON.stringify(result.data.counts) : '组内关联数据'}）`
    })
    return { success: true, message: '已移出课题组' }
  } catch (err) {
    console.error('[memberService.adminRemove] 数据库异常:', err)
    return { success: false, message: '移出失败，请稍后重试' }
  }
}

// 超级管理员原子替换组：导师 / 学生从当前组一步换到新组。
// 单事务内完成「清理旧组归属与组内关联数据 + 写入新组归属」，任一步失败整体回滚。
async function adminReplace(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isAdmin()) return { success: false, message: '无权限：仅超级管理员可操作' }
  const { user_id, group_id } = payload || {}
  if (!user_id || !group_id) return { success: false, message: '缺少用户或课题组标识' }
  try {
    const targetUser = await userRepository.findById(Number(user_id))
    if (!targetUser) return { success: false, message: '用户不存在' }
    if (targetUser.role === 'super_admin') return { success: false, message: '超级管理员无需加入课题组' }
    if (targetUser.role === 'group_admin') return { success: false, message: '课题组管理员支持多组，请使用「加入课题组」操作' }
    const dup = await userGroupRepository.findByUserAndGroup(user_id, group_id)
    if (dup) return { success: false, message: '该用户已在新组中' }
    // 当前在组记录（导师 / 学生仅一个组，排除新组后即为旧组）
    const old = await userGroupRepository.findActiveInOtherGroup(user_id, group_id)
    const role = targetUser.role === 'mentor' ? 'mentor' : 'student'
    const id = await runTransaction(async () => {
      if (old) {
        await userCascadeService.softRemoveMemberTx({
          userGroupId: old.id,
          groupId: old.group_id,
          userId: user_id
        })
      }
      return await addOrRestoreMembership(user_id, group_id, role, payload && payload.remark)
    })
    operationLogService.writeLog({
      action: 'replaceGroup',
      targetType: 'user_group',
      targetId: id,
      detail: `超级管理员将用户 ${user_id}（${targetUser.username}）由课题组 ${old ? old.group_id : '无'} 替换至课题组 ${group_id}（角色 ${role}）`
    })
    return { success: true, message: '已替换课题组', id }
  } catch (err) {
    console.error('[memberService.adminReplace] 数据库异常:', err)
    return { success: false, message: '替换失败，请稍后重试' }
  }
}

// 写入归属记录：存在软删 / 离组旧记录时恢复为在组（唯一索引对软删记录仍生效，直接新建会撞唯一键），否则新建
async function addOrRestoreMembership(userId, groupId, role, remark) {
  const any = await userGroupRepository.findAnyByUserAndGroup(userId, groupId)
  if (any) {
    await userGroupRepository.restore(any.id, {
      role_in_group: role,
      status: 'active',
      joined_at: new Date(),
      left_at: null,
      remark: remark || undefined
    })
    return any.id
  }
  const data = userGroupRepository.pick({ user_id: userId, group_id: groupId, role_in_group: role, remark })
  data.joined_at = new Date()
  return await userGroupRepository.create(data)
}

module.exports = { list, add, update, remove, adminAdd, adminRemove, adminReplace }
