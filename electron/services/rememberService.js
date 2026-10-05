/**
 * 记住我服务（RememberService）
 *
 * 职责：把「记住我」登录所需信息（账号 + 密码 + 过期时间）经 safeStorage
 * 加密持久化到 userData/remember.json；登录页挂载时读取并自动回填账号密码，
 * 用户确认后自行点击登录（免输入，非免登录）。
 *
 * 存储内容不含业务数据；Windows 下由 DPAPI 用户级加密；
 * safeStorage 不可用（无系统密钥环）时降级为不启用，不落明文。
 */
const fs = require('node:fs')
const path = require('node:path')
const { app, safeStorage } = require('electron')

// 有效期（毫秒）：7 天，每次勾选记住我登录成功时重写
const REMEMBER_MS = 7 * 24 * 60 * 60 * 1000

function filePath() {
  return path.join(app.getPath('userData'), 'remember.json')
}

// 写入记住记录：safeStorage 不可用时静默失败（不启用记住我）
function save(username, password) {
  if (!username || typeof password !== 'string' || !password) return false
  if (!safeStorage.isEncryptionAvailable()) return false
  const expireAt = Date.now() + REMEMBER_MS
  try {
    fs.writeFileSync(filePath(), safeStorage.encryptString(JSON.stringify({ username, password, expireAt })))
    return true
  } catch (err) {
    console.error('[remember] 写入失败:', err && err.message)
    return false
  }
}

// 读取记住记录：不存在 / 解密失败 / 已过期均返回 null（过期时顺带清理）
function read() {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null
    const p = filePath()
    if (!fs.existsSync(p)) return null
    const buf = fs.readFileSync(p)
    if (!buf || !buf.length) return null
    const data = JSON.parse(safeStorage.decryptString(buf))
    if (!data || !data.username || typeof data.password !== 'string' || !data.password) return null
    if (!data.expireAt || Date.now() > data.expireAt) {
      clear()
      return null
    }
    return { username: data.username, password: data.password, expireAt: data.expireAt }
  } catch (err) {
    // 解密失败（系统密钥变化 / 文件损坏）按无记录处理并清理
    clear()
    return null
  }
}

// 清除记住记录（退出登录 / 登录成功未勾选）
function clear() {
  try {
    const p = filePath()
    if (fs.existsSync(p)) fs.unlinkSync(p)
  } catch (err) {
    console.error('[remember] 清除失败:', err && err.message)
  }
}

module.exports = { save, read, clear }
