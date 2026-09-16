/**
 * 路由层（IPC Layer）—— 工作室事务相关路由（studio:* 前缀）
 *
 * 标准 CRUD 用 crudRouter.registerCrud 注册；归还 / 审核两个流转动作单独 handle。
 */
const studioService = require('../services/studioService')
const { handle, registerCrud } = require('./crudRouter')

function register(ipcMain) {
  registerCrud(ipcMain, 'studio:seat', studioService.seat)
  registerCrud(ipcMain, 'studio:device', studioService.device)
  registerCrud(ipcMain, 'studio:borrow', studioService.borrowRecord)
  registerCrud(ipcMain, 'studio:attendance', studioService.attendance)
  registerCrud(ipcMain, 'studio:duty', studioService.duty)
  registerCrud(ipcMain, 'studio:regulation', studioService.regulation)
  registerCrud(ipcMain, 'studio:join-leave', studioService.joinLeave)

  // 归还物品 / 设备
  handle(ipcMain, 'studio:borrow:return', (p) => studioService.returnBorrow(p && p.id))
  // 审核入组离组申请
  handle(ipcMain, 'studio:join-leave:review', (p) =>
    studioService.reviewJoinLeave(p && p.id, p && p.approved, p && p.remark)
  )
}

module.exports = { register }
