/**
 * 登录日志清理调度器（Scheduler）—— 每日清理一次过期登录日志
 *
 * 由主进程 setInterval 驱动（复用 15 分钟扫描节奏），但每天只执行一次：
 * 以本地日期做去重（lastPurgeDate），避免重复清理。
 * 启动/停止：应用 ready 且数据库已配置时 start()，应用退出前 stop()。
 */
const { getActiveConfig } = require('../db/connection')
const loginLogService = require('./loginLogService')

const SCAN_INTERVAL_MS = 15 * 60 * 1000 // 15 分钟一轮（用于检测日期变化）

let timer = null
let lastPurgeDate = ''

async function purgeOnce() {
  const today = new Date().toISOString().slice(0, 10)
  if (lastPurgeDate === today) return
  try {
    const removed = await loginLogService.purgeExpired()
    if (removed > 0) console.log(`[loginLogScheduler] 登录日志清理：删除 ${removed} 条过期记录`)
    lastPurgeDate = today
  } catch (e) {
    console.error('[loginLogScheduler] 登录日志清理失败:', e && e.message)
  }
}

function start() {
  stop()
  if (!getActiveConfig()) {
    console.log('[loginLogScheduler] 未配置数据库，登录日志清理未启动')
    return
  }
  purgeOnce()
  timer = setInterval(purgeOnce, SCAN_INTERVAL_MS)
  console.log('[loginLogScheduler] 登录日志清理已启动（每日一次）')
}

function stop() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

module.exports = { start, stop }
