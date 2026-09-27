/**
 * 路由层（IPC Layer）—— 知识库相关路由（knowledge:* 前缀）
 *
 * 只做路由转发与防御性 catch，业务逻辑全部在 knowledgeService。
 */
const knowledgeService = require('../services/knowledgeService')

function register(ipcMain) {
  // 知识库节点树（全员登录）
  ipcMain.handle('knowledge:list', async (_evt, payload) => {
    try {
      return await knowledgeService.list(payload)
    } catch (err) {
      console.error('[knowledge:list] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 新增节点（组管 / 导师）
  ipcMain.handle('knowledge:create', async (_evt, payload) => {
    try {
      return await knowledgeService.create(payload)
    } catch (err) {
      console.error('[knowledge:create] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 更新节点（组管 / 导师）
  ipcMain.handle('knowledge:update', async (_evt, payload) => {
    try {
      return await knowledgeService.update(payload)
    } catch (err) {
      console.error('[knowledge:update] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 软删除节点（组管 / 导师，联动删除其下文件）
  ipcMain.handle('knowledge:remove', async (_evt, payload) => {
    try {
      return await knowledgeService.remove(payload)
    } catch (err) {
      console.error('[knowledge:remove] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 节点下文件列表（全员登录）
  ipcMain.handle('knowledge:list-files', async (_evt, payload) => {
    try {
      return await knowledgeService.listFiles(payload)
    } catch (err) {
      console.error('[knowledge:list-files] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 登记文件记录（组管 / 导师）
  ipcMain.handle('knowledge:upload-file', async (_evt, payload) => {
    try {
      return await knowledgeService.uploadFile(payload)
    } catch (err) {
      console.error('[knowledge:upload-file] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 软删除文件记录（组管 / 导师）
  ipcMain.handle('knowledge:remove-file', async (_evt, payload) => {
    try {
      return await knowledgeService.removeFile(payload)
    } catch (err) {
      console.error('[knowledge:remove-file] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })
}

module.exports = { register }
