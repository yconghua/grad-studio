/**
 * 路由层（IPC Layer）—— 全局搜索路由（search:*）
 *
 * 只做一层转发与防御性 catch，权限与可见范围全部在 searchService。
 */
const searchService = require('../services/searchService')

function register(ipcMain) {
  // 全局搜索（按角色限定可见范围）
  ipcMain.handle('search:global', async (_evt, payload) => {
    try {
      return await searchService.globalSearch(payload)
    } catch (err) {
      console.error('[search:global] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })
}

module.exports = { register }
