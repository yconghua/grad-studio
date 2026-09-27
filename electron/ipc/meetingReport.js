/**
 * 路由层（IPC Layer）—— 组会汇报路由（meeting-report:* 前缀）
 *
 * 只做转发与统一异常收敛，业务逻辑全部在 meetingReportService。
 */
const meetingReportService = require('../services/meetingReportService')

function register(ipcMain) {
  // 汇报列表（管理者看本组全部，学生看本人）
  ipcMain.handle('meeting-report:list', async (_evt, payload) => {
    try {
      return await meetingReportService.list(payload)
    } catch (err) {
      console.error('[meeting-report:list] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 提交汇报（仅学生）
  ipcMain.handle('meeting-report:submit', async (_evt, payload) => {
    try {
      return await meetingReportService.submit(payload)
    } catch (err) {
      console.error('[meeting-report:submit] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 审阅汇报（仅组管 / 导师）
  ipcMain.handle('meeting-report:review', async (_evt, payload) => {
    try {
      return await meetingReportService.review(payload)
    } catch (err) {
      console.error('[meeting-report:review] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })
}

module.exports = { register }
