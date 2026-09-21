/**
 * 认证服务（Service Layer）—— 会话状态与用户业务
 *
 * 职责：
 *   1. 进程内会话状态（当前登录用户 currentUser，随进程存活，不落库）；
 *   2. 登录 / 退出 / 取当前用户；
 *   3. 用户管理：改密、列表、新增、编辑（重置密码）、删除——全部只调 userRepository，
 *      绝不在此处直接写 SQL；需要事务时用 runTransaction 包裹，事务连接经连接层透明传递。
 *
 * 上层（ipc/auth.js）只调用这里暴露的方法，不接触 bcrypt / 仓库细节。
 * 角色 / 密码长度 / bcrypt 成本等魔法值统一来自 shared/constants.js（前后端共享）。
 */
const bcrypt = require('bcryptjs')
// 用户仓库：所有 user 表的数据访问集中于此（含裸 SQL）
const userRepository = require('../db/repositories/userRepository')
// 事务上下文：createUser 用它保证「查重 + 插入」在同一连接上原子执行
const { runTransaction } = require('../db/connection')
// 操作日志（登录 / 退出 / 用户增删改的审计追溯）
const logService = require('./logService')
// 前后端共享常量（角色 / 密码长度 / bcrypt 成本等），单一事实来源，避免硬编码散落
const { ROLE_ADMIN, ROLE_MENTOR, ROLE_STUDENT, ROLE_USER, ACCOUNT_STATUS_DISABLED, ACCOUNT_STATUS_LEAVE, DEFAULT_PASSWORD_LENGTH, BCRYPT_ROUNDS } = require('../../shared/constants')

/** 进程内的当前登录用户（未落库，仅随进程存活） */
let currentUser = null

// 是否管理员（可进用户管理）
function isAdmin() {
  return !!currentUser && currentUser.role === ROLE_ADMIN
}

// 合法角色白名单（三角色 + 兼容历史 user）
const VALID_ROLES = [ROLE_ADMIN, ROLE_MENTOR, ROLE_STUDENT, ROLE_USER]

// 规范化角色：白名单内的原样返回；非法 / 空值回退到「学生」
function normalizeRole(role) {
  return VALID_ROLES.includes(role) ? role : ROLE_STUDENT
}

// 生成 DEFAULT_PASSWORD_LENGTH 位数字随机密码（新增 / 重置用户密码时使用）
function genRandomPassword() {
  const min = Math.pow(10, DEFAULT_PASSWORD_LENGTH - 1)
  const max = Math.pow(10, DEFAULT_PASSWORD_LENGTH) - 1
  return String(Math.floor(min + Math.random() * (max - min + 1)))
}

/**
 * 登录：校验用户名 + 密码，成功后写入会话。
 * @param {{ username: string, password: string }} payload
 */
async function login({ username, password }) {
  if (!username || !password) {
    return { success: false, message: '请输入账号和密码' }
  }
  try {
    // 只调用 Repository，绝不直接写 SQL
    const user = await userRepository.findByUsername(username)
    if (!user) {
      return { success: false, message: '用户名或密码错误，请重试' }
    }
    // 账号状态拦截：禁用 / 离组账号拒绝登录（active 正常账号放行）
    if (user.status === ACCOUNT_STATUS_DISABLED) {
      return { success: false, message: '该账号已被禁用，请联系管理员' }
    }
    if (user.status === ACCOUNT_STATUS_LEAVE) {
      return { success: false, message: '该账号已离组，无法登录' }
    }
    const ok = await bcrypt.compare(password, user.password)
    if (!ok) {
      return { success: false, message: '用户名或密码错误，请重试' }
    }
    currentUser = {
      id: user.id,
      username: user.username,
      role: user.role,
      real_name: user.real_name,
      created_at: user.created_at
    }
    logService.record('login', 'user', user.id)
    return { success: true, message: '登录成功', user: currentUser }
  } catch (err) {
    console.error('[authService.login] 数据库异常:', err)
    return { success: false, message: '数据库连接失败，请检查数据库服务' }
  }
}

// 退出登录：清空会话
function logout() {
  if (currentUser) logService.record('logout', 'user', currentUser.id)
  currentUser = null
  return { success: true }
}

// 取当前登录用户（未登录返回 null）
function getCurrentUser() {
  return currentUser
}

/**
 * 修改密码：校验原密码后更新。
 * @param {{ username: string, oldPassword: string, newPassword: string }} payload
 */
async function changePassword({ username, oldPassword, newPassword }) {
  if (!oldPassword || !newPassword) {
    return { success: false, message: '请填写完整的密码信息' }
  }
  try {
    const user = await userRepository.findByUsername(username)
    if (!user) {
      return { success: false, message: '用户不存在' }
    }
    const ok = await bcrypt.compare(oldPassword, user.password)
    if (!ok) {
      return { success: false, message: '原密码不正确' }
    }
    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
    await userRepository.updatePassword(username, hash)
    return { success: true, message: '密码已修改' }
  } catch (err) {
    console.error('[authService.changePassword] 数据库异常:', err)
    return { success: false, message: '修改失败，请稍后重试' }
  }
}

// 用户列表：管理员和导师均可查看（导师只读，新增/编辑/删除由各自接口校验）
async function listUsers() {
  if (!currentUser) return { success: false, message: '未登录，请重新登录' }
  if (currentUser.role !== ROLE_ADMIN && currentUser.role !== ROLE_MENTOR) {
    return { success: false, message: '无权限：仅管理员和导师可查看成员列表' }
  }
  try {
    const filters = {}
    if (currentUser.role === ROLE_MENTOR) { filters.advisor_id = currentUser.id }
    const users = await userRepository.list(filters)
    return { success: true, users }
  } catch (err) {
    console.error('[authService.listUsers] 数据库异常:', err)
    return { success: false, message: '读取用户列表失败' }
  }
}

// 成员列表（轻量，所有登录用户可读）：供前端「关联字段下拉选人」使用。
// 仅返回 id / username / real_name / role，不含任何敏感字段。
async function listMembers() {
  if (!currentUser) return { success: false, message: '未登录，请重新登录' }
  try {
    const users = await userRepository.list()
    const members = users.map((u) => ({
      id: u.id,
      username: u.username,
      real_name: u.real_name,
      role: u.role,
      advisor_id: u.advisor_id
    }))
    return { success: true, members }
  } catch (err) {
    console.error('[authService.listMembers] 数据库异常:', err)
    return { success: false, message: '读取成员列表失败' }
  }
}

// 新增用户：随机密码；用 runTransaction 包裹「查重 + 插入」保证原子性。
// 支持携带档案字段（real_name / student_no / college 等，白名单过滤见 userRepository）
async function createUser(payload) {
  if (!isAdmin()) return { success: false, message: '无权限：仅管理员可创建用户' }
  const { username, role, ...profile } = payload || {}
  if (!username || !username.trim()) return { success: false, message: '账号不能为空' }
  // 角色：admin 管理员 / mentor 导师 / student 学生（user 兼容历史），非法值回退「学生」
  const roleVal = normalizeRole(role)
  const plain = genRandomPassword()
  try {
    // 新用户 id 在事务内捕获，事务提交后再写操作日志（避免在事务回调内 fire-and-forget 触发连接竞态）
    let createdId = null
    // runTransaction 内部两步通过 acquireConn 自动拿到同一事务连接（无需显式传参）
    const result = await runTransaction(async () => {
      const exist = await userRepository.findByUsername(username.trim())
      if (exist) return { success: false, message: '该账号已存在' }
      const hash = await bcrypt.hash(plain, BCRYPT_ROUNDS)
      createdId = await userRepository.createUser({ username: username.trim(), passwordHash: hash, role: roleVal, ...profile })
      return { success: true, id: createdId, message: '用户创建成功', plainPassword: plain }
    })
    if (result && result.success) logService.record('create', 'user', createdId)
    return result
  } catch (err) {
    console.error('[authService.createUser] 数据库异常:', err)
    return { success: false, message: '创建失败：' + (err && err.message ? err.message : '请稍后重试') }
  }
}

// 编辑用户：可改角色 / 重置密码 / 更新档案；仅组装需要更新的字段（增量更新）。
// password 字段在此显式丢弃（改密走 changePassword，重置走 resetPassword），防止前端直接改密。
async function updateUser(payload) {
  if (!isAdmin()) return { success: false, message: '无权限：仅管理员可管理用户' }
  const { id, role, resetPassword, password: _ignoredPassword, ...profile } = payload || {}
  if (!id) return { success: false, message: '缺少用户标识' }
  try {
    const exist = await userRepository.findById(id)
    if (!exist) return { success: false, message: '用户不存在' }
    const data = { ...profile }
    // 规范化角色（与 createUser 一致），并禁止修改当前登录账号自身的角色（防止自我降级导致系统无管理员）
    if (role) {
      const roleVal = normalizeRole(role)
      if (currentUser && currentUser.id === id && roleVal !== exist.role) {
        return { success: false, message: '不能修改当前登录账号的角色' }
      }
      data.role = roleVal
    }
    let plainPassword = null
    if (resetPassword) {
      plainPassword = genRandomPassword()
      data.password = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS)
    }
    // 有字段变化才更新（复用基类的增量更新 buildUpdateSet；字段白名单过滤见 userRepository.updateById）
    if (Object.keys(data).length) {
      await userRepository.updateById(id, data)
    }
    logService.record('update', 'user', id)
    return { success: true, message: '保存成功', plainPassword }
  } catch (err) {
    console.error('[authService.updateUser] 数据库异常:', err)
    return { success: false, message: '更新失败：' + (err && err.message ? err.message : '请稍后重试') }
  }
}

// 删除用户：硬删除，禁止删自己
async function deleteUser({ id }) {
  if (!isAdmin()) return { success: false, message: '无权限：仅管理员可删除用户' }
  if (!id) return { success: false, message: '缺少用户标识' }
  if (currentUser && currentUser.id === id) {
    return { success: false, message: '不能删除当前登录的账号' }
  }
  try {
    const exist = await userRepository.findById(id)
    if (!exist) return { success: false, message: '用户不存在' }
    await userRepository.delete(id)
    logService.record('delete', 'user', id)
    return { success: true, message: '已删除' }
  } catch (err) {
    console.error('[authService.deleteUser] 数据库异常:', err)
    return { success: false, message: '删除失败：' + (err && err.message ? err.message : '请稍后重试') }
  }
}

// 读取当前登录用户自己的完整档案（不含 password），供「学术档案 / 个人设置」回显
async function getMyProfile() {
  if (!currentUser) return { success: false, message: '未登录，请重新登录' }
  try {
    const user = await userRepository.findByUsername(currentUser.username)
    if (!user) return { success: false, message: '用户不存在' }
    // 去掉 password，仅返回安全列
    const { password, ...profile } = user
    return { success: true, profile }
  } catch (err) {
    console.error('[authService.getMyProfile] 数据库异常:', err)
    return { success: false, message: '读取档案失败，请稍后重试' }
  }
}

// 更新当前登录用户自己的档案（仅档案字段，白名单过滤见 userRepository.updateById）。
// 与 updateUser（管理员管理所有用户）区分：普通用户只能改自己，且不能改角色/账号/密码。
async function updateMyProfile(payload) {
  if (!currentUser) return { success: false, message: '未登录，请重新登录' }
  try {
    // 显式丢弃 role / password / username / id 等敏感字段，防止通过「改自己」接口越权改角色或改密
    const { role, password, username, id, ...profile } = payload || {}
    await userRepository.updateById(currentUser.id, profile)
    // 同步会话中的姓名显示，让顶栏/个人主页立即生效
    if (profile && profile.real_name) currentUser.real_name = profile.real_name
    return { success: true, message: '保存成功' }
  } catch (err) {
    console.error('[authService.updateMyProfile] 数据库异常:', err)
    return { success: false, message: '保存失败，请稍后重试' }
  }
}

module.exports = {
  ROLE_ADMIN,
  isAdmin,
  login,
  logout,
  getCurrentUser,
  changePassword,
  listUsers,
  listMembers,
  createUser,
  updateUser,
  getMyProfile,
  updateMyProfile,
  deleteUser
}
