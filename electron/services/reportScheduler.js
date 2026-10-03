/**
 * 周报定时调度器（Scheduler）—— 未交提醒 / 批阅超时提醒 / 打回未改提醒
 *
 * 与 taskScheduler 并行运行（main.js 在窗口创建后同时启动），每 15 分钟一轮：
 *   1. 未交提醒：仅每周四、周日各一次，扫描当周未提交学生，站内通知（去重）；
 *   2. 批阅超时：submitted 超过 48h 未批 → 提醒导师；超过 72h → 提醒组管；
 *   3. 打回未改：returned 超过 7 天未重交 → 每周（按周一起点）催学生一次。
 *
 * 幂等保证：report_remind_log 表 (week_key, user_id, remind_type, remind_date) 唯一，
 * 每轮 INSERT IGNORE 占位，冲突（当日/当周已提醒）则跳过。
 */
const reportRepository = require('../db/repositories/reportRepository')
const reportConfigRepository = require('../db/repositories/reportConfigRepository')
const notificationService = require('./notificationService')
const reportWeek = require('./reportWeek')

const SCAN_INTERVAL_MS = 15 * 60 * 1000 // 15 分钟一轮
const FIRST_SCAN_DELAY_MS = 30 * 1000 // 首轮扫描延迟：等待升级迁移（schemas 建表）完成
const REVIEW_TIMEOUT_HOURS = 48 // 导师批阅超时阈值
const GROUP_INTERVENE_HOURS = 72 // 组管介入阈值
const RETURNED_REMIND_DAYS = 7 // 打回后未重交提醒阈值

let timer = null
let firstTimer = null
let tableMissingWarned = false

function todayStr() {
  const d = new Date()
  const pad2 = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

// 当前周周一的日期字符串（returned 周催按周去重）
function weekMondayDateStr() {
  const monday = reportWeek.mondayOf(reportWeek.currentWeekKey())
  const pad2 = (n) => String(n).padStart(2, '0')
  return `${monday.getFullYear()}-${pad2(monday.getMonth() + 1)}-${pad2(monday.getDate())}`
}

/**
 * 未交提醒：仅周四 / 周日执行，向当周未提交学生发 report_remind
 */
async function scanMissed() {
  const day = new Date().getDay() // 0=周日 4=周四
  if (day !== 4 && day !== 0) return
  const weekKey = reportWeek.currentWeekKey()
  const date = todayStr()
  const missing = await reportRepository.listStudentsMissing(weekKey)
  if (missing.length === 0) return
  const recipients = []
  for (const stu of missing) {
    if (await reportConfigRepository.insertRemindLog({ weekKey, userId: stu.id, type: 'missed', date })) {
      recipients.push(stu.id)
    }
  }
  if (recipients.length === 0) return
  const count = await notificationService.createForUsers({
    recipients,
    typeKey: 'report_remind',
    title: `请及时提交周报：${reportWeek.weekLabelOf(weekKey)}`,
    summary: `本周周报尚未提交（${day === 4 ? '周四提醒' : '周日前最后提醒'}），请尽快填写提交`,
    bizType: 'report',
    bizId: 0
  })
  console.log(`[reportScheduler] 未交提醒：${weekKey} 通知 ${count} 人`)
}

/**
 * 批阅超时：48h 提醒导师；72h 提醒组管（各去重一次）
 */
async function scanReviewTimeout() {
  const date = todayStr()
  // 48h：逐条提醒导师
  const late48 = await reportRepository.listReviewTimeout(REVIEW_TIMEOUT_HOURS)
  for (const r of late48) {
    if (!r.mentor_id) continue
    if (!(await reportConfigRepository.insertRemindLog({ weekKey: r.week_key, userId: Number(r.mentor_id), type: 'review_48h', date }))) {
      continue
    }
    const count = await notificationService.createForUsers({
      recipients: [Number(r.mentor_id)],
      typeKey: 'report_remind',
      title: `周报待批阅超时：${reportWeek.weekLabelOf(r.week_key)}`,
      summary: `${r.student_name || '学生'} 的周报已提交超过 ${REVIEW_TIMEOUT_HOURS} 小时未批阅`,
      bizType: 'report',
      bizId: Number(r.id),
      groupId: Number(r.group_id)
    })
    if (count > 0) console.log(`[reportScheduler] 批阅超时提醒导师：report#${r.id}`)
  }
  // 72h：按组聚合提醒组管（当天每组合计一条）
  const late72 = await reportRepository.listReviewTimeout(GROUP_INTERVENE_HOURS)
  const byGroup = {}
  for (const r of late72) {
    if (!r.admin_user_id) continue
    const key = Number(r.group_id)
    if (!byGroup[key]) byGroup[key] = { adminId: Number(r.admin_user_id), count: 0, weekKey: r.week_key }
    byGroup[key].count++
  }
  for (const gid of Object.keys(byGroup)) {
    const g = byGroup[gid]
    if (!(await reportConfigRepository.insertRemindLog({ weekKey: g.weekKey, userId: g.adminId, type: 'review_72h', date }))) {
      continue
    }
    const count = await notificationService.createForUsers({
      recipients: [g.adminId],
      typeKey: 'report_remind',
      title: '组内周报批阅积压提醒',
      summary: `本组有 ${g.count} 条周报已超过 ${GROUP_INTERVENE_HOURS} 小时未批阅，请提醒导师处理`,
      bizType: 'report',
      bizId: 0,
      groupId: Number(gid)
    })
    if (count > 0) console.log(`[reportScheduler] 批阅积压提醒组管：group#${gid} 共 ${g.count} 条`)
  }
}

/**
 * 打回未改提醒：returned 超过 7 天未重交 → 每周（按周一起点）催学生一次
 */
async function scanReturned() {
  const weekKey = reportWeek.currentWeekKey()
  const remindDate = weekMondayDateStr()
  const rows = await reportRepository.listReturnedStale(RETURNED_REMIND_DAYS)
  for (const r of rows) {
    if (!(await reportConfigRepository.insertRemindLog({ weekKey: r.week_key, userId: Number(r.student_id), type: 'returned', date: remindDate }))) {
      continue
    }
    const count = await notificationService.createForUsers({
      recipients: [Number(r.student_id)],
      typeKey: 'report_remind',
      title: `周报被打回待修改：${reportWeek.weekLabelOf(r.week_key)}`,
      summary: '请查看打回理由并尽快修改后重新提交',
      bizType: 'report',
      bizId: Number(r.id),
      groupId: Number(r.group_id)
    })
    if (count > 0) console.log(`[reportScheduler] 打回未改提醒学生：report#${r.id}`)
  }
}

// 单轮扫描：三个子扫描互相隔离，单个失败不影响其他
async function scan() {
  try {
    await Promise.all([scanMissed(), scanReviewTimeout(), scanReturned()])
  } catch (e) {
    // 升级迁移尚未建表（首轮启动竞态）时静默降级一次，等下一轮；其余错误照常输出
    if (e && (e.code === 'ER_NO_SUCH_TABLE' || /doesn't exist/i.test(String(e.message || '')))) {
      if (!tableMissingWarned) {
        tableMissingWarned = true
        console.warn('[reportScheduler] 周报表尚未就绪（升级迁移进行中），本轮跳过，下轮自动重试')
      }
      return
    }
    console.error('[reportScheduler] 本轮扫描失败:', e && e.message)
  }
}

function start() {
  stop()
  tableMissingWarned = false
  // 首轮扫描延迟执行：connectionService 的升级迁移（schemas 建表）在后台异步进行，
  // 立即扫描会命中「表不存在」竞态；延迟一个窗口后再启动定时循环。
  firstTimer = setTimeout(() => {
    scan()
    timer = setInterval(scan, SCAN_INTERVAL_MS)
  }, FIRST_SCAN_DELAY_MS)
  console.log(`[reportScheduler] 周报定时提醒已启动（${FIRST_SCAN_DELAY_MS / 1000}s 后首扫，间隔 ${SCAN_INTERVAL_MS / 60000} 分钟）`)
}

function stop() {
  if (firstTimer) {
    clearTimeout(firstTimer)
    firstTimer = null
  }
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

module.exports = { start, stop }
