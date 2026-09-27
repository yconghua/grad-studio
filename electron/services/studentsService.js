/**
 * 师生关系服务（Service Layer）—— 模块 students
 *
 * 导师查自己名下学生；组管理员查全组师生关系。
 * 绑定 / 解绑：组管理员可操作任意师生关系；导师只能操作自己名下（mentor_id = currentUserId）。
 */
const permission = require('./permission')
const { ROLE_MENTOR } = require('../../shared/constants')
const mentorStudentRepository = require('../db/repositories/mentorStudentRepository')
const operationLogService = require('./operationLogService')

// 学生列表：导师仅看自己名下（active）；组管理员需传 group_id 看全组
async function list(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  try {
    const role = permission.currentRole()
    let rows
    if (role === ROLE_MENTOR) {
      // 导师：固定取本人名下 active 学生
      rows = await mentorStudentRepository.listByMentor(permission.currentUserId(), 'active')
    } else if (permission.isGroupAdmin()) {
      const { group_id } = payload || {}
      if (!group_id) return { success: false, message: '缺少课题组标识' }
      rows = await mentorStudentRepository.listByGroup(group_id)
    } else {
      return { success: false, message: '无权限：仅导师或课题组管理员可查看学生列表' }
    }
    return { success: true, students: rows }
  } catch (err) {
    console.error('[studentsService.list] 数据库异常:', err)
    return { success: false, message: '读取失败，请稍后重试' }
  }
}

// 绑定师生关系：组管理员可任意绑定；导师只能绑自己名下（mentor_id 强制取本人）
async function bind(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isManager()) return { success: false, message: '无权限：仅导师或课题组管理员可绑定学生' }
  const { student_id, group_id } = payload || {}
  if (!student_id || !group_id) return { success: false, message: '缺少学生或课题组标识' }
  const myId = permission.currentUserId()
  // 导师强制只能绑自己；组管理员可显式指定 mentor_id，缺省用自己
  let mentorId = permission.isGroupAdmin() ? (payload.mentor_id || myId) : myId
  if (permission.currentRole() === ROLE_MENTOR) mentorId = myId
  try {
    const dup = await mentorStudentRepository.findByMentorAndStudent(mentorId, student_id)
    if (dup) return { success: false, message: '该师生关系已存在' }
    const data = mentorStudentRepository.pick({
      group_id,
      mentor_id: mentorId,
      student_id,
      remark: payload && payload.remark
    })
    const id = await mentorStudentRepository.create(data)
    operationLogService.writeLog({
      action: 'bindStudent',
      targetType: 'mentor_student',
      targetId: id,
      detail: `绑定师生关系：导师 ${mentorId} → 学生 ${student_id}`
    })
    return { success: true, message: '绑定成功', id }
  } catch (err) {
    console.error('[studentsService.bind] 数据库异常:', err)
    return { success: false, message: '绑定失败，请稍后重试' }
  }
}

// 解除绑定（软删除）：组管理员任意；导师只能解除自己名下
async function unbind(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isManager()) return { success: false, message: '无权限：仅导师或课题组管理员可解除绑定' }
  const { id } = payload || {}
  if (!id) return { success: false, message: '缺少关系标识' }
  try {
    const exist = await mentorStudentRepository.findById(id)
    if (!exist) return { success: false, message: '关系记录不存在' }
    // 导师只能解除自己名下的学生
    if (permission.currentRole() === ROLE_MENTOR && exist.mentor_id !== permission.currentUserId()) {
      return { success: false, message: '无权限：只能解除自己名下学生的绑定' }
    }
    await mentorStudentRepository.delete(id)
    operationLogService.writeLog({
      action: 'unbindStudent',
      targetType: 'mentor_student',
      targetId: id,
      detail: `解除师生关系：导师 ${exist.mentor_id} / 学生 ${exist.student_id}`
    })
    return { success: true, message: '已解除绑定' }
  } catch (err) {
    console.error('[studentsService.unbind] 数据库异常:', err)
    return { success: false, message: '解除失败，请稍后重试' }
  }
}

module.exports = { list, bind, unbind }
