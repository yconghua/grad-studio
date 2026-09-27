/**
 * 周报 Service（Service Layer）—— weekly:* 通道的业务逻辑
 *
 * 学生侧：列表 / 新建 / 编辑草稿 / 提交；
 * 教师侧（group_admin / mentor）：批阅 / 全组列表。
 */
const permission = require('./permission')
const weeklyReportRepository = require('../db/repositories/weeklyReportRepository')
const operationLogService = require('./operationLogService')
const messageService = require('./messageService')

// 列出我的周报
async function listMine() {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const studentId = permission.currentUserId()
  try {
    const data = await weeklyReportRepository.listByStudent(studentId)
    return { success: true, data }
  } catch (err) {
    console.error('[weeklyService.listMine] 数据库异常:', err)
    return { success: false, message: '读取周报失败，请稍后重试' }
  }
}

// 新建周报（草稿）
async function create(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const studentId = permission.currentUserId()
  if (!payload.week_start || !payload.week_end) {
    return { success: false, message: '请选择周起始与结束日期' }
  }
  try {
    const id = await weeklyReportRepository.createForStudent(studentId, payload)
    return { success: true, data: { id }, message: '周报草稿已保存' }
  } catch (err) {
    console.error('[weeklyService.create] 数据库异常:', err)
    return { success: false, message: '保存周报失败，请稍后重试' }
  }
}

// 更新本人草稿周报
async function update(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const studentId = permission.currentUserId()
  const { id } = payload
  if (!id) return { success: false, message: '缺少周报 id' }
  try {
    const record = await weeklyReportRepository.findById(id)
    if (!record || record.student_id !== studentId) {
      return { success: false, message: '记录不存在或无权操作' }
    }
    if (record.status !== 'draft') {
      return { success: false, message: '仅草稿状态的周报可编辑' }
    }
    const affected = await weeklyReportRepository.updateOwnedDraft(id, studentId, payload)
    return { success: true, data: { affected }, message: '周报已更新' }
  } catch (err) {
    console.error('[weeklyService.update] 数据库异常:', err)
    return { success: false, message: '更新周报失败，请稍后重试' }
  }
}

// 提交周报（draft → submitted）
async function submit(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const studentId = permission.currentUserId()
  const { id } = payload
  if (!id) return { success: false, message: '缺少周报 id' }
  try {
    const record = await weeklyReportRepository.findById(id)
    if (!record || record.student_id !== studentId) {
      return { success: false, message: '记录不存在或无权操作' }
    }
    if (record.status !== 'draft') {
      return { success: false, message: '仅草稿状态的周报可提交' }
    }
    const affected = await weeklyReportRepository.submit(id, studentId)
    return { success: true, data: { affected }, message: '周报已提交' }
  } catch (err) {
    console.error('[weeklyService.submit] 数据库异常:', err)
    return { success: false, message: '提交周报失败，请稍后重试' }
  }
}

// 教师批阅周报（仅 group_admin / mentor）
async function review(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isManager()) return { success: false, message: '无批阅权限' }
  const { id, review_comment: reviewComment } = payload
  if (!id) return { success: false, message: '缺少周报 id' }
  try {
    const record = await weeklyReportRepository.findById(id)
    if (!record) return { success: false, message: '周报不存在' }
    if (record.status !== 'submitted') {
      return { success: false, message: '仅待批阅状态的周报可批阅' }
    }
    const affected = await weeklyReportRepository.review(id, {
      reviewedBy: permission.currentUserId(),
      reviewComment
    })
    operationLogService.writeLog({
      action: 'reviewWeekly',
      targetType: 'weekly_report',
      targetId: id,
      detail: '批阅周报'
    })
    // 站内通知：告知学生周报已批阅
    if (record.student_id) {
      messageService.sendMessage({
        receiverId: record.student_id,
        msgType: 'other',
        title: '周报已批阅',
        content: '您的周报已被导师批阅，请查看意见',
        refType: 'weekly',
        refId: id
      })
    }
    return { success: true, data: { affected }, message: '批阅完成' }
  } catch (err) {
    console.error('[weeklyService.review] 数据库异常:', err)
    return { success: false, message: '批阅周报失败，请稍后重试' }
  }
}

// 列出全组周报（仅 group_admin / mentor，可按 student_id 过滤）
async function listAll(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isManager()) return { success: false, message: '无查看权限' }
  try {
    const data = await weeklyReportRepository.listAll({ studentId: payload.student_id })
    return { success: true, data }
  } catch (err) {
    console.error('[weeklyService.listAll] 数据库异常:', err)
    return { success: false, message: '读取周报列表失败，请稍后重试' }
  }
}

module.exports = { listMine, create, update, submit, review, listAll }
