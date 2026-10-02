/**
 * 任务定时调度器（Scheduler）—— 到期 / 逾期 / 待验收超时扫描
 *
 * 职责（主进程内 setInterval 驱动）：
 *   1. 即将到期：截止时间落在 [now, now + dueSoonHours] 且仍待办/进行中 → 通知全部参与人；
 *   2. 已逾期：截止时间已过且仍待办/进行中 → 通知全部参与人；
 *   3. 待验收超时：进入待验收超过 pendingReviewHours → 通知创建者（负责人）及时验收。
 *
 * 幂等保证：task_reminder 表 (task_id, user_id, remind_type, remind_date) 唯一，
 * 每轮扫描用 INSERT IGNORE 占位，冲突（当日已提醒）则跳过；通知成功写入后回填 sent_at。
 * 无通知偏好/免打扰功能（用户已确认不实现）。
 *
 * 启动/停止：应用 ready 且数据库已配置时 start()，应用退出前 stop()。
 */
const { getActiveConfig } = require('../db/connection')
const taskRepository = require('../db/repositories/taskRepository')
const taskParticipantRepository = require('../db/repositories/taskParticipantRepository')
const taskReminderRepository = require('../db/repositories/taskReminderRepository')
const groupRepository = require('../db/repositories/groupRepository')
const notificationService = require('./notificationService')

const SCAN_INTERVAL_MS = 15 * 60 * 1000 // 15 分钟一轮

let timer = null

// 读取系统配置键（不存在时回退默认值）
async function configNumber(key, fallback) {
  try {
    const systemConfigRepository = require('../db/repositories/systemConfigRepository')
    const row = await systemConfigRepository.findByKey(key)
    const n = Number(row && row.param_value)
    return n > 0 ? n : fallback
  } catch (e) {
    return fallback
  }
}

// 仅对启用状态的课题组发提醒（组停用后不打扰）
async function groupEnabled(task) {
  try {
    const group = await groupRepository.findById(task.group_id)
    return !!(group && Number(group.status) === 1)
  } catch (e) {
    return false
  }
}

// 参与人 id 列表（任务不存在/无参与人返回空数组）
async function participantsOf(taskId) {
  try {
    return await taskParticipantRepository.listUserIdsByTask(taskId)
  } catch (e) {
    return []
  }
}

/**
 * 扫描即将到期：向参与人发 task_due_soon
 */
async function scanDueSoon() {
  const hours = await configNumber('task.due_soon_hours', 24)
  const tasks = await taskRepository.dueSoonTasks(hours)
  for (const task of tasks) {
    try {
      if (!(await groupEnabled(task))) continue
      const recipients = await participantsOf(task.id)
      if (recipients.length === 0) continue
      const today = new Date().toISOString().slice(0, 10)
      let sent = 0
      for (const uid of recipients) {
        if (await taskReminderRepository.insertIgnore(task.id, uid, 'due_soon', today)) sent++
      }
      if (sent === 0) continue
      const count = await notificationService.createForUsers({
        recipients,
        typeKey: 'task_due_soon',
        title: task.title,
        summary: `任务即将到期（截止 ${task.due_time}）`,
        bizType: 'task',
        bizId: task.id,
        groupId: task.group_id
      })
      if (count > 0) {
        for (const uid of recipients) {
          await taskReminderRepository.markSent(task.id, uid, 'due_soon', today)
        }
      }
      console.log(`[taskScheduler] 即将到期提醒：task#${task.id} 通知 ${count} 人`)
    } catch (e) {
      console.warn('[taskScheduler] scanDueSoon 单任务失败:', e && e.message)
    }
  }
}

/**
 * 扫描已逾期：向参与人发 task_overdue
 */
async function scanOverdue() {
  const tasks = await taskRepository.overdueTasks()
  for (const task of tasks) {
    try {
      if (!(await groupEnabled(task))) continue
      const recipients = await participantsOf(task.id)
      if (recipients.length === 0) continue
      const today = new Date().toISOString().slice(0, 10)
      let sent = 0
      for (const uid of recipients) {
        if (await taskReminderRepository.insertIgnore(task.id, uid, 'overdue', today)) sent++
      }
      if (sent === 0) continue
      const count = await notificationService.createForUsers({
        recipients,
        typeKey: 'task_overdue',
        title: task.title,
        summary: `任务已逾期（截止 ${task.due_time}）`,
        bizType: 'task',
        bizId: task.id,
        groupId: task.group_id
      })
      if (count > 0) {
        for (const uid of recipients) {
          await taskReminderRepository.markSent(task.id, uid, 'overdue', today)
        }
      }
      console.log(`[taskScheduler] 逾期提醒：task#${task.id} 通知 ${count} 人`)
    } catch (e) {
      console.warn('[taskScheduler] scanOverdue 单任务失败:', e && e.message)
    }
  }
}

/**
 * 扫描待验收超时：向创建者发 task_pending_review
 */
async function scanPendingReview() {
  const hours = await configNumber('task.pending_review_hours', 24)
  const tasks = await taskRepository.pendingReviewTasks(hours)
  for (const task of tasks) {
    try {
      if (!(await groupEnabled(task))) continue
      const today = new Date().toISOString().slice(0, 10)
      if (!(await taskReminderRepository.insertIgnore(task.id, task.creator_id, 'pending_review', today))) {
        continue
      }
      const count = await notificationService.createForUsers({
        recipients: [task.creator_id],
        typeKey: 'task_pending_review',
        title: task.title,
        summary: '任务待验收已超时，请及时验收',
        bizType: 'task',
        bizId: task.id,
        groupId: task.group_id
      })
      if (count > 0) {
        await taskReminderRepository.markSent(task.id, task.creator_id, 'pending_review', today)
      }
      console.log(`[taskScheduler] 待验收超时提醒：task#${task.id}`)
    } catch (e) {
      console.warn('[taskScheduler] scanPendingReview 单任务失败:', e && e.message)
    }
  }
}

// 单轮扫描：三个子扫描互相隔离，单个失败不影响其他
async function scan() {
  try {
    await Promise.all([scanDueSoon(), scanOverdue(), scanPendingReview()])
  } catch (e) {
    console.error('[taskScheduler] 本轮扫描失败:', e && e.message)
  }
}

/**
 * 启动定时扫描（应用 ready 后调用；未配置数据库时跳过）
 */
function start() {
  stop()
  if (!getActiveConfig()) {
    console.log('[taskScheduler] 未配置数据库，定时扫描未启动')
    return
  }
  // 启动即跑一轮，随后按间隔轮询
  scan()
  timer = setInterval(scan, SCAN_INTERVAL_MS)
  console.log(`[taskScheduler] 任务定时扫描已启动（间隔 ${SCAN_INTERVAL_MS / 60000} 分钟）`)
}

/**
 * 停止定时扫描（应用退出前调用）
 */
function stop() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

module.exports = { start, stop }
