/**
 * 待办提醒调度器（Scheduler）—— 到点提醒扫描
 *
 * 职责（主进程内 setInterval 驱动）：
 *   待办设了提醒（1h / 1d）、尚未提醒过、未完成、且提醒时间已到 → 给归属人推一条通知。
 * 去重保证：todos.reminded_at 字段（listRemindable 查询条件已含，提醒后 markReminded）。
 *
 * 启动/停止：应用 ready 且数据库已配置时 start()，应用退出前 stop()。
 */
const { getActiveConfig } = require('../db/connection')
const todoRepository = require('../db/repositories/todoRepository')
const notificationService = require('./notificationService')

const SCAN_INTERVAL_MS = 15 * 60 * 1000 // 15 分钟一轮

let timer = null

async function scan() {
  try {
    const now = new Date()
    const rows = await todoRepository.listRemindable(now)
    let sent = 0
    for (const t of rows) {
      try {
        await notificationService.createForUsers({
          recipients: [Number(t.owner_id)],
          typeKey: 'todo_remind',
          title: `待办提醒：${t.title || '未命名待办'}`,
          summary: t.due_time ? `截止时间：${t.due_time}` : '',
          bizType: 'todo',
          bizId: Number(t.id),
          groupId: t.group_id == null ? null : Number(t.group_id)
        })
        await todoRepository.markReminded(Number(t.id))
        sent += 1
      } catch (e) {
        console.error('[todoScheduler] 单条提醒失败:', e && e.message)
      }
    }
    if (sent > 0) console.log(`[todoScheduler] 待办提醒：本轮通知 ${sent} 条`)
  } catch (e) {
    console.error('[todoScheduler] 本轮扫描失败:', e && e.message)
  }
}

function start() {
  stop()
  if (!getActiveConfig()) {
    console.log('[todoScheduler] 未配置数据库，待办提醒未启动')
    return
  }
  scan()
  timer = setInterval(scan, SCAN_INTERVAL_MS)
  console.log(`[todoScheduler] 待办提醒已启动（间隔 ${SCAN_INTERVAL_MS / 60000} 分钟）`)
}

function stop() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

module.exports = { start, stop }
