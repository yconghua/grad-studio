/**
 * 操作日志服务（Service Layer）—— operation_log 审计日志
 *
 * 权限：列表查询仅超级管理员；日志只追加不修改。
 * writeLog 供各业务 Service 记录写操作，失败不影响主流程。
 */
const permission = require('./permission')
const operationLogRepository = require('../db/repositories/operationLogRepository')

// 记录一条操作日志（写入失败只打印错误，不阻断业务）
async function writeLog({ action, targetType, targetId, detail }) {
  try {
    await operationLogRepository.createLog({
      operator_id: permission.currentUserId(),
      operator_name: permission.currentUsername(),
      action,
      target_type: targetType,
      target_id: targetId,
      detail: detail ? String(detail).slice(0, 500) : ''
    })
  } catch (err) {
    console.error('[operationLogService.writeLog] 写入操作日志失败:', err)
  }
}

// 分页列出操作日志：仅超级管理员
async function list(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isAdmin()) return { success: false, message: '无权限：仅超级管理员可查看操作日志' }
  try {
    const result = await operationLogRepository.list({
      operatorId: payload.operator_id,
      action: payload.action,
      targetType: payload.target_type,
      startDate: payload.start_date,
      endDate: payload.end_date,
      page: payload.page,
      pageSize: payload.pageSize
    })
    return { success: true, data: result }
  } catch (err) {
    console.error('[operationLogService.list] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

module.exports = {
  writeLog,
  list
}
