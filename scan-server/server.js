/**
 * 扫码登录公网确认服务（可独立部署到公网服务器）
 *
 * 职责：签发扫码 ticket、托管手机确认页、中转账号密码凭据。
 * 账号密码验证由桌面端完成（本服务不连数据库），凭据仅内存短时保留、取走即清。
 *
 * 部署：node server.js（需 Node ≥ 18，内置 fetch 由调用方使用，本服务零依赖）。
 * 生产环境必须置于 HTTPS 反向代理（nginx / caddy）之后。
 *
 * ticket 状态机：
 *   pending（已签发）→ scanned（手机打开确认页）→ submitted（提交凭据）
 *     → verifying（桌面端取走凭据验证中）→ approved / verify-failed
 *   pending → denied（手机端拒绝）| expired（TTL 到期）
 *
 * 安全规则：
 *   - ticket 一次一码，TTL 120s；
 *   - 同一 ticket 最多提交 5 次凭据（防爆破）；
 *   - 凭据取走即清，不落盘、不进日志。
 */
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const PORT = Number(process.env.PORT) || 8787
const TICKET_TTL_MS = 120 * 1000
const MAX_CONFIRM_ATTEMPTS = 5

// ticket -> { status, createdAt, attempts, username, password, user, error }
const tickets = new Map()

function ok(data) {
  return { success: true, code: 0, message: 'success', data: data === undefined ? null : data }
}
function fail(message, code = 400) {
  return { success: false, code, message, data: null }
}

function sendJson(res, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > 64 * 1024) {
        req.destroy()
        resolve(null)
      }
    })
    req.on('end', () => {
      if (data === null) return resolve(null)
      try {
        resolve(JSON.parse(data || '{}'))
      } catch (e) {
        resolve({})
      }
    })
    req.on('error', () => resolve(null))
  })
}

// 取有效 ticket：不存在或已过期返回 null（过期即从内存清除）
function getLive(ticket) {
  if (!ticket) return null
  const t = tickets.get(ticket)
  if (!t) return null
  if (t.createdAt + TICKET_TTL_MS <= Date.now()) {
    tickets.delete(ticket)
    return null
  }
  return t
}

// 确认页静态 HTML（启动时读入内存）
const CONFIRM_PAGE = fs.readFileSync(path.join(__dirname, 'confirm.html'), 'utf8')

// 构建 HTTP 应用（路由与 ticket 状态机），供独立启动或主进程内嵌复用
function createApp() {
  return http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const pathname = url.pathname
  try {
    // 手机确认页：打开即标记 scanned
    const scanMatch = pathname.match(/^\/scan\/([A-Za-z0-9-]+)$/)
    if (scanMatch && req.method === 'GET') {
      const ticket = scanMatch[1]
      const t = getLive(ticket)
      if (!t) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
        return res.end('二维码已失效')
      }
      if (t.status === 'pending') t.status = 'scanned'
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
      return res.end(CONFIRM_PAGE)
    }

    if (pathname === '/health' && req.method === 'GET') {
      return sendJson(res, ok({ service: 'scan-server', uptime: Math.round(process.uptime()) }))
    }

    // 签发 ticket：桌面端调用，返回 ticket（qrUrl 由桌面端拼接）
    if (pathname === '/api/scan/create' && req.method === 'POST') {
      const ticket = crypto.randomUUID()
      tickets.set(ticket, { status: 'pending', createdAt: Date.now(), attempts: 0 })
      return sendJson(res, ok({ ticket }))
    }

    // 状态查询：桌面端轮询与手机确认页共用
    if (pathname === '/api/scan/status' && req.method === 'GET') {
      const t = getLive(url.searchParams.get('ticket'))
      if (!t) return sendJson(res, ok({ status: 'expired' }))
      const out = { status: t.status }
      if (t.status === 'approved' && t.user) out.user = t.user
      if (t.status === 'verify-failed' && t.error) out.message = t.error
      return sendJson(res, ok(out))
    }

    // 手机端提交账号密码：置 submitted 并暂存凭据
    if (pathname === '/api/scan/confirm' && req.method === 'POST') {
      const body = await readBody(req)
      const t = getLive(body && body.ticket)
      if (!t) return sendJson(res, fail('二维码已失效', 400))
      if (t.status !== 'scanned' && t.status !== 'verify-failed') {
        return sendJson(res, fail('当前状态不可提交', 400))
      }
      if (t.attempts >= MAX_CONFIRM_ATTEMPTS) {
        return sendJson(res, fail('尝试次数过多，请让电脑端刷新二维码', 400))
      }
      if (!body.username || !body.password) {
        return sendJson(res, fail('请输入账号和密码', 400))
      }
      t.attempts++
      t.status = 'submitted'
      t.username = String(body.username)
      t.password = String(body.password)
      t.error = null
      return sendJson(res, ok({ status: 'submitted' }))
    }

    // 桌面端取凭据：一次性（取走即清），置 verifying
    if (pathname === '/api/scan/credential' && req.method === 'GET') {
      const t = getLive(url.searchParams.get('ticket'))
      if (!t) return sendJson(res, fail('二维码已失效', 400))
      if (t.status !== 'submitted' || !t.username) {
        return sendJson(res, ok({ ready: false }))
      }
      const cred = { username: t.username, password: t.password }
      t.username = null
      t.password = null
      t.status = 'verifying'
      return sendJson(res, ok({ ready: true, ...cred }))
    }

    // 桌面端回填验证结果：user 成功 / error 失败
    if (pathname === '/api/scan/approve' && req.method === 'POST') {
      const body = await readBody(req)
      const t = getLive(body && body.ticket)
      if (!t) return sendJson(res, fail('二维码已失效', 400))
      if (body && body.error) {
        t.status = 'verify-failed'
        t.error = String(body.error)
        t.user = null
      } else if (body && body.user) {
        t.status = 'approved'
        t.user = body.user
      }
      return sendJson(res, ok({ status: t.status }))
    }

    // 手机端拒绝登录（终态保护：approved / denied 不再被覆盖，防止登录成功后误显示"已取消"）
    if (pathname === '/api/scan/deny' && req.method === 'POST') {
      const body = await readBody(req)
      const t = getLive(body && body.ticket)
      if (!t) return sendJson(res, fail('二维码已失效', 400))
      if (t.status === 'approved' || t.status === 'denied') {
        return sendJson(res, ok({ status: t.status }))
      }
      t.status = 'denied'
      return sendJson(res, ok({ status: 'denied' }))
    }

    sendJson(res, fail('Not Found', 404))
  } catch (e) {
    console.error('[scan-server] 未预期异常:', e)
    sendJson(res, fail('服务器内部错误', 500))
  }
  })
}

// 周期清理过期 ticket，防止内存无限增长
function startSweeper() {
  setInterval(() => {
    const now = Date.now()
    for (const [id, t] of tickets) {
      if (t.createdAt + TICKET_TTL_MS <= now) tickets.delete(id)
    }
  }, 30 * 1000).unref()
}

/**
 * 启动服务。
 * - 独立运行（node server.js）：默认监听 0.0.0.0:8787，供公网部署；
 * - 被桌面端 require（本地模式）：监听 127.0.0.1，端口被占用时视为复用已有实例。
 */
async function startServer(options = {}) {
  const port = options.port || PORT
  const host = options.host || '0.0.0.0'
  const server = createApp()
  startSweeper()
  return new Promise((resolve, reject) => {
    server.once('error', (err) => {
      if (err && err.code === 'EADDRINUSE') return resolve({ reused: true, port })
      reject(err)
    })
    server.listen(port, host, () => resolve({ reused: false, port, host }))
  })
}

module.exports = { startServer }

if (require.main === module) {
  startServer()
    .then((info) => {
      console.log(`scan-server listening on :${info.port}${info.reused ? '（端口已被占用，复用现有实例）' : ''}`)
    })
    .catch((err) => {
      console.error('[scan-server] 启动失败:', err)
      process.exit(1)
    })
}
