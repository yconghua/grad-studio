/**
 * 路由层（IPC Layer）—— 协同办公相关路由（collab:* 前缀）
 *
 * 标准 CRUD 用 crudRouter.registerCrud 注册；报名 / 讨论区 / 审批流转单独 handle。
 */
const collabService = require('../services/collabService')
const { handle, registerCrud } = require('./crudRouter')

function register(ipcMain) {
  registerCrud(ipcMain, 'collab:meeting', collabService.meeting)
  registerCrud(ipcMain, 'collab:activity', collabService.activity)
  registerCrud(ipcMain, 'collab:task', collabService.task)
  registerCrud(ipcMain, 'collab:post', collabService.forumPost)
  registerCrud(ipcMain, 'collab:approval', collabService.approval)

  // 活动报名 / 取消 / 名单
  handle(ipcMain, 'collab:signup', (p) => collabService.signup(p && p.activityId))
  handle(ipcMain, 'collab:signup-cancel', (p) => collabService.cancelSignup(p && p.activityId))
  handle(ipcMain, 'collab:signup-list', (p) => collabService.signupList(p && p.activityId))

  // 讨论区：浏览 / 回复 / 回复列表
  handle(ipcMain, 'collab:post-view', (p) => collabService.viewPost(p && p.id))
  handle(ipcMain, 'collab:reply', (p) => collabService.reply(p && p.postId, p && p.content, p && p.parentId))
  handle(ipcMain, 'collab:reply-list', (p) => collabService.replyList(p && p.postId))

  // 审批审核
  handle(ipcMain, 'collab:approval-review', (p) =>
    collabService.reviewApproval(p && p.id, p && p.approved, p && p.remark)
  )
}

module.exports = { register }
