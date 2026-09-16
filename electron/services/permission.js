/**
 * 权限辅助模块（Service Layer 共用）
 *
 * 把「是否登录 / 是否管理员 / 是否管理角色（导师或管理员）/ 当前用户 id」等判断
 * 收敛到一处，供各业务 Service 复用，避免每个 Service 重复读取 authService 并写一遍角色判断。
 * 只读 authService 的会话状态，不在这里落任何业务 SQL。
 */
const authService = require('./authService')
const { ROLE_ADMIN, ROLE_MENTOR } = require('../../shared/constants')

// 是否已登录（有当前会话用户）
function isLoggedIn() {
  return !!authService.getCurrentUser()
}

// 当前登录用户 id（未登录返回 null）
function currentUserId() {
  const u = authService.getCurrentUser()
  return u ? u.id : null
}

// 当前登录用户名（未登录返回 null）
function currentUsername() {
  const u = authService.getCurrentUser()
  return u ? u.username : null
}

// 是否管理员
function isAdmin() {
  return authService.isAdmin()
}

// 是否管理角色（导师或管理员）：可执行管理类写操作
function isManager() {
  const u = authService.getCurrentUser()
  return !!u && (u.role === ROLE_ADMIN || u.role === ROLE_MENTOR)
}

module.exports = { isLoggedIn, currentUserId, currentUsername, isAdmin, isManager }
