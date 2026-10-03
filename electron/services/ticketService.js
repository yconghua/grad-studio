/**
 * 免密票据服务（本地信任凭证）—— 仅用于「登录后切换账号」路径
 *
 * 设计要点：
 *   - 密码登录成功 / 免密切换成功时签发或刷新（有效期 7 天滚动）；
 *   - 签名 = HMAC-SHA256(本机随机密钥, username:expireAt)，防本地篡改；
 *   - 密钥与票据存 userData 目录，渲染层不可直接读写，只能经 IPC 调用；
 *   - 不提供吊销：主动退出登录不删票据，唯一失效途径是 7 天到期。
 */
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { app } = require('electron')

// 票据有效期：7 天（每次签发 / 免密切换成功都刷新）
const TICKET_MS = 7 * 24 * 60 * 60 * 1000

function keyPath() {
  try {
    return path.join(app.getPath('userData'), 'auth-secret.key')
  } catch (e) {
    return path.join(__dirname, '..', 'auth-secret.key')
  }
}

function ticketsPath() {
  try {
    return path.join(app.getPath('userData'), 'auth-tickets.json')
  } catch (e) {
    return path.join(__dirname, '..', 'auth-tickets.json')
  }
}

// 本机密钥（首次启动生成 32 字节随机数并落盘）
let secret = null
// 票据表：{ [username]: { expireAt, sig } }
let tickets = null

// 常量比对（长度恒定，防时序侧信道）
function safeEqual(a, b) {
  const ba = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

// 计算签名：HMAC-SHA256(secret, username:expireAt)
function sign(username, expireAt) {
  return crypto.createHmac('sha256', secret).update(username + ':' + expireAt).digest('hex')
}

// 读取票据并清理过期项；文件缺失 / 损坏返回空表
function loadTickets() {
  try {
    const p = ticketsPath()
    if (fs.existsSync(p)) {
      const raw = JSON.parse(fs.readFileSync(p, 'utf8'))
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const now = Date.now()
        const clean = {}
        for (const [name, t] of Object.entries(raw)) {
          if (t && typeof t.expireAt === 'number' && t.expireAt > now) {
            clean[name] = { expireAt: t.expireAt, sig: t.sig || '' }
          }
        }
        return clean
      }
    }
  } catch (e) {
    console.error('[ticketService] 读取票据失败:', e)
  }
  return {}
}

function saveTickets() {
  try {
    fs.writeFileSync(ticketsPath(), JSON.stringify(tickets, null, 2))
  } catch (e) {
    console.error('[ticketService] 写入票据失败:', e)
  }
}

// 初始化：加载 / 生成密钥 + 加载票据。由 main.js 在 app ready 后调用
function init() {
  try {
    const p = keyPath()
    if (fs.existsSync(p)) {
      secret = fs.readFileSync(p)
    } else {
      secret = crypto.randomBytes(32)
      fs.writeFileSync(p, secret)
    }
  } catch (e) {
    // 密钥读写失败时退化为进程内随机密钥：重启后票据失效，可接受
    console.error('[ticketService] 密钥初始化失败:', e)
    secret = crypto.randomBytes(32)
  }
  tickets = loadTickets()
}

// 签发 / 刷新：登录成功或免密切换成功时调用
function issue(username) {
  if (!secret) init()
  if (!username || typeof username !== 'string') return false
  const expireAt = Date.now() + TICKET_MS
  tickets[username] = { expireAt, sig: sign(username, expireAt) }
  saveTickets()
  return true
}

// 校验并刷新：签名 + 有效期都通过则延长 7 天并写盘，返回 true
function verifyAndRefresh(username) {
  if (!secret) init()
  const t = tickets && tickets[username]
  if (!t) return false
  const now = Date.now()
  if (t.expireAt <= now) {
    delete tickets[username]
    saveTickets()
    return false
  }
  if (!safeEqual(t.sig, sign(username, t.expireAt))) return false
  t.expireAt = now + TICKET_MS
  t.sig = sign(username, t.expireAt)
  saveTickets()
  return true
}

// 查询单个账号是否有有效票据（不刷新、不写盘）
function status(username) {
  if (!secret) init()
  const t = tickets && tickets[username]
  if (!t) return false
  if (t.expireAt <= Date.now()) return false
  return safeEqual(t.sig, sign(username, t.expireAt))
}

// 当前所有有效票据的账号名（供前端标注「可免密切换」）
function listValid() {
  if (!secret) init()
  const names = []
  const now = Date.now()
  for (const [name, t] of Object.entries(tickets || {})) {
    if (t.expireAt > now && safeEqual(t.sig, sign(name, t.expireAt))) names.push(name)
  }
  return names
}

module.exports = { init, issue, verifyAndRefresh, status, listValid, TICKET_MS }
