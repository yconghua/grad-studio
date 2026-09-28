/**
 * 学位服务（Service Layer）—— 学位节点定义 + 学生学位记录
 *
 * 权限：仅课题组管理员（group_admin）与导师（mentor）可读写。
 * 节点 / 记录均按 group_id 隔离；学生记录以 (student_id, node_id) 唯一 upsert。
 * 导师只能查看 / 维护名下学生（mentor_student 关系）的学位记录，组管可维护全组。
 */
const permission = require('./permission')
const degreeNodeRepository = require('../db/repositories/degreeNodeRepository')
const studentDegreeRepository = require('../db/repositories/studentDegreeRepository')
const mentorStudentRepository = require('../db/repositories/mentorStudentRepository')
const operationLogService = require('./operationLogService')
const { ROLE_MENTOR } = require('../../shared/constants')

// 学位模块管理角色：组管 / 导师
function canManage() {
  return permission.isManager()
}

// 导师名下学生 id 集合；非导师返回 null（组管视角不做范围限制）
async function mentorStudentIds() {
  if (permission.currentRole() !== ROLE_MENTOR) return null
  const rows = await mentorStudentRepository.listByMentor(permission.currentUserId(), 'active')
  return new Set(rows.map((r) => r.student_id))
}

// degree:list-nodes —— 按 group_id 列出学位节点（node_order 升序）
async function listNodes(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!canManage()) return { success: false, message: '无权限：仅课题组管理员与导师可查看学位节点' }
  const groupId = payload && payload.group_id
  if (!groupId) return { success: false, message: '缺少课题组标识（group_id）' }
  try {
    const data = await degreeNodeRepository.listByGroup(groupId)
    return { success: true, data }
  } catch (err) {
    console.error('[degreeService.listNodes] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// degree:save-node —— 新增或更新节点（id 存在则更新，否则创建）
async function saveNode(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!canManage()) return { success: false, message: '无权限：仅课题组管理员与导师可维护学位节点' }
  const body = payload || {}
  if (!body.group_id) return { success: false, message: '缺少课题组标识（group_id）' }
  if (!body.name || !String(body.name).trim()) return { success: false, message: '节点名称不能为空' }
  try {
    const id = await degreeNodeRepository.save(body)
    operationLogService.writeLog({
      action: 'saveDegreeNode',
      targetType: 'degree_node',
      targetId: id,
      detail: `保存学位节点「${String(body.name).trim()}」`
    })
    return { success: true, message: '保存成功', data: { id } }
  } catch (err) {
    console.error('[degreeService.saveNode] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// degree:remove-node —— 软删除节点，级联软删该节点下的学生学位记录
async function removeNode(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!canManage()) return { success: false, message: '无权限：仅课题组管理员与导师可删除学位节点' }
  const id = payload && payload.id
  if (!id) return { success: false, message: '缺少节点标识（id）' }
  try {
    // 级联软删该节点下全部学生学位记录，避免删除节点后记录残留成孤儿引用
    await studentDegreeRepository.softDeleteByField('node_id', id)
    await degreeNodeRepository.delete(id)
    operationLogService.writeLog({
      action: 'removeDegreeNode',
      targetType: 'degree_node',
      targetId: id,
      detail: '删除学位节点（级联软删其下学生记录）'
    })
    return { success: true, message: '已删除' }
  } catch (err) {
    console.error('[degreeService.removeNode] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// degree:list-records —— 按 group_id 列出学生学位记录，可按 student_id 过滤。
// 导师仅能看到名下学生的记录；组管看全组。
async function listRecords(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!canManage()) return { success: false, message: '无权限：仅课题组管理员与导师可查看学位记录' }
  const groupId = payload && payload.group_id
  if (!groupId) return { success: false, message: '缺少课题组标识（group_id）' }
  try {
    const ids = await mentorStudentIds()
    if (ids) {
      // 导师：指定学生不在名下时拒绝；不指定则只看名下学生
      if (payload.student_id && !ids.has(Number(payload.student_id))) {
        return { success: false, message: '无权限：只能查看名下学生的学位记录' }
      }
      const data = await studentDegreeRepository.listByStudents(groupId, [...ids])
      return { success: true, data }
    }
    const data = await studentDegreeRepository.listByGroup(groupId, payload.student_id)
    return { success: true, data }
  } catch (err) {
    console.error('[degreeService.listRecords] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// degree:save-record —— 新增或更新学生学位记录（student_id + node_id 唯一）。
// 导师只能维护名下学生的记录；组管可维护全组。
async function saveRecord(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!canManage()) return { success: false, message: '无权限：仅课题组管理员与导师可维护学位记录' }
  const body = payload || {}
  if (!body.student_id || !body.node_id || !body.group_id) {
    return { success: false, message: '缺少学生 / 节点 / 课题组标识' }
  }
  try {
    const ids = await mentorStudentIds()
    if (ids && !ids.has(Number(body.student_id))) {
      return { success: false, message: '无权限：只能维护名下学生的学位记录' }
    }
    body.updated_by = permission.currentUserId()
    const id = await studentDegreeRepository.upsert(body)
    operationLogService.writeLog({
      action: 'saveDegreeRecord',
      targetType: 'student_degree',
      targetId: id,
      detail: `保存学生学位记录：学生 ${body.student_id} / 节点 ${body.node_id}`
    })
    return { success: true, message: '保存成功', data: { id } }
  } catch (err) {
    console.error('[degreeService.saveRecord] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

module.exports = {
  listNodes,
  saveNode,
  removeNode,
  listRecords,
  saveRecord
}
