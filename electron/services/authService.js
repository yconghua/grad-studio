/**
 * 认证服务（Service Layer）—— 登录 / 登出 / 当前用户 / 修改密码
 *
 * 桌面单窗口场景：登录态以「主进程内存中的当前用户」为准，
 * 渲染层再配合 localStorage 会话做路由守卫（沿用既有机制）。
 * 密码校验一律走 passwordService（bcrypt 哈希比对，大小写敏感）。
 */
const crypto = require('node:crypto')
const userRepository = require('../db/repositories/userRepository')
const ApiError = require('./apiError')
const passwordService = require('./passwordService')
// 聊天实时推送：登录后启动、登出停止（依赖登录态，联动点收敛在认证服务）
const chatPoller = require('./chatPoller')
// 通知中心实时推送：与聊天同构，10 秒轮询未读数/新通知
const notificationPoller = require('./notificationPoller')
const { ROLE_SUPER_ADMIN, ACCOUNT_STATUS_ENABLED } = require('../../shared/constants')
// 免密票据：登录成功后签发/刷新；切换账号时凭票据免密登录（仅登录后切换路径使用）
const ticketService = require('./ticketService')

// 主进程内存中的当前登录用户（单用户桌面应用，同一时刻只允许一人登录）
let currentUser = null

// 行转 DTO：去掉哈希字段、字段名转驼峰（与需求登录响应结构一致）
function toSafeUser(row) {
  if (!row) return null
  return {
    id: row.id,
    username: row.username,
    realName: row.real_name || '',
    role: row.role,
    status: row.status,
    groupId: row.group_id == null ? null : Number(row.group_id),
    mentorId: row.mentor_id == null ? null : Number(row.mentor_id),
    mustChangePassword: row.must_change_password === 1,
    gender: row.gender || 0,
    phone: row.phone || '',
    email: row.email || '',
    avatar: row.avatar || ''
  }
}

/**
 * 登录校验：用户名 / 密码均区分大小写（users.username 列排序规则 utf8mb4_bin），
 * 密码用 bcrypt 哈希比对；失败统一返回「账号或密码错误」，不暴露具体原因。
 */
async function login({ username, password } = {}) {
  if (!username || !password) {
    throw new ApiError('请输入账号和密码', 400)
  }
  const user = await userRepository.findByUsername(username)
  if (!user || user.status !== ACCOUNT_STATUS_ENABLED) {
    throw new ApiError('账号或密码错误', 400)
  }
  if (!passwordService.verifyPassword(password, user.password_hash)) {
    throw new ApiError('账号或密码错误', 400)
  }
  const safe = toSafeUser(user)
  currentUser = safe
  // 登录成功后签发 / 刷新免密票据（仅用于登录后切换账号）
  ticketService.issue(safe.username)
  // 登录后启动聊天实时推送（每 2 秒轮询共享库增量，有变化推给渲染层）
  chatPoller.start(safe.id)
  // 登录后启动通知中心实时推送（每 10 秒轮询新通知/未读数）
  notificationPoller.start(safe.id)
  return {
    token: crypto.randomUUID(), // 会话凭证（桌面单窗口下与前端 localStorage 会话配合使用）
    user: safe
  }
}

// 退出登录：停止聊天/通知推送并清除内存登录态（不吊销免密票据，票据仅 7 天到期失效）
function logout() {
  chatPoller.stop()
  notificationPoller.stop()
  currentUser = null
  return true
}

/**
 * 切换账号（免密票据路径）—— 链路硬保证：先完整退出旧账号，再登录新账号。
 * 步骤：
 *   ① 先退出当前账号（停推送 + 清登录态），任何情况下都先执行；
 *   ② 校验新账号票据：签名 + 有效期，通过则自动刷新 7 天；
 *   ③ 回库加载新账号并建立会话。
 * 返回 { ok: true, user } 免密成功；{ ok: false, needPassword: true, message } 需回登录页输密码
 * （此时旧账号已退出，前端应清会话跳登录页）。
 */
async function switchByTicket(username) {
  // ① 先完整退出当前账号——顺序不可颠倒，不存在"原地替换登录态"的旁路
  logout()
  if (!username || typeof username !== 'string') {
    return { ok: false, needPassword: true, message: '缺少切换目标账号' }
  }
  // ② 票据校验（通过会刷新 7 天有效期）
  if (!ticketService.verifyAndRefresh(username)) {
    return { ok: false, needPassword: true, message: '该账号免密凭证已失效，请输密码登录' }
  }
  // ③ 加载新账号并建立会话（账号不存在 / 已停用则仍走输密码）
  const row = await userRepository.findByUsername(username)
  if (!row || row.status !== ACCOUNT_STATUS_ENABLED) {
    return { ok: false, needPassword: true, message: '账号不存在或已停用，请输密码登录' }
  }
  const safe = toSafeUser(row)
  currentUser = safe
  chatPoller.start(safe.id)
  notificationPoller.start(safe.id)
  return { ok: true, user: safe }
}

/**
 * 当前登录用户：每次调用回库刷新，保证状态 / 课题组 / 导师等变更后
 * 前端拿到最新值；数据库暂不可用时返回内存缓存，不阻断登录态判断。
 */
async function getCurrentUser() {
  if (!currentUser) return null
  try {
    const row = await userRepository.findById(currentUser.id)
    if (!row) {
      currentUser = null
      return null
    }
    currentUser = toSafeUser(row)
  } catch (e) {
    // 数据库异常时保留缓存，登录态判断不受影响
  }
  return currentUser
}

// 是否超级管理员（供 IPC 权限闸门使用）
async function isAdmin() {
  const u = await getCurrentUser()
  return !!(u && u.role === ROLE_SUPER_ADMIN)
}

/**
 * 修改密码：验证原密码 → 校验新密码强度 → 更新哈希并清除强制改密标记。
 * 用于「个人修改密码」与「首次登录强制改密」两处。
 */
async function changePassword({ username, oldPassword, newPassword, confirmPassword } = {}) {
  const me = await getCurrentUser()
  if (!me) throw new ApiError('未登录，请重新登录', 401)
  if (!oldPassword) throw new ApiError('请输入原密码', 400)
  if (!newPassword) throw new ApiError('请输入新密码', 400)
  if (confirmPassword !== undefined && newPassword !== confirmPassword) {
    throw new ApiError('两次输入的密码不一致', 400)
  }
  // 账号必须匹配当前登录用户（防止越权修改他人密码）
  const row = username ? await userRepository.findByUsername(username) : null
  if (!row || row.id !== me.id) {
    throw new ApiError('账号信息不存在', 404)
  }
  if (!passwordService.verifyPassword(oldPassword, row.password_hash)) {
    throw new ApiError('原密码不正确', 400)
  }
  passwordService.validatePassword(newPassword)
  const hash = passwordService.hashPassword(newPassword)
  await userRepository.updateById(row.id, { password_hash: hash, must_change_password: 0 })
  // 刷新内存缓存中的登录态
  currentUser = toSafeUser({ ...row, password_hash: hash, must_change_password: 0 })
  return true
}

module.exports = { login, logout, switchByTicket, getCurrentUser, isAdmin, changePassword, toSafeUser }
