/**
 * 路由层（IPC Layer）—— 全局搜索（search:* 前缀）
 */
const searchService = require('../services/searchService')
const { handle } = require('./crudRouter')

function register(ipcMain) {
  handle(ipcMain, 'search:global', (p) => searchService.globalSearch(p && p.keyword))
}

module.exports = { register }
