/**
 * 路由层（IPC Layer）—— 学位管理路由（degree:* 前缀）
 *
 * 只做转发与统一异常收敛，业务逻辑全部在 degreeService。
 */
const degreeService = require('../services/degreeService')

function register(ipcMain) {
  // 列出学位节点（按 group_id，node_order 升序）
  ipcMain.handle('degree:list-nodes', async (_evt, payload) => {
    try {
      return await degreeService.listNodes(payload)
    } catch (err) {
      console.error('[degree:list-nodes] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 新增或更新学位节点
  ipcMain.handle('degree:save-node', async (_evt, payload) => {
    try {
      return await degreeService.saveNode(payload)
    } catch (err) {
      console.error('[degree:save-node] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 软删除学位节点
  ipcMain.handle('degree:remove-node', async (_evt, payload) => {
    try {
      return await degreeService.removeNode(payload)
    } catch (err) {
      console.error('[degree:remove-node] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 列出学生学位记录（可按 student_id 过滤）
  ipcMain.handle('degree:list-records', async (_evt, payload) => {
    try {
      return await degreeService.listRecords(payload)
    } catch (err) {
      console.error('[degree:list-records] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 新增或更新学生学位记录
  ipcMain.handle('degree:save-record', async (_evt, payload) => {
    try {
      return await degreeService.saveRecord(payload)
    } catch (err) {
      console.error('[degree:save-record] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })
}

module.exports = { register }
