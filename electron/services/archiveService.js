/**
 * 档案 Service（Service Layer）—— archive:* 通道的业务逻辑
 *
 * 学生个人档案：本人归档记录的增删查，以及导出聚合数据。
 */
const permission = require('./permission')
const archiveRecordRepository = require('../db/repositories/archiveRecordRepository')
const researchLogRepository = require('../db/repositories/researchLogRepository')
const weeklyReportRepository = require('../db/repositories/weeklyReportRepository')
const achievementRepository = require('../db/repositories/achievementRepository')
const taskRepository = require('../db/repositories/taskRepository')

// 列出我的档案记录
async function list() {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const userId = permission.currentUserId()
  try {
    const data = await archiveRecordRepository.listByUser(userId)
    return { success: true, data }
  } catch (err) {
    console.error('[archiveService.list] 数据库异常:', err)
    return { success: false, message: '读取档案失败，请稍后重试' }
  }
}

// 新增档案记录
async function create(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const userId = permission.currentUserId()
  if (!payload.record_date) return { success: false, message: '请选择记录日期' }
  try {
    const id = await archiveRecordRepository.createForUser(userId, payload)
    return { success: true, data: { id }, message: '档案已保存' }
  } catch (err) {
    console.error('[archiveService.create] 数据库异常:', err)
    return { success: false, message: '保存档案失败，请稍后重试' }
  }
}

// 删除本人档案记录（软删除）
async function remove(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const userId = permission.currentUserId()
  const { id } = payload
  if (!id) return { success: false, message: '缺少档案 id' }
  try {
    const record = await archiveRecordRepository.findById(id)
    if (!record || record.user_id !== userId) {
      return { success: false, message: '记录不存在或无权操作' }
    }
    await archiveRecordRepository.delete(id)
    return { success: true, message: '档案已删除' }
  } catch (err) {
    console.error('[archiveService.remove] 数据库异常:', err)
    return { success: false, message: '删除档案失败，请稍后重试' }
  }
}

// 导出本人聚合数据：返回各表本人记录列表
async function exportData() {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const userId = permission.currentUserId()
  try {
    const [logs, weeklyReports, achievements, tasks, archiveRecords] = await Promise.all([
      researchLogRepository.listByStudent(userId),
      weeklyReportRepository.listByStudent(userId),
      achievementRepository.listByUser(userId),
      taskRepository.listByAssignee(userId),
      archiveRecordRepository.listByUser(userId)
    ])
    return {
      success: true,
      data: {
        profile: { id: userId, username: permission.currentUsername() },
        logs,
        weeklyReports,
        achievements,
        tasks,
        archiveRecords
      },
      message: '导出数据已生成'
    }
  } catch (err) {
    console.error('[archiveService.exportData] 数据库异常:', err)
    return { success: false, message: '导出失败，请稍后重试' }
  }
}

module.exports = { list, create, remove, exportData }
