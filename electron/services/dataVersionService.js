/**
 * 全局数据版本轮询（DataVersionService）
 *
 * 职责：每 2 秒轻量查询业务表「行数 + change_ts 最大值」指纹，指纹变化即
 * 广播 db:changed，渲染层所有在线页面收到后后台静默重拉，实现
 * "数据库有变动即刷新、前端无感知"（配合写后立即重拉，见 useGlobalRefresh）。
 *
 * 监控范围：页面常驻数据涉及的 15 张业务表；聊天 / 通知已有独立轮询
 * （chatPoller / notificationPoller），不纳入本服务，避免同一数据双路刷新。
 * 指纹时间列统一为各表 change_ts（DEFAULT CURRENT_TIMESTAMP ON UPDATE
 * CURRENT_TIMESTAMP，行被 INSERT/UPDATE 时自动刷新；删除由行数兜底检测）。
 *
 * 生命周期：main.js 窗口创建后 start()，应用退出前 stop()（不依赖登录态）。
 */
const { BrowserWindow } = require('electron')
const { acquireConn } = require('../db/connection')

// 轮询间隔（毫秒）
const POLL_INTERVAL_MS = 2000

// 监控表清单：表名 → 时间列（指纹 = 行数 + 该列最大值，全表统一 change_ts）
const MONITOR_TABLES = [
  ['users', 'change_ts'],
  ['groups', 'change_ts'],
  ['system_configs', 'change_ts'],
  ['task', 'change_ts'],
  ['task_participant', 'change_ts'],
  ['task_dynamic', 'change_ts'],
  ['group_notice', 'change_ts'],
  ['group_notice_read', 'change_ts'],
  ['group_meeting', 'change_ts'],
  ['group_meeting_participant', 'change_ts'],
  ['report', 'change_ts'],
  ['report_attachment', 'change_ts'],
  ['report_template', 'change_ts'],
  ['report_holiday', 'change_ts'],
  ['note', 'change_ts'],
  ['academic_records', 'change_ts'],
  ['academic_stage_templates', 'change_ts'],
  ['achievements', 'change_ts'],
  ['achievement_attachment', 'change_ts'],
  ['achievement_stage_templates', 'change_ts'],
  ['achievement_stage_records', 'change_ts']
]

let timer = null
let lastFingerprint = null

// 一次查询全部表的指纹（单条 UNION ALL，一次往返）
async function readFingerprint() {
  const parts = MONITOR_TABLES.map(
    ([table, timeCol]) =>
      `SELECT '${table}' AS t, COUNT(*) AS c, MAX(\`${timeCol}\`) AS m FROM \`${table}\``
  )
  const sql = parts.join(' UNION ALL ')
  const { conn, release } = await acquireConn()
  try {
    const [rows] = await conn.execute(sql)
    return rows
      .map((r) => `${r.t}:${Number(r.c)}:${r.m || ''}`)
      .sort()
      .join('|')
  } finally {
    release()
  }
}

// 广播给所有打开的窗口（遍历全部窗口，防未来多窗口场景）
function broadcast() {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('db:changed')
  }
}

// 连接就绪/切换后主动广播一次并重建基线：
// 首次成功建基线不广播的规则会让「启动无连接 → 之后才连上」的过程不触发页面刷新，
// 这里由 connectionService 在连接生效点显式调用，通知已挂载页面重拉数据。
function notifyDataChanged() {
  lastFingerprint = null
  broadcast()
}

// 单轮检测：指纹变化则更新基线并广播
async function tick() {
  try {
    const fp = await readFingerprint()
    if (lastFingerprint === null) {
      // 首次仅建基线，不广播（避免启动即触发全页刷新）
      lastFingerprint = fp
      return
    }
    if (fp !== lastFingerprint) {
      lastFingerprint = fp
      console.log('[dataVersion] 业务数据版本变化，广播 db:changed')
      broadcast()
    }
  } catch (err) {
    // 查询失败静默跳过本轮，等待下一轮重试
    console.error('[dataVersion] 指纹查询失败:', err && err.message)
  }
}

// 应用就绪后启动轮询
function start() {
  stop()
  lastFingerprint = null
  timer = setInterval(tick, POLL_INTERVAL_MS)
}

// 应用退出前停止轮询
function stop() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  lastFingerprint = null
}

module.exports = { start, stop, notifyDataChanged }
