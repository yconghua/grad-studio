/**
 * 权限辅助模块（Service Layer 共用）
 *
 * 把「是否登录 / 是否管理员 / 是否管理角色（导师或管理员）/ 当前用户 id」等判断
 * 收敛到一处，供各业务 Service 复用，避免每个 Service 重复读取 authService 并写一遍角色判断。
 * 只读 authService 的会话状态，不在这里落任何业务 SQL。
 *
 * 注意：authService 采用「惰性 require」，避免循环依赖——
 * authService → logService → permission → authService 若在顶层互相 require 会拿到空导出。
 */
const { ROLE_ADMIN, ROLE_MENTOR } = require('../../shared/constants')

// 惰性取 authService：仅在真正调用时 require，此时 authService 已加载完成
function getAuthService() {
  return require('./authService')
}

// 是否已登录（有当前会话用户）
function isLoggedIn() {
  return !!getAuthService().getCurrentUser()
}

// 当前登录用户 id（未登录返回 null）
function currentUserId() {
  const u = getAuthService().getCurrentUser()
  return u ? u.id : null
}

// 当前登录用户名（未登录返回 null）
function currentUsername() {
  const u = getAuthService().getCurrentUser()
  return u ? u.username : null
}

// 是否管理员
function isAdmin() {
  return getAuthService().isAdmin()
}

// 是否管理角色（导师或管理员）：可执行管理类写操作
function isManager() {
  const u = getAuthService().getCurrentUser()
  return !!u && (u.role === ROLE_ADMIN || u.role === ROLE_MENTOR)
}

module.exports = { isLoggedIn, currentUserId, currentUsername, isAdmin, isManager }
