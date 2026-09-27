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
