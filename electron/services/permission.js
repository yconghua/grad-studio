/**
 * 权限辅助模块（Service Layer 共用）
 *
 * 把「是否登录 / 是否超级管理员 / 是否课题组管理员 / 是否组内管理角色 / 当前用户 id」等判断
 * 收敛到一处，供各业务 Service 复用，避免每个 Service 重复读取 authService 并写一遍角色判断。
 * 只读 authService 的会话状态，不在这里落任何业务 SQL。
 *
 * 注意：authService 在顶层 require 本模块，本模块又回引 authService，
 * 因此采用「惰性 require」（调用时才 require，此时 authService 已加载完成），避免循环依赖拿到空导出。
 *
 * 角色体系：
 *   super_admin 超级管理员（平台运维，不参与课题组业务）
 *   group_admin 课题组管理员（组内最高管理）
 *   mentor      导师（管理名下学生）
 *   student     学生（个人科研事务）
 */
const {
  ROLE_SUPER_ADMIN,
  ROLE_GROUP_ADMIN,
  ROLE_MENTOR
} = require('../../shared/constants')

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

// 当前登录用户角色（未登录返回 null）
function currentRole() {
  const u = getAuthService().getCurrentUser()
  return u ? u.role : null
}

// 是否超级管理员（平台运维：用户管理 / 课题组管理 / 系统配置 / 操作日志）
function isAdmin() {
  return getAuthService().isAdmin()
}

// 是否课题组管理员（组内最高管理角色）
function isGroupAdmin() {
  return getAuthService().isGroupAdmin()
}

// 是否组内管理角色（课题组管理员或导师）：可执行组内管理类写操作
function isManager() {
  const u = getAuthService().getCurrentUser()
  return !!u && (u.role === ROLE_GROUP_ADMIN || u.role === ROLE_MENTOR)
}

module.exports = {
  ROLE_SUPER_ADMIN,
  ROLE_GROUP_ADMIN,
  ROLE_MENTOR,
  isLoggedIn,
  currentUserId,
  currentUsername,
  currentRole,
  isAdmin,
  isGroupAdmin,
  isManager
}
