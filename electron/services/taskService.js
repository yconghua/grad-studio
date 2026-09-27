/**
 * 任务服务（Service Layer）—— task + task_progress
 *
 * 列表：组管 / 导师看本组全部；学生只看指派给自己的。
 * 增删改：仅组管 / 导师（assigner_id 取当前登录用户）。
 * 进展提交：仅学生本人（校验 task.assignee_id = 当前用户），写进展并回写任务进度。
 */
const permission = require('./permission')
const taskRepository = require('../db/repositories/taskRepository')
const taskProgressRepository = require('../db/repositories/taskProgressRepository')
const userGroupRepository = require('../db/repositories/userGroupRepository')
const operationLogService = require('./operationLogService')
const messageService = require('./messageService')
const { ROLE_STUDENT } = require('../../shared/constants')

// 进度百分比收敛到 0-100
function clampPercent(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

// task:list —— 组管 / 导师按 group_id 看全部；学生只看本人被指派的
async function list(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  try {
    let data
    if (permission.isManager()) {
      const groupId = payload && payload.group_id
      if (!groupId) return { success: false, message: '缺少课题组标识（group_id）' }
      data = await taskRepository.listByGroup(groupId)
    } else if (permission.currentRole() === ROLE_STUDENT) {
      data = await taskRepository.listByAssignee(permission.currentUserId())
    } else {
      return { success: false, message: '无权限查看任务列表' }
    }
    return { success: true, data }
  } catch (err) {
    console.error('[taskService.list] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// task:create —— 仅组管 / 导师，assigner_id 取当前登录用户
async function create(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isManager()) return { success: false, message: '无权限：仅课题组管理员与导师可下发任务' }
  const body = payload || {}
  if (!body.group_id) return { success: false, message: '缺少课题组标识（group_id）' }
  if (!body.title || !String(body.title).trim()) return { success: false, message: '任务标题不能为空' }
  if (!body.assignee_id) return { success: false, message: '缺少执行人（assignee_id）' }
  try {
    // 校验执行人确属该课题组（在组且状态 active），避免把任务派给非本组成员
    const assignee = await userGroupRepository.findByUserAndGroup(body.assignee_id, body.group_id)
    if (!assignee || assignee.status !== 'active') {
      return { success: false, message: '执行人不在该课题组，无法指派' }
    }
    body.assigner_id = permission.currentUserId()
    const id = await taskRepository.create(body)
    operationLogService.writeLog({
      action: 'createTask',
      targetType: 'task',
      targetId: id,
      detail: `下发任务「${String(body.title).trim()}」给用户 ${body.assignee_id}`
    })
    // 站内通知：告知执行人
    messageService.sendMessage({
      receiverId: body.assignee_id,
      msgType: 'task',
      title: '新任务',
      content: `您有新的任务「${String(body.title).trim()}」`,
      refType: 'task',
      refId: id
    })
    return { success: true, message: '创建成功', data: { id } }
  } catch (err) {
    console.error('[taskService.create] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// task:update —— 仅组管 / 导师
async function update(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isManager()) return { success: false, message: '无权限：仅课题组管理员与导师可编辑任务' }
  const id = payload && payload.id
  if (!id) return { success: false, message: '缺少任务标识（id）' }
  try {
    if (payload && payload.assignee_id) {
      const task = await taskRepository.findById(id)
      if (!task) return { success: false, message: '任务不存在或已删除' }
      const assignee = await userGroupRepository.findByUserAndGroup(payload.assignee_id, task.group_id)
      if (!assignee || assignee.status !== 'active') {
        return { success: false, message: '执行人不在该课题组，无法指派' }
      }
    }
    await taskRepository.update(id, payload || {})
    operationLogService.writeLog({
      action: 'updateTask',
      targetType: 'task',
      targetId: id,
      detail: '编辑任务'
    })
    return { success: true, message: '更新成功' }
  } catch (err) {
    console.error('[taskService.update] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// task:remove —— 仅组管 / 导师，软删除
async function remove(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isManager()) return { success: false, message: '无权限：仅课题组管理员与导师可删除任务' }
  const id = payload && payload.id
  if (!id) return { success: false, message: '缺少任务标识（id）' }
  try {
    await taskRepository.delete(id)
    operationLogService.writeLog({
      action: 'removeTask',
      targetType: 'task',
      targetId: id,
      detail: '删除任务'
    })
    return { success: true, message: '已删除' }
  } catch (err) {
    console.error('[taskService.remove] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// task:list-mine —— 仅学生，指派给本人的任务
async function listMine() {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (permission.currentRole() !== ROLE_STUDENT) {
    return { success: false, message: '无权限：仅学生可查看我的任务' }
  }
  try {
    const data = await taskRepository.listByAssignee(permission.currentUserId())
    return { success: true, data }
  } catch (err) {
    console.error('[taskService.listMine] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// task:progress-submit —— 仅学生本人任务：写进展并回写任务进度
async function progressSubmit(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (permission.currentRole() !== ROLE_STUDENT) {
    return { success: false, message: '无权限：仅学生可提交任务进展' }
  }
  const body = payload || {}
  if (!body.task_id) return { success: false, message: '缺少任务标识（task_id）' }
  try {
    const task = await taskRepository.findById(body.task_id)
    if (!task) return { success: false, message: '任务不存在或已删除' }
    if (task.assignee_id !== permission.currentUserId()) {
      return { success: false, message: '只能提交本人任务的进展' }
    }
    const pct = clampPercent(body.progress_percent)
    // 写入一条进展记录
    await taskProgressRepository.create({
      task_id: body.task_id,
      user_id: permission.currentUserId(),
      content: body.content,
      progress_percent: pct,
      attachment: body.attachment
    })
    // 回写任务进度快照与状态流转
    const patch = { progress_percent: pct }
    if (pct >= 100) {
      patch.status = 'completed'
      patch.completed_at = new Date()
    } else if (task.status === 'todo') {
      patch.status = 'in_progress'
    }
    await taskRepository.update(body.task_id, patch)
    operationLogService.writeLog({
      action: 'submitTaskProgress',
      targetType: 'task',
      targetId: body.task_id,
      detail: `提交任务进展（进度 ${pct}%）`
    })
    return { success: true, message: '进展已提交' }
  } catch (err) {
    console.error('[taskService.progressSubmit] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// task:list-progress —— 按 task_id 列进展：学生仅本人任务，管理者全部
async function listProgress(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const taskId = payload && payload.task_id
  if (!taskId) return { success: false, message: '缺少任务标识（task_id）' }
  try {
    const task = await taskRepository.findById(taskId)
    if (!task) return { success: false, message: '任务不存在或已删除' }
    if (!permission.isManager() && task.assignee_id !== permission.currentUserId()) {
      return { success: false, message: '无权限查看该任务进展' }
    }
    const data = await taskProgressRepository.listByTask(taskId)
    return { success: true, data }
  } catch (err) {
    console.error('[taskService.listProgress] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

module.exports = {
  list,
  create,
  update,
  remove,
  listMine,
  progressSubmit,
  listProgress
}
