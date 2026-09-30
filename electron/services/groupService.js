/**
 * 课题组服务（Service Layer）—— 模块 group
 *
 * 课题组是平台级组织单位，仅超级管理员可增删改查；列表支持按名称/编号关键字与状态过滤。
 */
const permission = require('./permission')
const groupRepository = require('../db/repositories/groupRepository')
const userGroupRepository = require('../db/repositories/userGroupRepository')
const userRepository = require('../db/repositories/userRepository')
const operationLogService = require('./operationLogService')
const { runTransaction } = require('../db/connection')
const { ROLE_GROUP_ADMIN } = require('../../shared/constants')

// 当前登录用户所属课题组列表（登录用户可用；含组内角色 role_in_group，供页头课题组选择器使用）
async function listMine() {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  try {
    const groups = await userGroupRepository.listGroupsByUser(permission.currentUserId())
    return { success: true, groups }
  } catch (err) {
    console.error('[groupService.listMine] 数据库异常:', err)
    return { success: false, message: '读取失败，请稍后重试' }
  }
}

// 超级管理员查看任意用户所属课题组（成员资料「所属课题组」tab 数据源）
async function listByUser(userId) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isAdmin()) return { success: false, message: '无权限：仅超级管理员可查看' }
  const targetId = Number(userId)
  if (!targetId) return { success: false, message: '参数错误' }
  try {
    const groups = await userGroupRepository.listGroupsByUser(targetId)
    return { success: true, groups }
  } catch (err) {
    console.error('[groupService.listByUser] 数据库异常:', err)
    return { success: false, message: '读取失败，请稍后重试' }
  }
}

// 课题组列表（仅超级管理员）
async function list(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isAdmin()) return { success: false, message: '无权限：仅超级管理员可管理课题组' }
  try {
    const groups = await groupRepository.list(payload || {})
    return { success: true, groups }
  } catch (err) {
    console.error('[groupService.list] 数据库异常:', err)
    return { success: false, message: '读取失败，请稍后重试' }
  }
}

// 新增课题组（仅超级管理员；created_by 取当前登录用户）。
// admin_user_id 必填：指定该课题组的初始管理员（须为课题组管理员角色），建组事务内写入 user_group（组内角色 group_admin）。
async function create(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isAdmin()) return { success: false, message: '无权限：仅超级管理员可管理课题组' }
  const { name, code, admin_user_id } = payload || {}
  if (!name || !String(name).trim()) return { success: false, message: '课题组名称不能为空' }
  if (!code || !String(code).trim()) return { success: false, message: '课题组编号不能为空' }
  if (!admin_user_id) return { success: false, message: '请选择课题组管理员' }
  const adminUser = await userRepository.findById(Number(admin_user_id))
  if (!adminUser) return { success: false, message: '指定的课题组管理员账号不存在' }
  if (adminUser.role !== ROLE_GROUP_ADMIN) return { success: false, message: '课题组管理员必须为课题组管理员角色' }
  try {
    const dup = await groupRepository.findByCode(String(code).trim())
    if (dup) return { success: false, message: '课题组编号已存在' }
    const data = groupRepository.pick(payload)
    data.created_by = permission.currentUserId()
    let id = 0
    let adminName = ''
    await runTransaction(async () => {
      id = await groupRepository.create(data)
      const exist = await userGroupRepository.findByUserAndGroup(adminUser.id, id)
      if (exist) throw new Error('该用户已是本组成员')
      await userGroupRepository.create({
        user_id: adminUser.id,
        group_id: id,
        role_in_group: 'group_admin',
        status: 'active',
        joined_at: new Date()
      })
      adminName = adminUser.username
    })
    operationLogService.writeLog({
      action: 'createGroup',
      targetType: 'group',
      targetId: id,
      detail: `创建课题组「${String(name).trim()}」（编号 ${String(code).trim()}），初始管理员：${adminName}`
    })
    return { success: true, message: `课题组已创建，管理员：${adminName}`, id }
  } catch (err) {
    console.error('[groupService.create] 数据库异常:', err)
    if (err && err.message === '该用户已是本组成员') return { success: false, message: err.message }
    return { success: false, message: '创建失败，请稍后重试' }
  }
}

// 编辑课题组（仅超级管理员；编号变更时查重）
async function update(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isAdmin()) return { success: false, message: '无权限：仅超级管理员可管理课题组' }
  const { id } = payload || {}
  if (!id) return { success: false, message: '缺少课题组标识' }
  try {
    const exist = await groupRepository.findById(id)
    if (!exist) return { success: false, message: '课题组不存在' }
    const data = groupRepository.pick(payload)
    delete data.created_by // 创建人不可变更
    if (data.code && data.code !== exist.code) {
      const dup = await groupRepository.findByCode(data.code, id)
      if (dup) return { success: false, message: '课题组编号已存在' }
    }
    if (Object.keys(data).length) {
      await groupRepository.update(id, data)
    }
    operationLogService.writeLog({
      action: 'updateGroup',
      targetType: 'group',
      targetId: id,
      detail: `编辑课题组「${exist.name}」`
    })
    return { success: true, message: '保存成功' }
  } catch (err) {
    console.error('[groupService.update] 数据库异常:', err)
    return { success: false, message: '更新失败，请稍后重试' }
  }
}

// 软删除课题组（仅超级管理员）
async function remove(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isAdmin()) return { success: false, message: '无权限：仅超级管理员可管理课题组' }
  const { id } = payload || {}
  if (!id) return { success: false, message: '缺少课题组标识' }
  try {
    const exist = await groupRepository.findById(id)
    if (!exist) return { success: false, message: '课题组不存在' }
    await groupRepository.delete(id)
    operationLogService.writeLog({
      action: 'removeGroup',
      targetType: 'group',
      targetId: id,
      detail: `删除课题组「${exist.name}」`
    })
    return { success: true, message: '已删除' }
  } catch (err) {
    console.error('[groupService.remove] 数据库异常:', err)
    return { success: false, message: '删除失败，请稍后重试' }
  }
}

module.exports = { listMine, listByUser, list, create, update, remove }
