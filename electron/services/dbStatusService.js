/**
 * 数据库连接状态服务（DbStatusService）
 *
 * 职责：启动后持续探测当前生效数据库是否真正连通（SELECT 1），维护
 * connected / message 状态；状态变化时广播 db:status-changed，供登录页
 * 在"数据库未连接"时禁用登录表单，连接恢复后原地解锁。
 *
 * 为什么需要独立探测：MySQL 连接池是懒连接，连接池创建成功不代表已连通，
 * 必须真实执行查询才能判断（复用 connectionService.ping 的临时连接探活）。
 *
 * 生命周期：main.js 应用就绪后 start()（先于窗口创建，保证登录页挂载时
 * 已有首轮结果），应用退出前 stop()。
 */
const { BrowserWindow } = require('electron')
const connectionService = require('./connectionService')

// 探测间隔（毫秒）：本地库 SELECT 1 开销可忽略，失败 5s 内感知恢复
const PROBE_INTERVAL_MS = 5000

let timer = null
// 当前状态：connected 是否连通 / message 失败原因（未配置 / 连接错误）
let state = { connected: false, message: '' }

// 广播当前状态给所有打开的窗口
function broadcast() {
  const payload = { connected: state.connected, message: state.message }
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('db:status-changed', payload)
  }
}

// 单轮探测：读取当前生效连接配置并 SELECT 1 探活，状态变化才广播
async function probe() {
  const cfg = connectionService.getActiveConfig()
  const next = !cfg
    ? { connected: false, message: '未配置数据库连接' }
    : await connectionService.ping(cfg).then(
        (r) => (r.ok ? { connected: true, message: '' } : { connected: false, message: r.message || '连接失败' }),
        (e) => ({ connected: false, message: e && e.message ? e.message : '连接失败' })
      )
  const changed = next.connected !== state.connected || next.message !== state.message
  state = next
  if (changed) {
    console.log(`[dbStatus] ${state.connected ? '数据库已连接' : `数据库未连接: ${state.message || ''}`}`)
    broadcast()
  }
}

// 应用就绪后启动：立即探测 + 每 5 秒轮询
function start() {
  stop()
  probe()
  timer = setInterval(probe, PROBE_INTERVAL_MS)
}

// 应用退出前停止轮询
function stop() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

// 当前状态快照（同步返回，供 sys:db-status IPC 读取）
function getStatus() {
  return { connected: state.connected, message: state.message }
}

module.exports = { start, stop, getStatus }
