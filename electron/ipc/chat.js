/**
 * 路由层（IPC Layer）—— 聊天模块路由（chat:* 前缀，与 message:* 完全独立）
 *
 * 只做路由转发与防御性 catch，业务逻辑全部在 chatService。
 * 另启动「实时推送」后台轮询：主进程定时增量查询发给当前登录用户的新消息，
 * 经 webContents.send('chat:push') 推给渲染层，实现对方发送立即弹出；
 * 渲染层侧另有低频轮询兜底。
 */
const { BrowserWindow } = require('electron')
const chatService = require('../services/chatService')
const chatRepository = require('../db/repositories/chatRepository')

function register(ipcMain) {
  // 可聊对象（同组导师/学生）
  ipcMain.handle('chat:list-contacts', async () => {
    try {
      return await chatService.listContacts()
    } catch (err) {
      console.error('[chat:list-contacts] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 我的会话列表
  ipcMain.handle('chat:list-conversations', async () => {
    try {
      return await chatService.listConversations()
    } catch (err) {
      console.error('[chat:list-conversations] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 打开（get-or-create）与某人的会话
  ipcMain.handle('chat:open', async (_evt, payload) => {
    try {
      return await chatService.openConversation(payload)
    } catch (err) {
      console.error('[chat:open] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 分页拉取会话消息
  ipcMain.handle('chat:list-messages', async (_evt, payload) => {
    try {
      return await chatService.listMessages(payload)
    } catch (err) {
      console.error('[chat:list-messages] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 发送消息（文本 / 图片 / 文件）
  ipcMain.handle('chat:send', async (_evt, payload) => {
    try {
      return await chatService.sendMessage(payload)
    } catch (err) {
      console.error('[chat:send] 未预期异常:', err)
      return { success: false, message: '发送失败，请稍后重试' }
    }
  })

  // 撤回消息（仅发送者、2 分钟内）
  ipcMain.handle('chat:recall', async (_evt, payload) => {
    try {
      return await chatService.recallMessage(payload)
    } catch (err) {
      console.error('[chat:recall] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 标记会话已读（联动铃铛）
  ipcMain.handle('chat:mark-read', async (_evt, payload) => {
    try {
      return await chatService.markConversationRead(payload)
    } catch (err) {
      console.error('[chat:mark-read] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 本侧删除会话
  ipcMain.handle('chat:delete-conversation', async (_evt, payload) => {
    try {
      return await chatService.deleteConversation(payload)
    } catch (err) {
      console.error('[chat:delete-conversation] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 搜索聊天记录
  ipcMain.handle('chat:search', async (_evt, payload) => {
    try {
      return await chatService.searchMessages(payload)
    } catch (err) {
      console.error('[chat:search] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 我的聊天未读总数（菜单角标）
  ipcMain.handle('chat:unread-total', async () => {
    try {
      return await chatService.unreadTotal()
    } catch (err) {
      console.error('[chat:unread-total] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 图片消息内嵌预览（附件转 base64）
  ipcMain.handle('chat:attachment-preview', async (_evt, payload) => {
    try {
      return await chatService.attachmentPreview(payload)
    } catch (err) {
      console.error('[chat:attachment-preview] 未预期异常:', err)
      return { success: false, message: '读取附件失败' }
    }
  })

  // 注册完成后启动推送轮询
  startPushLoop()
}

// ===== 实时推送：主进程后台轮询 → chat:push 事件 =====
const PUSH_INTERVAL_MS = 1500
const PUSH_BATCH = 20

let pushTimer = null
let pushRunning = false
// 按用户维护已推送游标：登录用户切换时各自游标独立，不互相干扰
const pushCursors = {}

function startPushLoop() {
  if (pushTimer) return
  pushTimer = setInterval(() => {
    void runPushOnce()
  }, PUSH_INTERVAL_MS)
}

async function runPushOnce() {
  if (pushRunning) return
  pushRunning = true
  try {
    const authService = require('../services/authService')
    const user = authService.getCurrentUser()
    if (!user || !user.id) return
    const me = user.id
    // 该用户首次轮询：游标初始化为当前最大消息 id，只推之后到达的新消息
    if (pushCursors[me] === undefined) {
      pushCursors[me] = await chatRepository.maxMessageId()
      return
    }
    const rows = await chatRepository.listNewMessagesForUser(me, pushCursors[me], PUSH_BATCH)
    if (!rows.length) return
    pushCursors[me] = Math.max(pushCursors[me], ...rows.map((r) => r.id))
    const win = BrowserWindow.getAllWindows()[0]
    if (!win || win.isDestroyed()) return
    // 登录页不推送
    if (win.webContents.getURL().includes('#/login')) return
    win.webContents.send('chat:push', { messages: rows })
  } catch (err) {
    // 轮询失败静默跳过（如未配置数据库连接），不中断后续轮询
  } finally {
    pushRunning = false
  }
}

module.exports = { register }
