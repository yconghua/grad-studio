/**
 * 日志服务（主进程文件日志）
 *
 * 启动时 hook 全局 console.log / info / warn / error / debug：
 * 所有模块既有 console 输出（SQL、IPC、renderer 转发、异常等）在保留终端
 * 输出的同时追加写入 userData/logs/main.log，打包安装版也可离线排查问题。
 * 单文件超 5MB 轮转（main.log.1 / main.log.2，旧文件递增覆盖），磁盘占用可控。
 * 文件写入用同步追加（appendFileSync）：避免流式异步与轮转重命名之间的竞态，
 * 本地桌面日志量级下开销可忽略。
 */
const fs = require('node:fs')
const path = require('node:path')
const util = require('node:util')
const { app } = require('electron')

const MAX_BYTES = 5 * 1024 * 1024
const KEEP_FILES = 2 // 保留 main.log + main.log.1 + main.log.2

let logDir = ''
let logPath = ''
let hooked = false

// 行内级别提取：日志查看按级别筛选用（ERROR 含 IPC✗ / SQL✗ 等失败标记）
function parseLevel(line) {
  if (/\[ERROR\]|\[IPC✗\]|\[SQL✗\]|\[renderer-gone\]|\[renderer\] 页面无响应/.test(line)) return 'ERROR'
  if (/\[WARN\]|\[warning\]/.test(line)) return 'WARN'
  return 'INFO'
}

function ensureLogDir() {
  logDir = path.join(app.getPath('userData'), 'logs')
  fs.mkdirSync(logDir, { recursive: true })
  logPath = path.join(logDir, 'main.log')
}

// 大小超限轮转：main.log → main.log.1 → main.log.2 → 删除最旧
function rotateIfNeeded() {
  try {
    const st = fs.statSync(logPath)
    if (st.size < MAX_BYTES) return
    for (let i = KEEP_FILES; i >= 1; i -= 1) {
      const from = i === 1 ? logPath : `${logPath}.${i - 1}`
      const to = `${logPath}.${i}`
      if (fs.existsSync(to)) fs.unlinkSync(to)
      if (fs.existsSync(from)) fs.renameSync(from, to)
    }
  } catch (e) {
    // 轮转失败不阻断写入（可能被占用），下次写入再试
  }
}

function writeLine(level, args) {
  if (!logPath) return
  const ts = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const stamp = `${pad(ts.getHours())}:${pad(ts.getMinutes())}:${pad(ts.getSeconds())}.${String(ts.getMilliseconds()).padStart(3, '0')}`
  const line = `[${stamp}] [${level}] ${util.format(...args)}\n`
  rotateIfNeeded()
  try {
    fs.appendFileSync(logPath, line, 'utf8')
  } catch (e) {
    // 写日志失败静默（避免日志自身抛错影响业务）
  }
}

// hook 全局 console：先落盘再原样走原 console（终端行为不变）
function init() {
  if (hooked) return
  try {
    ensureLogDir()
  } catch (e) {
    return
  }
  // 启动边界分隔行：一眼定位每次启动的起点（写文件不经过 console hook）
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  writeLine('START', [`${app.getName()} v${app.getVersion()} 启动 ${dateStr} ${'-'.repeat(24)}`])
  const original = { ...console }
  const levels = [
    ['log', 'INFO'],
    ['info', 'INFO'],
    ['warn', 'WARN'],
    ['error', 'ERROR'],
    ['debug', 'DEBUG']
  ]
  for (const [name, level] of levels) {
    const orig = original[name]
    console[name] = (...args) => {
      writeLine(level, args)
      if (orig) orig.apply(console, args)
    }
  }
  hooked = true
}

// 诊断信息：日志文件大小与总行数
function getInfo() {
  let fileSize = 0
  let lineCount = 0
  if (logPath && fs.existsSync(logPath)) {
    try {
      const st = fs.statSync(logPath)
      fileSize = st.size
      const content = fs.readFileSync(logPath, 'utf8')
      lineCount = content.split('\n').filter(Boolean).length
    } catch (e) {
      // 读取失败按 0 处理
    }
  }
  return { fileSize, lineCount, logDir }
}

// 读取日志：level = all / error / warn；返回按行号倒序的最新 limit 行
function readLogs(level, limit) {
  const want = Math.min(Math.max(Number(limit) || 0, 1), 1000)
  if (!logPath || !fs.existsSync(logPath)) {
    return { lines: [], total: 0 }
  }
  let arr = []
  try {
    const content = fs.readFileSync(logPath, 'utf8')
    arr = content.split('\n')
    if (arr.length && arr[arr.length - 1] === '') arr.pop()
  } catch (e) {
    return { lines: [], total: 0 }
  }
  let rows = arr.map((text, i) => ({ idx: i + 1, text, level: parseLevel(text) }))
  if (level === 'error') rows = rows.filter((r) => r.level === 'ERROR')
  else if (level === 'warn') rows = rows.filter((r) => r.level === 'WARN' || r.level === 'ERROR')
  return { lines: rows.slice(-want).reverse(), total: rows.length }
}

module.exports = { init, getInfo, readLogs, getLogDir: () => logDir }
