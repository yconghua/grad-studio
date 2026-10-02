/**
 * 聊天实时推送（ChatPoller）—— 主进程侧短间隔轮询，MySQL 有变化即推送
 *
 * 架构背景：无独立服务端，消息写入共享 MySQL 后，对方客户端无法被主动通知。
 * 本模块作为「事件驱动」的载体：登录后每 2 秒轻量查询「我参与的会话是否有新消息
 * 或撤回」，有变化立即 webContents.send('chat:event') 推给渲染层。
 * 两个锚点分开追：
 *   - maxId：新消息（新增行）；
 *   - 最近撤回 (recalled_at, id)：撤回不改消息 id，增量拉取拿不到已拉区间的撤回，
 *     必须单独检测，否则对方看不到「消息已撤回」。
 *
 * 生命周期：由 authService.login / logout 联动 start / stop（登录才有会话、登出即停）；
 * 数据库连接切换只在未登录状态发生（sys:switch-db 强制），无需处理。
 */
const { BrowserWindow } = require('electron')
const chatSessionMemberRepository = require('../db/repositories/chatSessionMemberRepository')
const chatMessageRepository = require('../db/repositories/chatMessageRepository')

// 轮询间隔（毫秒）
const POLL_INTERVAL_MS = 2000

let timer = null
let userId = null
let anchorMaxId = 0
// 最近撤回锚点：recalled_at#id（同秒多条撤回也能区分）
let anchorRecalledKey = ''
// 未读总数锚点：已读/撤回/对方删除等一切导致未读数变化的场景都要实时反映到角标
let anchorUnreadTotal = -1

// 初始化锚点：登录后跳过登录前已存在的消息，避免启动即推送历史
async function refreshAnchors() {
  const sessions = await chatSessionMemberRepository.listSessionsOfUser(userId)
  const sessionIds = (sessions || []).map((r) => r.session_id)
  anchorMaxId = sessionIds.length ? await chatMessageRepository.maxIdOfSessions(sessionIds) : 0
  anchorRecalledKey = await recalledKeyOf(sessionIds)
  anchorUnreadTotal = await chatMessageRepository.countUnreadForUser(userId)
}

async function recalledKeyOf(sessionIds) {
  if (!sessionIds.length) return ''
  const last = await chatMessageRepository.lastRecalledOfSessions(sessionIds)
  return last ? `${last.recalled_at}#${last.id}` : ''
}

// 推送事件给当前主窗口（单窗口应用，BroadcastWindow 即可）
function broadcast(payload) {
  const win = BrowserWindow.getAllWindows()[0]
  if (win && !win.isDestroyed()) {
    win.webContents.send('chat:event', payload)
  }
}

// 单轮检测：对比三个锚点，有变化则更新锚点并推送。
// 事件语义：
//   - new-message：新消息（渲染层据此拉增量）
//   - recalled：撤回（渲染层据此把已拉区间的消息替换为占位）
//   - unread-changed：未读数变化但无新消息/撤回（已读清零、撤回重算等，渲染层刷新角标）
// 未读数（unreadTotal）随每次事件附带，渲染层角标收到即更新。
async function tick() {
  if (!userId) return
  try {
    const sessions = await chatSessionMemberRepository.listSessionsOfUser(userId)
    const sessionIds = (sessions || []).map((r) => r.session_id)

    const maxId = sessionIds.length ? await chatMessageRepository.maxIdOfSessions(sessionIds) : 0
    const recalledKey = await recalledKeyOf(sessionIds)

    const unreadTotal = await chatMessageRepository.countUnreadForUser(userId)
    const unreadChanged = unreadTotal !== anchorUnreadTotal
    anchorUnreadTotal = unreadTotal

    let changed = false
    if (maxId > anchorMaxId) {
      anchorMaxId = maxId
      changed = true
      broadcast({ type: 'new-message', unreadTotal })
    }
    if (recalledKey && recalledKey !== anchorRecalledKey) {
      anchorRecalledKey = recalledKey
      changed = true
      const last = await chatMessageRepository.lastRecalledOfSessions(sessionIds)
      if (last) broadcast({ type: 'recalled', sessionId: last.session_id, messageId: last.id, unreadTotal })
    }
    // 已读等场景未读数会减少但不产生新消息/撤回，单独推送保证角标实时归零/变化
    if (!changed && unreadChanged) {
      broadcast({ type: 'unread-changed', unreadTotal })
    }
  } catch (err) {
    // 轮询异常静默记录，等待下一轮（数据库暂不可用时不影响登录态）
    console.error('[chatPoller] 轮询异常:', err && err.message)
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
    console.error('[chatPoller] 初始化锚点失败:', err && err.message)
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
  anchorRecalledKey = ''
  anchorUnreadTotal = -1
}

module.exports = { start, stop }
