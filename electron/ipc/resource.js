/**
 * 路由层（IPC Layer）—— 资源中心相关路由（resource:* 前缀）
 */
const resourceService = require('../services/resourceService')
const { handle, registerCrud } = require('./crudRouter')

function register(ipcMain) {
  registerCrud(ipcMain, 'resource:item', resourceService.resource)
  registerCrud(ipcMain, 'resource:link', resourceService.link)
  // 下载计数
  handle(ipcMain, 'resource:download', (p) => resourceService.download(p && p.id))
}

module.exports = { register }
