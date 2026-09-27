/**
 * 路由层（IPC Layer）—— 操作日志相关路由（operation-log:* 前缀，仅超级管理员）
 *
 * 只做路由转发与防御性 catch，业务逻辑全部在 operationLogService。
 */
const operationLogService = require('../services/operationLogService')

function register(ipcMain) {
  // 分页列出操作日志（支持 operator_id / action / target_type / 时间范围过滤）
  ipcMain.handle('operation-log:list', async (_evt, payload) => {
    try {
      return await operationLogService.list(payload)
    } catch (err) {
      console.error('[operation-log:list] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })
}

module.exports = { register }
