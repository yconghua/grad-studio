/**
 * 课题服务（Service Layer）—— subject + subject_member
 *
 * 课题列表 / 成员列表全员登录可见；课题与成员的增删改仅组管 / 导师。
 */
const permission = require('./permission')
const subjectRepository = require('../db/repositories/subjectRepository')
const subjectMemberRepository = require('../db/repositories/subjectMemberRepository')
const operationLogService = require('./operationLogService')

// subject:list —— 全员登录，按 group_id 过滤
async function list(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const groupId = payload && payload.group_id
  if (!groupId) return { success: false, message: '缺少课题组标识（group_id）' }
  try {
    const data = await subjectRepository.listByGroup(groupId)
    return { success: true, data }
  } catch (err) {
    console.error('[subjectService.list] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// subject:create —— 仅组管 / 导师
async function create(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isManager()) return { success: false, message: '无权限：仅课题组管理员与导师可创建课题' }
  const body = payload || {}
  if (!body.group_id) return { success: false, message: '缺少课题组标识（group_id）' }
  if (!body.name || !String(body.name).trim()) return { success: false, message: '课题名称不能为空' }
  try {
    const id = await subjectRepository.create(body)
    operationLogService.writeLog({
      action: 'createSubject',
      targetType: 'subject',
      targetId: id,
      detail: `创建课题「${String(body.name).trim()}」`
    })
    return { success: true, message: '创建成功', data: { id } }
  } catch (err) {
    console.error('[subjectService.create] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// subject:update —— 仅组管 / 导师
async function update(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isManager()) return { success: false, message: '无权限：仅课题组管理员与导师可编辑课题' }
  const id = payload && payload.id
  if (!id) return { success: false, message: '缺少课题标识（id）' }
  try {
    await subjectRepository.update(id, payload || {})
    operationLogService.writeLog({
      action: 'updateSubject',
      targetType: 'subject',
      targetId: id,
      detail: '编辑课题'
    })
    return { success: true, message: '更新成功' }
  } catch (err) {
    console.error('[subjectService.update] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// subject:remove —— 仅组管 / 导师，软删除
async function remove(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isManager()) return { success: false, message: '无权限：仅课题组管理员与导师可删除课题' }
  const id = payload && payload.id
  if (!id) return { success: false, message: '缺少课题标识（id）' }
  try {
    await subjectRepository.delete(id)
    operationLogService.writeLog({
      action: 'removeSubject',
      targetType: 'subject',
      targetId: id,
      detail: '删除课题'
    })
    return { success: true, message: '已删除' }
  } catch (err) {
    console.error('[subjectService.remove] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// subject:list-members —— 全员登录，按 subject_id 列出课题成员
async function listMembers(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const subjectId = payload && payload.subject_id
  if (!subjectId) return { success: false, message: '缺少课题标识（subject_id）' }
  try {
    const data = await subjectMemberRepository.listBySubject(subjectId)
    return { success: true, data }
  } catch (err) {
    console.error('[subjectService.listMembers] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// subject:add-member —— 仅组管 / 导师，subject_id + user_id + role_in_subject
async function addMember(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isManager()) return { success: false, message: '无权限：仅课题组管理员与导师可添加课题成员' }
  const body = payload || {}
  if (!body.subject_id || !body.user_id) {
    return { success: false, message: '缺少课题标识（subject_id）或成员标识（user_id）' }
  }
  try {
    const exist = await subjectMemberRepository.findBySubjectUser(body.subject_id, body.user_id)
    if (exist) return { success: false, message: '该成员已在本课题中' }
    const id = await subjectMemberRepository.create(body)
    operationLogService.writeLog({
      action: 'addSubjectMember',
      targetType: 'subject_member',
      targetId: id,
      detail: `添加成员 ${body.user_id} 至课题 ${body.subject_id}`
    })
    return { success: true, message: '添加成功', data: { id } }
  } catch (err) {
    console.error('[subjectService.addMember] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// subject:remove-member —— 仅组管 / 导师，软删除成员记录
async function removeMember(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isManager()) return { success: false, message: '无权限：仅课题组管理员与导师可移除课题成员' }
  const id = payload && payload.id
  if (!id) return { success: false, message: '缺少成员记录标识（id）' }
  try {
    await subjectMemberRepository.delete(id)
    operationLogService.writeLog({
      action: 'removeSubjectMember',
      targetType: 'subject_member',
      targetId: id,
      detail: '移除课题成员'
    })
    return { success: true, message: '已移除' }
  } catch (err) {
    console.error('[subjectService.removeMember] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

module.exports = {
  list,
  create,
  update,
  remove,
  listMembers,
  addMember,
  removeMember
}
