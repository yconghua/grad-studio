/**
 * 科研日志 Service（Service Layer）—— research-log:* 通道的业务逻辑
 *
 * 仅学生本人操作：所有写入 / 更新 / 删除均以 currentUserId 强制限定 student_id，
 * 先查记录归属再放行，杜绝越权。
 */
const permission = require('./permission')
const researchLogRepository = require('../db/repositories/researchLogRepository')

// 列出我的科研日志
async function listMine() {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const studentId = permission.currentUserId()
  try {
    const data = await researchLogRepository.listByStudent(studentId)
    return { success: true, data }
  } catch (err) {
    console.error('[researchLogService.listMine] 数据库异常:', err)
    return { success: false, message: '读取科研日志失败，请稍后重试' }
  }
}

// 新增科研日志
async function create(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const studentId = permission.currentUserId()
  if (!payload.log_date) return { success: false, message: '请选择日志日期' }
  if (!payload.content || !String(payload.content).trim()) {
    return { success: false, message: '日志内容不能为空' }
  }
  try {
    const id = await researchLogRepository.createForStudent(studentId, payload)
    return { success: true, data: { id }, message: '科研日志已保存' }
  } catch (err) {
    console.error('[researchLogService.create] 数据库异常:', err)
    return { success: false, message: '保存科研日志失败，请稍后重试' }
  }
}

// 更新本人科研日志
async function update(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const studentId = permission.currentUserId()
  const { id } = payload
  if (!id) return { success: false, message: '缺少日志 id' }
  try {
    const record = await researchLogRepository.findById(id)
    if (!record || record.student_id !== studentId) {
      return { success: false, message: '记录不存在或无权操作' }
    }
    const affected = await researchLogRepository.updateOwned(id, studentId, payload)
    return { success: true, data: { affected }, message: '科研日志已更新' }
  } catch (err) {
    console.error('[researchLogService.update] 数据库异常:', err)
    return { success: false, message: '更新科研日志失败，请稍后重试' }
  }
}

// 删除本人科研日志（软删除）
async function remove(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const studentId = permission.currentUserId()
  const { id } = payload
  if (!id) return { success: false, message: '缺少日志 id' }
  try {
    const record = await researchLogRepository.findById(id)
    if (!record || record.student_id !== studentId) {
      return { success: false, message: '记录不存在或无权操作' }
    }
    await researchLogRepository.delete(id)
    return { success: true, message: '科研日志已删除' }
  } catch (err) {
    console.error('[researchLogService.remove] 数据库异常:', err)
    return { success: false, message: '删除科研日志失败，请稍后重试' }
  }
}

module.exports = { listMine, create, update, remove }
