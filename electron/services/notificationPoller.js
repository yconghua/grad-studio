/**
 * 通知中心实时推送（NotificationPoller）—— 主进程侧短间隔轮询，共享库有变化即推送
 *
 * 架构背景：与 ChatPoller 同构。业务模块只写库（notificationService.createFor*），
 * 不做推送；本模块登录后每 10 秒轻量查询「当前用户的通知是否有新增 / 未读数是否变化」，
 * 有变化立即 webContents.send('notification:event') 推给渲染层（角标/列表/工作台卡片）。
 * 两个锚点分开追：
 *   - maxId：新通知（新增行，未软删口径）；
 *   - unreadTotal：未读数变化（已读/全部已读/清空已读/删除用户级联等，角标实时归零/变化）。
 * 系统通知最小版：发现新通知且窗口未聚焦、类型支持系统通知时，弹 Electron 原生通知，
 * 点击聚焦窗口并通知渲染层按类型跳转业务路由。
 *
 * 生命周期：由 authService.login / logout 联动 start / stop（登录才有通知、登出即停）。
 */
const { BrowserWindow, Notification } = require('electron')
const notificationRepository = require('../db/repositories/notificationRepository')

// 轮询间隔（毫秒）
const POLL_INTERVAL_MS = 10000

let timer = null
let userId = null
let anchorMaxId = 0
let anchorUnreadTotal = -1

// 初始化锚点：登录后跳过登录前已存在的通知，避免启动即推送历史
async function refreshAnchors() {
  anchorMaxId = await notificationRepository.maxIdOfUser(userId)
  anchorUnreadTotal = await notificationRepository.countUnread(userId)
}

// 推送事件给当前主窗口（单窗口应用，取第一个窗口即可）
function broadcast(payload) {
  const win = BrowserWindow.getAllWindows()[0]
  if (win && !win.isDestroyed()) {
    win.webContents.send('notification:event', payload)
  }
}

// 系统通知最小版：窗口未聚焦 + 类型支持系统通知 → 弹原生通知；
// 点击聚焦窗口并让渲染层按业务类型跳转（路由映射在前端维护）
function maybeSystemNotify(latest) {
  if (!latest) return
  const win = BrowserWindow.getAllWindows()[0]
  if (!win || win.isDestroyed() || win.isFocused()) return
  if (Number(latest.allow_system_notify) !== 1) return

  const notif = new Notification({
    title: latest.title || '新通知',
    body: latest.summary || ''
  })
  notif.on('click', () => {
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
    win.webContents.send('notification:event', {
      type: 'navigate',
      bizType: latest.biz_type,
      bizId: Number(latest.biz_id)
    })
  })
  notif.show()
}

// 单轮检测：对比两个锚点，有变化则更新锚点并推送。
// 事件语义：
//   - new：新通知（渲染层刷新角标，可顺带刷新列表/卡片）
//   - unread-changed：未读数变化但无新通知（已读/清空等，渲染层只刷角标）
async function tick() {
  if (!userId) return
  try {
    const maxId = await notificationRepository.maxIdOfUser(userId)
    const unreadTotal = await notificationRepository.countUnread(userId)
    const unreadChanged = unreadTotal !== anchorUnreadTotal
    anchorUnreadTotal = unreadTotal

    let changed = false
    if (maxId > anchorMaxId) {
      // 先取最新一条（用旧锚点定位），再更新锚点
      const latest = await notificationRepository.latestNewOfUser(userId, anchorMaxId)
      anchorMaxId = maxId
      changed = true
      maybeSystemNotify(latest)
      broadcast({
        type: 'new',
        unreadTotal,
        latest: latest
          ? { bizType: latest.biz_type, bizId: Number(latest.biz_id), typeKey: latest.type_key }
          : null
      })
    }
    // 已读等场景未读数会减少但不产生新通知，单独推送保证角标实时变化
    if (!changed && unreadChanged) {
      broadcast({ type: 'unread-changed', unreadTotal })
    }
  } catch (err) {
    // 轮询异常静默记录，等待下一轮（数据库暂不可用时不影响登录态）
    console.error('[notificationPoller] 轮询异常:', err && err.message)
  }
}

/**
 * 登录后启动轮询
 * @param {number} uid
 */
async function start(uid) {
  stop()
  userId = Number(uid)
  try {
    await refreshAnchors()
  } catch (err) {
    console.error('[notificationPoller] 初始化锚点失败:', err && err.message)
  }
  timer = setInterval(tick, POLL_INTERVAL_MS)
  return true
}

// 登出 / 应用退出时停止轮询并清空状态
function stop() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  userId = null
  anchorMaxId = 0
  anchorUnreadTotal = -1
}

/**
 * 业务写操作（标记已读/全部已读/清空/删除）成功后调用：
 * 立即重算未读数并广播，让角标秒级更新，不等下一轮 10 秒轮询。
 * 未登录（未启动轮询）时为空操作。
 */
async function notifyUnreadChanged() {
  if (!userId) return
  try {
    const unreadTotal = await notificationRepository.countUnread(userId)
    anchorUnreadTotal = unreadTotal
    broadcast({ type: 'unread-changed', unreadTotal })
  } catch (err) {
    console.error('[notificationPoller] 立即广播未读数失败:', err && err.message)
  }
}

module.exports = { start, stop, notifyUnreadChanged }
