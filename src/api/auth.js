// 认证相关接口：登录、验证码、退出、当前用户、修改密码、切换账号
export function login(payload = {}) {
  return window.api.auth.login(payload)
}
// 获取图形验证码：返回 { captchaId, svg }，渲染层以 data URL 展示
export function getCaptcha() {
  return window.api.auth.getCaptcha()
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
