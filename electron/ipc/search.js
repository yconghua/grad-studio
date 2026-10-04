/**
 * 路由层（IPC Layer）—— 全局搜索模块（search:* 前缀）
 *
 * 权限闸门：仅校验登录态；可搜模块与范围由 searchService 按当前用户角色计算，
 * 渲染层只传 keyword，不参与任何权限判断。
 */
const authService = require('../services/authService')
const searchService = require('../services/searchService')
const ApiError = require('../services/apiError')
const { handler } = require('./helper')

function register(ipcMain) {
  // 全局搜索：keyword → 按角色分组返回各模块命中结果
  ipcMain.handle('search:global', handler(async (_evt, payload) => {
    const me = await authService.getCurrentUser()
    if (!me) throw new ApiError('未登录，请重新登录', 401)
    return searchService.search(payload || {}, me)
  }))
}

module.exports = { register }
