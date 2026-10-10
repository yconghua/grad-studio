/**
 * 路由层（IPC Layer）—— 工具箱（tool:* 前缀）
 *
 * 权限闸门：仅导师 / 学生可用，细粒度校验在 toolService（requireToolsUser）
 * 内基于当前会话完成；组管 / 超管调用一律被服务层拒绝。
 * 当前用户由 authService.getCurrentUser() 解析，userId 不入 payload。
 */
const toolService = require('../services/toolService')
const authService = require('../services/authService')
const ApiError = require('../services/apiError')
const { handler } = require('./helper')

async function requireLogin() {
  const u = await authService.getCurrentUser()
  if (!u) throw new ApiError('未登录，请重新登录', 401)
  return u
}

function register(ipcMain) {
  // ===== 设置与 API Key =====
  ipcMain.handle('tool:get-settings', handler(async () => {
    const u = await requireLogin()
    return toolService.getSettings(u.id)
  }))

  ipcMain.handle('tool:save-settings', handler(async (_evt, payload) => {
    const u = await requireLogin()
    return toolService.saveSettings(u.id, payload || {})
  }))

  ipcMain.handle('tool:test-key', handler(async (_evt, payload) => {
    const u = await requireLogin()
    return toolService.testSourceKey(u.id, payload && payload.source, payload && payload.value)
  }))

  // ===== 学术工具 =====
  ipcMain.handle('tool:doi-query', handler(async (_evt, payload) => {
    const u = await requireLogin()
    return toolService.queryDoi(u.id, payload || {})
  }))

  ipcMain.handle('tool:journal-query', handler(async (_evt, payload) => {
    const u = await requireLogin()
    return toolService.queryJournal(u.id, payload || {})
  }))

  ipcMain.handle('tool:search', handler(async (_evt, payload) => {
    const u = await requireLogin()
    return toolService.searchAcademic(u.id, payload || {})
  }))

  ipcMain.handle('tool:translate', handler(async (_evt, payload) => {
    const u = await requireLogin()
    return toolService.translate(u.id, payload || {})
  }))

  // ===== 就业工具：公司搜索 =====
  ipcMain.handle('tool:company-search', handler(async (_evt, payload) => {
    const u = await requireLogin()
    return toolService.searchCompany(u.id, payload || {})
  }))

  ipcMain.handle('tool:company-favorites', handler(async () => {
    const u = await requireLogin()
    return toolService.listCompanyFavorites(u.id)
  }))

  ipcMain.handle('tool:company-favorite-add', handler(async (_evt, payload) => {
    const u = await requireLogin()
    return toolService.addCompanyFavorite(u.id, payload || {})
  }))

  ipcMain.handle('tool:company-favorite-update', handler(async (_evt, payload) => {
    const u = await requireLogin()
    return toolService.updateCompanyFavorite(u.id, payload || {})
  }))

  ipcMain.handle('tool:company-favorite-remove', handler(async (_evt, payload) => {
    const u = await requireLogin()
    return toolService.removeCompanyFavorite(u.id, payload && payload.companyKey)
  }))

  // ===== 历史 =====
  ipcMain.handle('tool:histories', handler(async () => {
    const u = await requireLogin()
    return toolService.listSearchHistories(u.id)
  }))

  // ===== 缓存管理 =====
  ipcMain.handle('tool:cache-info', handler(async () => {
    const u = await requireLogin()
    return toolService.cacheInfo(u.id)
  }))

  ipcMain.handle('tool:cache-clear', handler(async (_evt, payload) => {
    const u = await requireLogin()
    return toolService.clearCache(u.id, payload && payload.table)
  }))

  // ===== 数据源调用日志 =====
  ipcMain.handle('tool:logs', handler(async (_evt, payload) => {
    const u = await requireLogin()
    return toolService.listLogs(u.id, payload || {})
  }))

  ipcMain.handle('tool:logs-clear', handler(async (_evt, payload) => {
    const u = await requireLogin()
    return toolService.clearLogs(u.id, payload || {})
  }))

  // ===== 引用格式（前端可选调用） =====
  ipcMain.handle('tool:citation', handler(async (_evt, payload) => {
    const u = await requireLogin()
    const s = await toolService.getSettings(u.id)
    return toolService.formatCitation(payload && payload.item, (payload && payload.style) || s.defaultCitation)
  }))
}

module.exports = { register }
