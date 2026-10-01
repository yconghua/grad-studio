// 认证相关接口：登录、退出、当前用户、修改密码
export function login(username, password) {
  return window.api.auth.login({ username, password })
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
