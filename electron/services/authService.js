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
// 操作日志：账号增删改等管理操作落审计
const operationLogService = require('./operationLogService')
// 前后端共享常量（角色 / 密码长度 / bcrypt 成本等），单一事实来源，避免硬编码散落
const {
  ROLE_SUPER_ADMIN,
  ROLE_GROUP_ADMIN,
  ROLE_MENTOR,
  ROLE_STUDENT,
  ACCOUNT_STATUS_DISABLED,
  ACCOUNT_STATUS_LEAVE,
  DEFAULT_PASSWORD_BY_ROLE,
  BCRYPT_ROUNDS
} = require('../../shared/constants')

/** 进程内的当前登录用户（未落库，仅随进程存活） */
let currentUser = null

// 是否超级管理员（平台运维 / 全平台账号管理）
function isAdmin() {
  return !!currentUser && currentUser.role === ROLE_SUPER_ADMIN
}

// 是否课题组管理员（组内最高管理角色）
function isGroupAdmin() {
  return !!currentUser && currentUser.role === ROLE_GROUP_ADMIN
}

// 是否组内管理角色（课题组管理员或导师）：可执行组内管理类写操作
function isGroupManager() {
  return !!currentUser && (currentUser.role === ROLE_GROUP_ADMIN || currentUser.role === ROLE_MENTOR)
}

// 合法角色白名单（四类角色）
const VALID_ROLES = [ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN, ROLE_MENTOR, ROLE_STUDENT]

// 规范化角色：白名单内的原样返回；非法 / 空值回退到「学生」
function normalizeRole(role) {
  return VALID_ROLES.includes(role) ? role : ROLE_STUDENT
}

// 角色默认密码：按角色取固定初始密码；未知角色回退学生密码
function defaultPasswordForRole(role) {
  const r = VALID_ROLES.includes(role) ? role : ROLE_STUDENT
  return DEFAULT_PASSWORD_BY_ROLE[r] || DEFAULT_PASSWORD_BY_ROLE[ROLE_STUDENT]
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
      status: user.status,
      mustChangePassword: !!user.must_change_password
    }
    return { success: true, message: '登录成功', user: currentUser }
  } catch (err) {
    console.error('[authService.login] 数据库异常:', err)
    return { success: false, message: '数据库连接失败，请检查数据库服务' }
  }
}

// 退出登录：清空会话
function logout() {
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
    // 改密成功后：若处于「首次登录强制改密」状态，一并解除（must_change_password 0）
    await userRepository.updateById(user.id, {
      password: hash,
      must_change_password: 0
    })
    // 同步进程内会话状态，让当前会话立即解除强制改密
    if (currentUser && currentUser.id === user.id) {
      currentUser.mustChangePassword = false
    }
    return { success: true, message: '密码已修改' }
  } catch (err) {
    console.error('[authService.changePassword] 数据库异常:', err)
    return { success: false, message: '修改失败，请稍后重试' }
  }
}

// 用户列表：超级管理员 / 课题组管理员 / 导师可查看（供管理端成员选择使用）
async function listUsers() {
  if (!currentUser) return { success: false, message: '未登录，请重新登录' }
  if (!isAdmin() && !isGroupAdmin() && currentUser.role !== ROLE_MENTOR) {
    return { success: false, message: '无权限：仅超级管理员、课题组管理员和导师可查看成员列表' }
  }
  try {
    const users = await userRepository.list()
    return { success: true, users }
  } catch (err) {
    console.error('[authService.listUsers] 数据库异常:', err)
    return { success: false, message: '读取用户列表失败' }
  }
}

// 成员列表（轻量，所有登录用户可读）：供前端「关联字段下拉选人」使用。
// 仅返回 id / username / role，不含任何敏感字段。
async function listMembers() {
  if (!currentUser) return { success: false, message: '未登录，请重新登录' }
  try {
    const users = await userRepository.list()
    const members = users.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role
    }))
    return { success: true, members }
  } catch (err) {
    console.error('[authService.listMembers] 数据库异常:', err)
    return { success: false, message: '读取成员列表失败' }
  }
}

// 新增用户：初始密码 = 该角色默认密码（首次登录强制修改）；用 runTransaction 包裹「查重 + 插入」保证原子性。
// 权限：超级管理员（平台账号）/ 课题组管理员（本组成员）均可创建。
// 用户表当前仅保留登录必需字段，额外档案字段由 userRepository 白名单过滤丢弃。
async function createUser(payload) {
  if (!isAdmin() && !isGroupAdmin()) return { success: false, message: '无权限：仅超级管理员与课题组管理员可创建用户' }
  const { username, role, ...profile } = payload || {}
  if (!username || !username.trim()) return { success: false, message: '账号不能为空' }
  // 角色：super_admin 超级管理员 / group_admin 课题组管理员 / mentor 导师 / student 学生，非法值回退「学生」
  const roleVal = normalizeRole(role)
  const plain = defaultPasswordForRole(roleVal)
  try {
    let createdId = null
    // runTransaction 内部两步通过 acquireConn 自动拿到同一事务连接（无需显式传参）
    const result = await runTransaction(async () => {
      const exist = await userRepository.findByUsername(username.trim())
      if (exist) return { success: false, message: '该账号已存在' }
      const hash = await bcrypt.hash(plain, BCRYPT_ROUNDS)
      createdId = await userRepository.createUser({ username: username.trim(), passwordHash: hash, role: roleVal, ...profile })
      return { success: true, id: createdId, message: '用户创建成功', plainPassword: plain }
    })
    if (result && result.success) {
      operationLogService.writeLog({
        action: 'createUser',
        targetType: 'user',
        targetId: result.id,
        detail: `创建账号 ${username.trim()}（角色 ${roleVal}）`
      })
    }
    return result
  } catch (err) {
    console.error('[authService.createUser] 数据库异常:', err)
    return { success: false, message: '创建失败：' + (err && err.message ? err.message : '请稍后重试') }
  }
}

/**
 * 批量新增用户（成员管理 → 批量导入）。
 * 逐行校验：账号必填 / 账号查重 / 角色合法；失败行记录原因，不阻断其他行。
 * 初始密码 = 各角色默认密码（首次登录强制修改）；每种角色只哈希一次，避免重复计算。
 * 成功行用事务统一插入，返回成功条数与失败明细，便于前端一次性提示。
 * @param {{ users: Array<{ username, role, ... }> }} payload
 */
async function batchCreateUsers(payload) {
  if (!isAdmin() && !isGroupAdmin()) return { success: false, message: '无权限：仅超级管理员与课题组管理员可批量创建用户' }
  const users = payload && payload.users
  if (!Array.isArray(users) || !users.length) return { success: false, message: '没有可导入的用户数据' }
  if (users.length > 500) return { success: false, message: '单次最多导入 500 条' }
  try {
    // 一次性查出所有已存在账号，内存去重判断（避免逐行查库）
    const existingRows = await userRepository.list()
    const existingSet = new Set(existingRows.map((u) => u.username))

    const failedRows = []
    const validRows = []
    users.forEach((u, idx) => {
      const rowNo = u.__row || idx + 1
      const username = u && u.username ? String(u.username).trim() : ''
      if (!username) {
        failedRows.push({ row: rowNo, username: '', reason: '账号不能为空' })
        return
      }
      if (existingSet.has(username)) {
        failedRows.push({ row: rowNo, username, reason: '账号已存在' })
        return
      }
      const roleVal = normalizeRole(u.role)
      if (u.role && !VALID_ROLES.includes(roleVal)) {
        failedRows.push({ row: rowNo, username, reason: '角色不合法（应为：超级管理员/课题组管理员/导师/学生）' })
        return
      }
      existingSet.add(username) // 防止同一批内重复
      validRows.push({ username, role: roleVal, __profile: u })
    })

    if (!validRows.length) {
      return { success: false, message: '没有可导入的有效数据', failedRows }
    }

    // 各角色默认密码（单一事实来源）；按角色缓存哈希，避免每行重复 bcrypt
    const hashCache = {}
    const plainPasswords = {}
    for (const role of VALID_ROLES) {
      const plain = defaultPasswordForRole(role)
      plainPasswords[role] = plain
      hashCache[role] = await bcrypt.hash(plain, BCRYPT_ROUNDS)
    }

    let createdCount = 0
    await runTransaction(async () => {
      for (const row of validRows) {
        const hash = hashCache[row.role] || hashCache[ROLE_STUDENT]
        await userRepository.createUser({
          username: row.username,
          passwordHash: hash,
          role: row.role,
          ...row.__profile
        })
        createdCount += 1
      }
    })
    const result = {
      success: true,
      message: `成功导入 ${createdCount} 条${failedRows.length ? `，失败 ${failedRows.length} 条` : ''}`,
      createdCount,
      failedRows,
      plainPasswords
    }
    operationLogService.writeLog({
      action: 'batchCreateUsers',
      targetType: 'user',
      targetId: 0,
      detail: `批量导入用户：成功 ${createdCount} 条，失败 ${failedRows.length} 条`
    })
    return result
  } catch (err) {
    console.error('[authService.batchCreateUsers] 数据库异常:', err)
    return { success: false, message: '批量导入失败：' + (err && err.message ? err.message : '请稍后重试') }
  }
}

// 编辑用户：可改角色 / 重置密码 / 更新档案；仅组装需要更新的字段（增量更新）。
// password 字段在此显式丢弃（改密走 changePassword，重置走 resetPassword），防止前端直接改密。
async function updateUser(payload) {
  if (!isAdmin() && !isGroupAdmin()) return { success: false, message: '无权限：仅超级管理员与课题组管理员可管理用户' }
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
      // 重置为该角色默认密码，并置 must_change_password=1：下次登录需先修改密码
      plainPassword = defaultPasswordForRole(exist.role)
      data.password = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS)
      data.must_change_password = 1
    }
    // 有字段变化才更新（复用基类的增量更新 buildUpdateSet；字段白名单过滤见 userRepository.updateById）
    if (Object.keys(data).length) {
      await userRepository.updateById(id, data)
    }
    const changed = ['role', 'status', 'password', 'must_change_password'].filter((k) => data[k] !== undefined)
    operationLogService.writeLog({
      action: 'updateUser',
      targetType: 'user',
      targetId: id,
      detail: `编辑账号 ${exist.username}（变更字段：${changed.join(', ') || '无'}${resetPassword ? '，并重置密码' : ''}）`
    })
    return { success: true, message: '保存成功', plainPassword }
  } catch (err) {
    console.error('[authService.updateUser] 数据库异常:', err)
    return { success: false, message: '更新失败：' + (err && err.message ? err.message : '请稍后重试') }
  }
}

// 删除用户：硬删除，禁止删自己
async function deleteUser({ id }) {
  if (!isAdmin() && !isGroupAdmin()) return { success: false, message: '无权限：仅超级管理员与课题组管理员可删除用户' }
  if (!id) return { success: false, message: '缺少用户标识' }
  if (currentUser && currentUser.id === id) {
    return { success: false, message: '不能删除当前登录的账号' }
  }
  try {
    const exist = await userRepository.findById(id)
    if (!exist) return { success: false, message: '用户不存在' }
    await userRepository.delete(id)
    operationLogService.writeLog({
      action: 'deleteUser',
      targetType: 'user',
      targetId: id,
      detail: `删除账号 ${exist.username}`
    })
    return { success: true, message: '已删除' }
  } catch (err) {
    console.error('[authService.deleteUser] 数据库异常:', err)
    return { success: false, message: '删除失败：' + (err && err.message ? err.message : '请稍后重试') }
  }
}

// 读取当前登录用户自己的完整档案（不含 password）：当前用户表仅保留登录必需字段，
// 返回 id / username / role / status / must_change_password，供个人资料页展示。
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

module.exports = {
  ROLE_SUPER_ADMIN,
  ROLE_GROUP_ADMIN,
  ROLE_MENTOR,
  ROLE_STUDENT,
  isAdmin,
  isGroupAdmin,
  isGroupManager,
  login,
  logout,
  getCurrentUser,
  changePassword,
  listUsers,
  listMembers,
  createUser,
  batchCreateUsers,
  updateUser,
  getMyProfile,
  deleteUser
}
