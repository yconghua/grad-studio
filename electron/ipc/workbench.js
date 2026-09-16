/**
 * 路由层（IPC Layer）—— 工作台相关路由（workbench:* 前缀）
 */
const workbenchService = require('../services/workbenchService')
const { handle, registerCrud } = require('./crudRouter')

function register(ipcMain) {
  registerCrud(ipcMain, 'workbench:todo', workbenchService.todo)
  registerCrud(ipcMain, 'workbench:schedule', workbenchService.schedule)
  registerCrud(ipcMain, 'workbench:notice', workbenchService.notice)

  // 完成待办 / 发布公告
  handle(ipcMain, 'workbench:todo-complete', (p) => workbenchService.completeTodo(p && p.id))
  handle(ipcMain, 'workbench:notice-publish', (p) => workbenchService.publishNotice(p && p.id))
}

module.exports = { register }
