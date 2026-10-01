/**
 * 密码服务（Service Layer）—— 哈希 / 强度校验 / 角色默认密码
 *
 * 密码规则（需求约定）：
 *   1. 密码长度至少 6 位；
 *   2. 必须包含大写字母；
 *   3. 必须包含小写字母；
 *   4. 允许包含数字和特殊字符；
 *   5. 密码区分大小写；
 *   6. 确认密码必须与密码一致（由调用方校验）。
 * 存储一律使用 bcrypt 哈希（bcryptjs），不保存明文。
 */
const bcrypt = require('bcryptjs')
const { BCRYPT_ROUNDS, PASSWORD_MIN_LENGTH, DEFAULT_PASSWORD_BY_ROLE } = require('../../shared/constants')
const ApiError = require('./apiError')

// 角色默认密码（新增用户未填写密码 / 管理员重置时使用，分角色不同）
function defaultPasswordForRole(role) {
  const pwd = DEFAULT_PASSWORD_BY_ROLE[role]
  if (!pwd) throw new ApiError(`未知角色：${role}`, 400)
  return pwd
}

// 密码强度校验：不通过抛 ApiError
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    throw new ApiError('请输入密码', 400)
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new ApiError(`密码长度至少 ${PASSWORD_MIN_LENGTH} 位`, 400)
  }
  if (!/[A-Z]/.test(password)) {
    throw new ApiError('密码必须包含大写字母', 400)
  }
  if (!/[a-z]/.test(password)) {
    throw new ApiError('密码必须包含小写字母', 400)
  }
}

// 生成 bcrypt 哈希
function hashPassword(password) {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS)
}

// 校验明文与哈希是否匹配（bcrypt 内部按大小写敏感比对）
function verifyPassword(password, passwordHash) {
  if (!password || !passwordHash) return false
  return bcrypt.compareSync(password, passwordHash)
}

module.exports = { defaultPasswordForRole, validatePassword, hashPassword, verifyPassword }
