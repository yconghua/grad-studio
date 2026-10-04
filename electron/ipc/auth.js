/**
 * 路由层（IPC Layer）—— 认证相关路由（auth:* 前缀）
 *
 * 只做转发：把渲染层发来的 auth:* 调用转交给 authService，
 * 这里不写 SQL、不做哈希、不碰仓库；统一异常转码由 helper.handler 完成。
 */
const authService = require('../services/authService')
const ticketService = require('../services/ticketService')
const captchaService = require('../services/captchaService')
const scanLoginService = require('../services/scanLoginService')
const ApiError = require('../services/apiError')
const { handler } = require('./helper')

function register(ipcMain) {
  // 获取图形验证码：返回 { captchaId, svg }，答案仅存主进程内存
  ipcMain.handle('auth:captcha', handler(() => captchaService.create()))

  // 扫码登录：签发二维码，返回 { ticket, qrUrl, baseUrl, candidates }（payload.baseUrl 可选，多网卡切换）
  ipcMain.handle('auth:scan-qr', handler((_evt, payload) => scanLoginService.create(payload)))

  // 扫码登录：轮询状态（手机提交凭据后由主进程本地验证并回填结果）
  ipcMain.handle('auth:scan-status', handler((_evt, payload) =>
    scanLoginService.status(payload && payload.ticket, payload && payload.baseUrl)))

  // 扫码登录：作废二维码（切 Tab / 离开登录页）
  ipcMain.handle('auth:scan-cancel', handler((_evt, payload) =>
    scanLoginService.cancel(payload && payload.ticket, payload && payload.baseUrl)))

  // 登录校验（用户名/密码区分大小写；连续失败后需带验证码）
  ipcMain.handle('auth:login', handler((_evt, payload) => authService.login(payload || {})))

  // 退出登录（清除登录态；不吊销免密票据）
  ipcMain.handle('auth:logout', handler(() => authService.logout()))

  // 切换账号（免密票据）：主进程内部强制「先完整退出旧账号 → 再登录新账号」
  ipcMain.handle('auth:switch-account', handler((_evt, payload) =>
    authService.switchByTicket(payload && payload.username)
  ))

  // 查询当前哪些历史账号有有效免密票据（不刷新、不影响状态）；需已登录
  ipcMain.handle('auth:ticket-status', handler(async () => {
    const user = await authService.getCurrentUser()
    if (!user) throw new ApiError('未登录，请重新登录', 401)
    return { names: ticketService.listValid() }
  }))

  // 当前登录用户（回库刷新；未登录返回 401）
  ipcMain.handle('auth:get-current-user', handler(async () => {
    const user = await authService.getCurrentUser()
    if (!user) throw new ApiError('未登录，请重新登录', 401)
    return user
  }))

  // 修改密码（个人修改 / 首次登录强制改密共用）
  ipcMain.handle('auth:change-password', handler((_evt, payload) => authService.changePassword(payload || {})))
}

module.exports = { register }
