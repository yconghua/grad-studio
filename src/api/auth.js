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
  // 退出登录仅登出，不清除记住我记录（下次进登录页仍自动填好账号密码）；
  // 记录仅在「登录成功未勾选记住我」或登录页手动「清除」时删除
  return window.api.auth.logout()
}
// 记住我：登录成功勾选时加密保存（7 天有效，登录页自动回填免输入）
export function remember(payload = {}) {
  return window.api.auth.remember(payload)
}
// 记住我：读取已记住账号（自动回填登录页）；无记录 / 过期返回 null
export function getRemembered() {
  return window.api.auth.remembered()
}
// 记住我：清除本地记住记录（退出登录 / 登录成功未勾选）
export function forgetRemembered() {
  return window.api.auth.forget()
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
