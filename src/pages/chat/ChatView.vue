<template>
  <div class="chat-view">
    <!-- 左侧：会话列表 -->
    <aside class="chat-side">
      <div class="side-head">
        <span class="side-title">会话</span>
        <button type="button" class="btn btn-primary btn-sm" @click="showStart = true">发起聊天</button>
      </div>
      <div v-if="loadingSessions" class="empty">加载中…</div>
      <div v-else-if="!sessions.length" class="empty">还没有会话，发起一个吧</div>
      <ChatSessionList :sessions="sessions" :active-id="activeSessionId" @select="openSession" />
    </aside>

    <!-- 右侧：消息区 -->
    <section class="chat-panel">
      <template v-if="activeSession">
        <div class="chat-head">
          <span class="peer-name">{{ peerName }}</span>
          <span v-if="activeSession.peerDeleted" class="peer-deleted-tip">对方已删除，无法继续聊天</span>
        </div>
        <ChatMessageList
          ref="msgListRef"
          :messages="messages"
          :my-user-id="myUserId"
          :has-more="hasMore"
          :loading-more="loadingMore"
          @load-more="loadMore"
          @recall="recall"
        />
        <ChatInputBox :disabled="activeSession.peerDeleted" @send="send" />
      </template>
      <div v-else class="chat-empty">
        <p class="chat-empty-text">选择左侧会话开始聊天，或发起新会话</p>
        <button type="button" class="btn btn-primary" @click="showStart = true">发起聊天</button>
      </div>
    </section>

    <ChatStartDialog :visible="showStart" @close="showStart = false" @select="onSessionCreated" />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import ChatSessionList from '../../components/chat/ChatSessionList.vue'
import ChatMessageList from '../../components/chat/ChatMessageList.vue'
import ChatInputBox from '../../components/chat/ChatInputBox.vue'
import ChatStartDialog from '../../components/chat/ChatStartDialog.vue'
import {
  listChatSessions,
  getChatHistory,
  getChatIncrement,
  sendChatMessage,
  markChatRead,
  recallChatMessage,
  onChatEvent
} from '../../api/chat'
import { useSession } from '../../composables/useSession'
import { dialogAlert } from '../../composables/useDialog'

// 聊天主页面：会话列表 + 消息区 + 发起会话弹窗
// 实时性：主进程 ChatPoller 每 2 秒检测共享库变化并推送 chat:event（事件驱动），
// 本页收到后增量拉取；另以 30 秒轮询 + 窗口聚焦补拉兜底（推送失败不丢消息）。
const HISTORY_LIMIT = 50

const { getSessionUser } = useSession()
const myUserId = Number((getSessionUser() || {}).id)

// ===== 会话列表 =====
const sessions = ref([])
const loadingSessions = ref(false)
const activeSessionId = ref(null)
const showStart = ref(false)

// ===== 当前会话消息 =====
const messages = ref([])
const hasMore = ref(false)
const loadingMore = ref(false)
const msgListRef = ref(null)

const activeSession = computed(() => sessions.value.find((s) => s.id === activeSessionId.value) || null)
const peerName = computed(() => {
  if (!activeSession.value) return ''
  if (activeSession.value.peerDeleted) return '已删除用户'
  return activeSession.value.peerRealName || activeSession.value.peerUsername || '用户 #' + activeSession.value.peerId
})

// ===== 会话列表 =====
async function loadSessions() {
  loadingSessions.value = true
  try {
    const res = await listChatSessions()
    if (res && res.success) {
      sessions.value = res.data || []
    }
  } catch (e) {
    // 拉取失败静默，等待下一轮
  } finally {
    loadingSessions.value = false
  }
}

// 当前会话已拉到的最晚服务端消息 id（增量锚点）
function lastServerId() {
  let max = 0
  for (const m of messages.value) {
    if (m.id && Number(m.id) > max) max = Number(m.id)
  }
  return max
}

// 打开会话：拉最近 50 条历史，滚动到底并上报已读
async function openSession(s) {
  activeSessionId.value = s.id
  messages.value = []
  hasMore.value = false
  const res = await getChatHistory(s.id, 0, HISTORY_LIMIT)
  if (res && res.success) {
    const list = res.data || []
    messages.value = list
    hasMore.value = list.length >= HISTORY_LIMIT
  }
  await markReadUpTo(s.id, lastServerId())
  // 本地立即清零当前会话未读（服务端 markRead 已生效，列表下次拉取同步）
  if (activeSession.value) activeSession.value.unreadCount = 0
  setTimeout(() => msgListRef.value && msgListRef.value.scrollToBottom(true), 0)
}

// 上拉加载更早：以当前最早一条服务端消息为锚点
async function loadMore() {
  const sessionId = activeSessionId.value
  if (!sessionId || loadingMore.value || !hasMore.value) return
  loadingMore.value = true
  try {
    const first = messages.value.find((m) => m.id)
    const beforeId = first ? Number(first.id) : Number.MAX_SAFE_INTEGER
    const res = await getChatHistory(sessionId, beforeId, HISTORY_LIMIT)
    if (res && res.success) {
      const list = res.data || []
      messages.value = [...list, ...messages.value]
      hasMore.value = list.length >= HISTORY_LIMIT
    }
  } finally {
    loadingMore.value = false
  }
}

// 已读上报：只上报最大服务端 id，主进程忽略回退
async function markReadUpTo(sessionId, lastId) {
  if (!sessionId || !lastId) return
  await markChatRead(sessionId, lastId)
}

// ===== 发送 / 重试 / 撤回 =====
function uuid() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID()
  return `m${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function nowText() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  )
}

// 发送：乐观插入「发送中」，成功后替换为服务端消息；失败标红可重试（重试复用客户端消息 ID）
async function send(text) {
  const sessionId = activeSessionId.value
  if (!sessionId) return
  const clientMessageId = uuid()
  messages.value.push({
    localKey: clientMessageId,
    sessionId,
    senderId: myUserId,
    content: text,
    status: 0,
    createdAt: nowText()
  })
  msgListRef.value && msgListRef.value.scrollToBottom(true)
  await doSend(sessionId, clientMessageId, text)
}

async function doSend(sessionId, clientMessageId, text) {
  const res = await sendChatMessage(sessionId, clientMessageId, text)
  const idx = messages.value.findIndex((m) => m.localKey === clientMessageId)
  if (idx < 0) return
  if (res && res.success) {
    const serverMsg = res.data
    messages.value.splice(idx, 1, { ...serverMsg, localKey: clientMessageId })
    await markReadUpTo(sessionId, lastServerId())
    loadSessions()
  } else {
    messages.value[idx].status = -1
    dialogAlert((res && res.message) || '发送失败，请重试')
  }
}

// 失败重试：复用同一个客户端消息 ID（服务端幂等，不会重复入库）
async function retry(m) {
  const idx = messages.value.findIndex((x) => x.localKey === m.localKey)
  if (idx >= 0) messages.value[idx].status = 0
  await doSend(m.sessionId || activeSessionId.value, m.localKey, m.content)
}

async function recall(m) {
  const sessionId = activeSessionId.value
  if (!sessionId || !m.id) return
  const res = await recallChatMessage(sessionId, m.id)
  if (res && res.success) {
    const idx = messages.value.findIndex((x) => x.id === m.id)
    if (idx >= 0) messages.value.splice(idx, 1, { ...res.data, localKey: messages.value[idx].localKey })
    loadSessions()
  } else {
    dialogAlert((res && res.message) || '撤回失败')
  }
}

// ===== 实时事件 + 兜底 =====
let unsubChatEvent = null
let fallbackTimer = null

// 事件驱动：ChatPoller 发现共享库变化即推送；
// 撤回事件对当前会话直接替换占位（撤回不改消息 id，增量拉取拿不到已拉区间的撤回）；
// 纯未读变化（已读清零等）只需刷新会话列表红点
function onChatPush(data) {
  if (!data) return
  if (data.type === 'recalled' && data.sessionId === activeSessionId.value) {
    const idx = messages.value.findIndex((m) => m.id === data.messageId)
    if (idx >= 0) {
      messages.value[idx] = { ...messages.value[idx], status: 2, content: '' }
    }
  }
  if (data.type === 'new-message' || data.type === 'recalled') {
    refreshAfterPush()
  } else if (data.type === 'unread-changed') {
    loadSessions()
  }
}

// 推送后刷新：重拉会话列表（未读/排序）+ 当前会话增量补拉 + 贴底自动已读
async function refreshAfterPush() {
  loadSessions()
  const sessionId = activeSessionId.value
  if (!sessionId) return
  const afterId = lastServerId()
  if (!afterId) return
  const res = await getChatIncrement(sessionId, afterId, 200)
  if (res && res.success) {
    const list = res.data || []
    if (list.length) {
      messages.value = [...messages.value, ...list]
      const atBottom = msgListRef.value ? msgListRef.value.isAtBottom() : true
      if (atBottom) {
        await markReadUpTo(sessionId, lastServerId())
        if (activeSession.value) activeSession.value.unreadCount = 0
      }
    }
  }
}

// 窗口聚焦立即补拉一次（离线恢复 / 应用恢复）
function onFocus() {
  refreshAfterPush()
}

// 新会话创建完成：加入列表并打开
async function onSessionCreated(session) {
  showStart.value = false
  await loadSessions()
  activeSessionId.value = Number(session.id)
  await openSession(session)
}

onMounted(() => {
  loadSessions()
  unsubChatEvent = onChatEvent(onChatPush)
  fallbackTimer = setInterval(refreshAfterPush, 30000)
  window.addEventListener('focus', onFocus)
})

onUnmounted(() => {
  if (unsubChatEvent) unsubChatEvent()
  if (fallbackTimer) clearInterval(fallbackTimer)
  window.removeEventListener('focus', onFocus)
})
</script>

<style scoped>
.chat-view {
  display: flex;
  height: 100%;
  min-height: 0;
}
.chat-side {
  width: 260px;
  flex-shrink: 0;
  background: #fff;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
}
.side-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid #eef0f3;
  flex-shrink: 0;
}
.side-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2329;
}
.chat-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #f7f8fa;
}
.chat-head {
  height: 52px;
  flex-shrink: 0;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 18px;
}
.peer-name {
  font-size: 15px;
  font-weight: 600;
  color: #1f2329;
}
.peer-deleted-tip {
  font-size: 12px;
  color: #e5484d;
  background: #fef0f0;
  border-radius: 4px;
  padding: 2px 8px;
}
.chat-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #8a919f;
}
.chat-empty-text {
  font-size: 14px;
  margin: 0;
}
</style>
