// 认证相关接口：登录、验证码、扫码、退出、当前用户、修改密码、切换账号
export function login(payload = {}) {
  return window.api.auth.login(payload)
}
// 获取图形验证码：返回 { captchaId, svg }，渲染层以 data URL 展示
export function getCaptcha() {
  return window.api.auth.getCaptcha()
}
// 扫码登录：签发二维码，返回 { ticket, qrUrl, baseUrl, candidates }（payload.baseUrl 可选，多网卡切换）
export function getScanQr(payload) {
  return window.api.auth.getScanQr(payload)
}
// 扫码登录：轮询状态（主进程在手机提交凭据后本地验证并回填结果）
export function scanStatus(ticket, baseUrl) {
  return window.api.auth.scanStatus({ ticket, baseUrl })
}
// 扫码登录：作废二维码（切 Tab / 离开登录页）
export function scanCancel(ticket, baseUrl) {
  return window.api.auth.scanCancel({ ticket, baseUrl })
}
export function logout() {
  return window.api.auth.logout()
}
export function getCurrentUser() {
  return window.api.auth.getCurrentUser()
}
export function changePassword(payload = {}) {
  return window.api.auth.changePassword(payload)
}
// 切换账号（免密票据）：主进程先退出旧账号再登录新账号
export function switchAccount(username) {
  return window.api.auth.switchAccount({ username })
}
// 查询哪些历史账号当前有有效免密票据
export function ticketStatus() {
  return window.api.auth.ticketStatus()
}
