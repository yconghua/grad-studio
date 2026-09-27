/**
 * 成员服务（Service Layer）—— 模块 member
 *
 * 组管理员维护本组成员：列表 / 添加 / 改角色状态 / 移除。
 * 列表联 user 表取 username / role；唯一索引 (user_id, group_id) 防重复入组。
 */
const permission = require('./permission')
const userGroupRepository = require('../db/repositories/userGroupRepository')
const operationLogService = require('./operationLogService')

// 组内合法角色白名单
const VALID_ROLE_IN_GROUP = ['group_admin', 'mentor', 'student']

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

// 添加成员到组（仅组管理员）
async function add(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isGroupAdmin()) return { success: false, message: '无权限：仅课题组管理员可管理成员' }
  const { user_id, group_id, role_in_group } = payload || {}
  if (!user_id || !group_id) return { success: false, message: '缺少用户或课题组标识' }
  const role = VALID_ROLE_IN_GROUP.includes(role_in_group) ? role_in_group : 'student'
  try {
    const dup = await userGroupRepository.findByUserAndGroup(user_id, group_id)
    if (dup) return { success: false, message: '该用户已在本组中' }
    const data = userGroupRepository.pick({ user_id, group_id, role_in_group: role, remark: payload && payload.remark })
    data.joined_at = new Date()
    const id = await userGroupRepository.create(data)
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

// 修改组内角色 / 状态（仅组管理员）
async function update(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isGroupAdmin()) return { success: false, message: '无权限：仅课题组管理员可管理成员' }
  const { id, role_in_group, status, remark } = payload || {}
  if (!id) return { success: false, message: '缺少成员记录标识' }
  try {
    const exist = await userGroupRepository.findById(id)
    if (!exist) return { success: false, message: '成员记录不存在' }
    const data = {}
    if (role_in_group !== undefined) {
      data.role_in_group = VALID_ROLE_IN_GROUP.includes(role_in_group) ? role_in_group : exist.role_in_group
    }
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
      detail: `更新成员记录（角色 ${data.role_in_group || exist.role_in_group} / 状态 ${data.status || exist.status}）`
    })
    return { success: true, message: '保存成功' }
  } catch (err) {
    console.error('[memberService.update] 数据库异常:', err)
    return { success: false, message: '更新失败，请稍后重试' }
  }
}

// 从组移除（软删除 user_group 记录；仅组管理员）
async function remove(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isGroupAdmin()) return { success: false, message: '无权限：仅课题组管理员可管理成员' }
  const { id } = payload || {}
  if (!id) return { success: false, message: '缺少成员记录标识' }
  try {
    const exist = await userGroupRepository.findById(id)
    if (!exist) return { success: false, message: '成员记录不存在' }
    await userGroupRepository.delete(id)
    operationLogService.writeLog({
      action: 'removeMember',
      targetType: 'user_group',
      targetId: id,
      detail: `移除成员 ${exist.user_id} 出课题组 ${exist.group_id}`
    })
    return { success: true, message: '已移除' }
  } catch (err) {
    console.error('[memberService.remove] 数据库异常:', err)
    return { success: false, message: '移除失败，请稍后重试' }
  }
}

module.exports = { list, add, update, remove }
