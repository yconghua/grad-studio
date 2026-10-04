/**
 * 扫码登录服务（Service Layer）—— 桌面端与确认服务（scan-server）之间的协调
 *
 * scan-server 是独立文件（可单独拷贝部署/服务器运行），由 scanServerManager 在
 * 扫码登录需要时用 Electron 自带的 Node 运行时自动拉起（新电脑无需安装 Node）。
 * 不是程序启动时默认启动——仅当用户进入扫码登录时才启动；应用退出时停止。
 *
 * ================= 支持的部署模式（仅两种，手机与电脑须在同一网络） =================
 *  ① 局域网模式：电脑与手机连同一个 WiFi
 *       二维码 = http://<电脑IP>:8787/scan/<ticket>
 *  ② 手机热点模式：电脑连手机热点，另一台手机扫码
 *       二维码 = http://<热点IP>:8787/scan/<ticket>
 * 两种模式共用同一逻辑：自动探测电脑局域网 IPv4（同一 WiFi 与热点均适用）。
 * 多网卡（虚拟机/异地组网 VPN）导致探测地址不对时，可用环境变量
 * SCAN_SERVER_BASE_URL 手动指定电脑局域网 IP，例如 'http://192.168.1.100:8787'。
 * =================================================================================
 */
const os = require('node:os')
const ApiError = require('./apiError')
const authService = require('./authService')
const scanServerManager = require('./scanServerManager')

// 探测电脑局域网 IPv4 候选：跳过回环、虚拟网卡、链路本地 169.254.x.x；
// 物理网卡（以太网/WLAN/无线/热点）排前，虚拟网卡（VMware/Hyper-V/VPN 等）排后
function detectLanIpCandidates() {
  const all = []
  const nets = os.networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const info of nets[name] || []) {
      if (info.family !== 'IPv4' || info.internal) continue
      if (info.address.startsWith('169.254.')) continue
      all.push({ name, ip: info.address })
    }
  }
  // 虚拟网卡特征（排到最后），物理网卡中优先常见命名（覆盖中英文）
  const VIRTUAL_RE = /vmware|virtualbox|hyper-?v|vethernet|tap-|zerotier|tailscale|nordvpn|wireguard|蓝牙|bluetooth/i
  const PHYSICAL_RE = /ethernet|wlan|wi-?fi|无线|本地连接|以太网/i
  const real = []
  const virtual = []
  for (const c of all) {
    ;(VIRTUAL_RE.test(c.name) ? virtual : real).push(c)
  }
  const preferred = real.find((c) => PHYSICAL_RE.test(c.name)) || real[0] || virtual[0] || null
  return { preferred, candidates: real.concat(virtual) }
}

function detectLanBaseUrl() {
  const { preferred } = detectLanIpCandidates()
  return preferred ? 'http://' + preferred.ip + ':8787' : 'http://127.0.0.1:8787'
}

// 校验并规范化确认服务地址：仅允许局域网 IP:端口 形式的 http 地址（防止被带入任意 URL）
function pickBaseUrl(baseUrl) {
  if (!baseUrl) return SCAN_SERVER_BASE_URL
  const norm = String(baseUrl).trim().replace(/\/+$/, '')
  if (/^http:\/\/\d{1,3}(\.\d{1,3}){3}:\d+$/.test(norm)) return norm
  return SCAN_SERVER_BASE_URL
}

// 候选列表（供前端多网卡时切换地址）
function listCandidates() {
  return detectLanIpCandidates().candidates.map((c) => ({
    name: c.name,
    ip: c.ip,
    baseUrl: 'http://' + c.ip + ':8787'
  }))
}

// 确认服务地址：默认自动探测局域网 IP（模式①②）；多网卡时可用环境变量手动指定
const SCAN_SERVER_BASE_URL = process.env.SCAN_SERVER_BASE_URL || detectLanBaseUrl()

// 启动日志：提示当前地址与按需启动机制（服务由扫码触发自动拉起，非程序启动默认启动）
{
  const { candidates } = detectLanIpCandidates()
  console.log(`[scan] 扫码服务地址：${SCAN_SERVER_BASE_URL}（局域网/手机热点模式）`)
  if (candidates.length) {
    console.log(`[scan] 本机局域网 IP 候选：${candidates.map((c) => c.name + '=' + c.ip).join('，')}`)
  }
  if (candidates.length > 1) {
    console.log('[scan] 检测到多个网卡（虚拟机/异地组网VPN）：若二维码地址不对，可用环境变量')
    console.log('[scan] SCAN_SERVER_BASE_URL 手动指定局域网 IP，例如 http://192.168.1.100:8787')
  }
  console.log('[scan] scan-server 在进入扫码登录时自动拉起（独立文件，亦可单独部署运行）')
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 5000)
  try {
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    })
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

// 签发二维码：确保服务在线（扫码时自动拉起）后签发，返回 { ticket, qrUrl, baseUrl, candidates }
async function create(options = {}) {
  await scanServerManager.ensureRunning()
  const baseUrl = pickBaseUrl(options && options.baseUrl)
  let res
  try {
    res = await fetchJson(baseUrl + '/api/scan/create', { method: 'POST', timeoutMs: 3000 })
  } catch (e) {
    throw new ApiError(`扫码服务不可用（${e.message}）：请确认网络正常、防火墙已放行 8787，并确保手机与电脑处于同一网络`, 502)
  }
  if (!res || !res.success || !res.data || !res.data.ticket) {
    const reason = (res && res.message) || '确认服务响应异常'
    throw new ApiError(`扫码服务不可用（${reason}）：请确认网络正常、防火墙已放行 8787，并确保手机与电脑处于同一网络`, 502)
  }
  return {
    ticket: res.data.ticket,
    qrUrl: baseUrl + '/scan/' + res.data.ticket,
    baseUrl,
    candidates: listCandidates()
  }
}

// 拉取手机端提交的凭据（一次性）并本地验证，结果回填确认服务（必须使用签发时的 baseUrl）
async function verifyAndApprove(ticket, baseUrl) {
  const credRes = await fetchJson(baseUrl + '/api/scan/credential?ticket=' + encodeURIComponent(ticket))
  if (!credRes || !credRes.success || !credRes.data || !credRes.data.ready) {
    // 凭据尚未就绪（正常不会发生）：返回 submitted 等待下一轮
    return { status: 'submitted' }
  }
  try {
    const session = await authService.loginByCredentials(credRes.data.username, credRes.data.password)
    await fetchJson(baseUrl + '/api/scan/approve', {
      method: 'POST',
      body: { ticket, user: session.user }
    })
    return { status: 'approved', user: session.user }
  } catch (e) {
    const message = (e && e.message) || '验证失败'
    await fetchJson(baseUrl + '/api/scan/approve', {
      method: 'POST',
      body: { ticket, error: message }
    })
    return { status: 'verify-failed', message }
  }
}

// 轮询状态：submitted 时触发本地验证，其余状态透传确认服务结果
async function status(ticket, baseUrl) {
  if (!ticket) return { status: 'expired' }
  await scanServerManager.ensureRunning()
  const url = pickBaseUrl(baseUrl)
  let res
  try {
    res = await fetchJson(url + '/api/scan/status?ticket=' + encodeURIComponent(ticket))
  } catch (e) {
    throw new ApiError('扫码服务不可用，请稍后重试', 502)
  }
  if (!res || !res.success || !res.data) return { status: 'expired' }
  const st = res.data
  if (st.status === 'submitted') {
    return verifyAndApprove(ticket, url)
  }
  return { status: st.status, message: st.message, user: st.user }
}

// 作废二维码（切 Tab / 离开登录页）
async function cancel(ticket, baseUrl) {
  if (!ticket) return true
  await scanServerManager.ensureRunning()
  try {
    await fetchJson(pickBaseUrl(baseUrl) + '/api/scan/deny', { method: 'POST', body: { ticket } })
  } catch (e) {
    // 作废失败不阻断：ticket 本身短 TTL 自动过期
  }
  return true
}

module.exports = { create, status, cancel }
