/**
 * scan-server 独立进程管理器
 *
 * 方案 B：scan-server 是独立文件（可单独拷贝部署/服务器运行），
 * 但新电脑未安装 Node 时，由本程序在扫码登录需要时自动拉起——
 * 借助 Electron 自带的 Node 运行时（ELECTRON_RUN_AS_NODE=1），无需系统安装 Node。
 *
 * 启动时机：按需（扫码登录 create/status/cancel 时 ensureRunning），
 * 不是程序启动时默认启动；应用退出（will-quit）时停止子进程。
 */
const { spawn } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')
const { app } = require('electron')

const PORT = 8787
const HEALTH_URL = `http://127.0.0.1:${PORT}/health`

let child = null
let ready = false
let starting = null

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function resolveServerScript() {
  // 打包后：<安装目录>/resources/scan-server/server.js（见 package.json extraResources）；
  // 开发：项目内 scan-server/server.js
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'scan-server', 'server.js')
  }
  return path.join(__dirname, '..', '..', 'scan-server', 'server.js')
}

function checkHealth(timeoutMs) {
  return new Promise((resolve) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    fetch(HEALTH_URL, { signal: controller.signal })
      .then((res) => resolve(res.ok))
      .catch(() => resolve(false))
      .finally(() => clearTimeout(timer))
  })
}

// 确保确认服务在线：已就绪直接返回；未就绪则用 Electron 自带 Node 运行时拉起独立进程
async function ensureRunning() {
  if (ready) return
  if (await checkHealth(600)) {
    ready = true
    return
  }
  if (starting) return starting
  starting = (async () => {
    const script = resolveServerScript()
    if (!fs.existsSync(script)) {
      throw new Error(`scan-server 脚本缺失：${script}`)
    }
    child = spawn(process.execPath, [script], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    })
    // 子进程输出转发到主进程终端，便于排查（与 [scan] 日志同流）
    child.stdout.on('data', (d) => process.stdout.write(`[scan-server] ${d}`))
    child.stderr.on('data', (d) => process.stderr.write(`[scan-server] ${d}`))
    child.on('exit', (code, signal) => {
      console.log(`[scan-server] 子进程退出 code=${code} signal=${signal}`)
      child = null
      ready = false
    })
    // 等待服务就绪（最多 3 秒）
    for (let i = 0; i < 30; i++) {
      if (await checkHealth(400)) {
        ready = true
        console.log(`[scan-server] 已就绪（端口 ${PORT}）`)
        return
      }
      await sleep(100)
    }
    throw new Error('scan-server 启动超时')
  })()
  try {
    await starting
  } finally {
    starting = null
  }
}

// 停止子进程（应用退出时调用；端口若被手动启动的实例占用则无需处理）
function stop() {
  if (child) {
    try {
      child.kill()
    } catch (e) {
      // 进程已退出则忽略
    }
    child = null
    ready = false
  }
}

module.exports = { ensureRunning, stop }
