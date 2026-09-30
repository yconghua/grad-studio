/**
 * 师生关系服务（Service Layer）—— 模块 students
 *
 * 导师查自己名下学生；组管理员查全组师生关系。
 * 绑定 / 解绑：组管理员可操作任意师生关系；导师只能操作自己名下（mentor_id = currentUserId）。
 */
const permission = require('./permission')
const { ROLE_MENTOR, ROLE_STUDENT } = require('../../shared/constants')
const mentorStudentRepository = require('../db/repositories/mentorStudentRepository')
const userGroupRepository = require('../db/repositories/userGroupRepository')
const userRepository = require('../db/repositories/userRepository')
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

// 我的指导老师：学生本人查询自己当前绑定的导师（个人资料页展示）
async function myMentor() {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (permission.currentRole() !== ROLE_STUDENT) return { success: false, message: '无权限' }
  try {
    const row = await mentorStudentRepository.findByStudent(permission.currentUserId())
    if (!row) return { success: true, mentor: null }
    return {
      success: true,
      mentor: {
        id: row.mentor_id,
        username: row.mentor_username,
        real_name: row.mentor_real_name || ''
      }
    }
  } catch (err) {
    console.error('[studentsService.myMentor] 数据库异常:', err)
    return { success: false, message: '读取失败，请稍后重试' }
  }
}

// 学生名单：供学位记录等场景选人。导师看自己名下（active）；
// 组管理员 / 超管看所选课题组内全局角色为 student 的成员（user_group.role_in_group = student）
async function listGroupStudents(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const { group_id } = payload || {}
  if (!group_id) return { success: false, message: '缺少课题组标识' }
  const role = permission.currentRole()
  if (role === ROLE_STUDENT) return { success: false, message: '无权限：仅导师或课题组管理员可查看学生名单' }
  try {
    let rows
    if (role === ROLE_MENTOR) {
      rows = await mentorStudentRepository.listByMentor(permission.currentUserId(), 'active')
    } else {
      const members = await userGroupRepository.listByGroup({ group_id, role_in_group: 'student' })
      rows = members.map((m) => ({ student_id: m.user_id, student_username: m.username }))
    }
    return { success: true, students: rows }
  } catch (err) {
    console.error('[studentsService.listGroupStudents] 数据库异常:', err)
    return { success: false, message: '读取失败，请稍后重试' }
  }
}

// 绑定候选学生：当前组内 role_in_group=student，且尚未被任何导师绑定（active）的学生
async function listAvailableForBind(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isManager()) return { success: false, message: '无权限' }
  const { group_id } = payload || {}
  if (!group_id) return { success: false, message: '缺少课题组标识' }
  try {
    const members = await userGroupRepository.listByGroup({ group_id, role_in_group: 'student' })
    const relations = await mentorStudentRepository.listByGroup(group_id, 'active')
    const boundIds = new Set(relations.map((r) => Number(r.student_id)))
    const rows = members
      .filter((m) => !boundIds.has(Number(m.user_id)))
      .map((m) => ({
        id: m.user_id,
        username: m.username,
        real_name: m.real_name || ''
      }))
    return { success: true, students: rows }
  } catch (err) {
    console.error('[studentsService.listAvailableForBind] 数据库异常:', err)
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

// 超级管理员查看任意用户的师生关系（成员资料「师生关系」tab 数据源）：
// 导师 → 名下学生列表；学生 → 绑定的导师；组管 / 超管无师生关系。
async function listByUser(userId) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isAdmin()) return { success: false, message: '无权限：仅超级管理员可查看' }
  const targetId = Number(userId)
  if (!targetId) return { success: false, message: '参数错误' }
  try {
    const target = await userRepository.findById(targetId)
    if (!target) return { success: false, message: '用户不存在' }
    const result = { role: target.role }
    if (target.role === ROLE_MENTOR) {
      const students = await mentorStudentRepository.listByMentor(targetId, 'active')
      result.students = students.map((s) => ({
        student_id: s.student_id,
        username: s.student_username,
        real_name: s.student_real_name || '',
        group_id: s.group_id
      }))
    } else if (target.role === ROLE_STUDENT) {
      const row = await mentorStudentRepository.findByStudent(targetId)
      result.mentor = row
        ? {
            mentor_id: row.mentor_id,
            username: row.mentor_username,
            real_name: row.mentor_real_name || '',
            group_id: row.group_id
          }
        : null
    }
    return { success: true, ...result }
  } catch (err) {
    console.error('[studentsService.listByUser] 数据库异常:', err)
    return { success: false, message: '读取失败，请稍后重试' }
  }
}

module.exports = { list, listGroupStudents, listAvailableForBind, myMentor, bind, unbind, listByUser }
