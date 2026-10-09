/**
 * 路由层（IPC Layer）—— 个人待办（todo:* 前缀）
 *
 * 权限闸门：细粒度校验在 todoService 内基于会话 + 实时关系完成
 * （学生/导师只能操作自己的待办；组管只看本组总览；超管只看全平台总览，
 * 写操作对组管/超管一律拒绝）。
 */
const todoService = require('../services/todoService')
const authService = require('../services/authService')
const ApiError = require('../services/apiError')
const { handler } = require('./helper')

// 任意已登录角色（细粒度权限在服务层）
async function requireLogin() {
  const u = await authService.getCurrentUser()
  if (!u) throw new ApiError('未登录，请重新登录', 401)
  return u
}

function register(ipcMain) {
  // 我的待办分页列表（学生/导师只看自己的）
  ipcMain.handle('todo:list-mine', handler(async (_evt, payload) => {
    await requireLogin()
    return todoService.listMine(payload || {}, (await authService.getCurrentUser()))
  }))

  // 我的待办统计（总数 / 未完成 / 已完成 / 逾期）
  ipcMain.handle('todo:summary-mine', handler(async (_evt, payload) => {
    await requireLogin()
    return todoService.summaryMine((await authService.getCurrentUser()))
  }))

  // 日历取数：某时间范围内我的待办
  ipcMain.handle('todo:calendar-mine', handler(async (_evt, payload) => {
    await requireLogin()
    return todoService.calendarMine(payload || {}, (await authService.getCurrentUser()))
  }))

  // 新建/编辑待办（仅本人；已完成不可编辑）
  ipcMain.handle('todo:save', handler(async (_evt, payload) => {
    await requireLogin()
    return todoService.saveTodo(payload || {}, (await authService.getCurrentUser()))
  }))

  // 来源判重（转换弹窗打开时探测，不创建）
  ipcMain.handle('todo:check-source', handler(async (_evt, payload) => {
    await requireLogin()
    return todoService.checkSource(payload || {}, (await authService.getCurrentUser()))
  }))

  // 来源转待办：校验可见性 + 判重 + 预填创建（已转过则提示并返回已有待办）
  ipcMain.handle('todo:create-from-source', handler(async (_evt, payload) => {
    await requireLogin()
    return todoService.createFromSource(payload || {}, (await authService.getCurrentUser()))
  }))

  // 完成 / 取消完成（仅本人）
  ipcMain.handle('todo:toggle-done', handler(async (_evt, payload) => {
    await requireLogin()
    return todoService.toggleDone(payload && payload.id, (await authService.getCurrentUser()))
  }))

  // 删除待办（仅本人）：软删
  ipcMain.handle('todo:remove', handler(async (_evt, payload) => {
    await requireLogin()
    return todoService.removeTodo(payload && payload.id, (await authService.getCurrentUser()))
  }))

  // ===== 超管 / 组管只读总览 =====

  // 总览分页列表：超管=全平台或按组；组管=本组；只读
  ipcMain.handle('todo:overview', handler(async (_evt, payload) => {
    await requireLogin()
    return todoService.overview(payload || {}, (await authService.getCurrentUser()))
  }))

  // 总览统计卡（总数 / 未完成 / 已完成 / 逾期）
  ipcMain.handle('todo:overview-summary', handler(async (_evt, payload) => {
    await requireLogin()
    return todoService.overviewSummary(payload || {}, (await authService.getCurrentUser()))
  }))
}

module.exports = { register }
