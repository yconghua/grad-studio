/**
 * 学业节点提醒调度器（Scheduler）—— 临近 / 逾期节点扫描
 *
 * 职责（主进程内 setInterval 驱动）：
 *   计划时间 ≤ 今天+7天 且尚未记录（happen_date 为空）的节点 → 通知学生本人与其导师。
 * 去重保证：academic_records.remind_at 字段，每 7 天最多提醒一次（listRemindable 查询条件已含）。
 *
 * 启动/停止：应用 ready 且数据库已配置时 start()，应用退出前 stop()。
 */
const { getActiveConfig } = require('../db/connection')
const academicService = require('./academicService')

const SCAN_INTERVAL_MS = 15 * 60 * 1000 // 15 分钟一轮

let timer = null

async function scan() {
  try {
    const sent = await academicService.remindDueNodes()
    if (sent > 0) console.log(`[academicScheduler] 学业节点提醒：本轮通知 ${sent} 条`)
  } catch (e) {
    console.error('[academicScheduler] 本轮扫描失败:', e && e.message)
  }
}

function start() {
  stop()
  if (!getActiveConfig()) {
    console.log('[academicScheduler] 未配置数据库，学业节点提醒未启动')
    return
  }
  scan()
  timer = setInterval(scan, SCAN_INTERVAL_MS)
  console.log(`[academicScheduler] 学业节点提醒已启动（间隔 ${SCAN_INTERVAL_MS / 60000} 分钟）`)
}

function stop() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

module.exports = { start, stop }
