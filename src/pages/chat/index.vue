<template>
  <div class="chat-page">
    <!-- 左栏：会话列表 + 搜索 -->
    <aside class="chat-side">
      <div class="side-head">
        <div class="side-actions">
          <span class="side-title">消息</span>
          <button class="btn-new" :disabled="contactLoading" @click="openContactPicker">＋ 发起聊天</button>
        </div>
        <input
          v-model="searchKw"
          class="search-input"
          placeholder="搜索聊天记录"
        />
      </div>

      <!-- 搜索结果 -->
      <div v-if="searchKw.trim()" class="search-results">
        <div v-if="searching" class="side-state">搜索中…</div>
        <div v-else-if="!searchResults.length" class="side-state">未找到相关聊天记录</div>
        <div
          v-for="r in searchResults"
          :key="'s' + r.id"
          class="search-item"
          @click="goSearchResult(r)"
        >
          <div class="search-item-main">{{ r.content || ('【' + (r.content_type === 'image' ? '图片' : '文件') + '】' + (r.file_name || '')) }}</div>
          <div class="search-item-sub">{{ r.sender_display_name }} · {{ formatTime(r.created_at) }}</div>
        </div>
      </div>

      <!-- 会话列表 -->
      <div v-else class="conv-list">
        <div v-if="convLoading" class="side-state">加载中…</div>
        <div v-else-if="!conversations.length" class="side-state">
          <p>暂无会话</p>
          <p class="side-hint">点击「发起聊天」联系同课题组的导师 / 同学</p>
        </div>
        <div
          v-for="c in conversations"
          :key="c.conversation_id"
          class="conv-item"
          :class="{ active: c.conversation_id === currentConvId }"
          @click="openConversationById(c.conversation_id)"
        >
          <span class="conv-avatar">{{ avatarText(c.peer.display_name) }}</span>
          <div class="conv-main">
            <div class="conv-title-row">
              <span class="conv-name">{{ c.peer.display_name }}</span>
              <span class="conv-role" :class="c.peer.role === 'mentor' ? 'role-mentor' : 'role-student'">{{ c.peer.role === 'mentor' ? '导师' : '学生' }}</span>
            </div>
            <div class="conv-last">{{ lastPreview(c) }}</div>
          </div>
          <div class="conv-side">
            <span class="conv-time">{{ formatListTime(c.last_msg_at || c.updated_at) }}</span>
            <span v-if="c.unread > 0" class="conv-badge">{{ c.unread > 99 ? '99+' : c.unread }}</span>
            <button class="conv-del" title="删除会话" @click.stop="onDeleteConversation(c)">✕</button>
          </div>
        </div>
      </div>
    </aside>

    <!-- 右栏：消息区 -->
    <section class="chat-main">
      <template v-if="currentPeer">
        <div class="chat-head">
          <div class="chat-peer">
            <span class="conv-avatar">{{ avatarText(currentPeer.display_name) }}</span>
            <div>
              <div class="chat-peer-name">{{ currentPeer.display_name }}</div>
              <div class="chat-peer-sub">{{ currentPeer.role === 'mentor' ? '导师' : '学生' }} · 同课题组</div>
            </div>
          </div>
          <button class="btn-plain" @click="onDeleteConversation({ conversation_id: currentConvId, peer: currentPeer })">删除会话</button>
        </div>

        <div ref="msgListRef" class="msg-list" @scroll="onMsgScroll">
          <div v-if="msgLoading" class="msg-state">加载中…</div>
          <div v-else-if="!messages.length" class="msg-state">还没有消息，打个招呼吧</div>
          <template v-else>
            <button v-if="hasMore" class="load-more" :disabled="loadingMore" @click="loadMore">
              {{ loadingMore ? '加载中…' : '加载更早的消息' }}
            </button>
            <div
              v-for="m in messages"
              :key="m.id"
              :id="'msg-' + m.id"
              class="msg-row"
              :class="{ mine: m.sender_id === currentUser.id, highlight: m.id === highlightId }"
            >
              <div class="bubble">
                <template v-if="m.is_recalled">
                  <span class="recalled-text">消息已撤回</span>
                </template>
                <template v-else-if="m.content_type === 'text'">
                  <span class="text-content">{{ m.content }}</span>
                </template>
                <template v-else-if="m.content_type === 'image'">
                  <img v-if="m.imageUrl" :src="m.imageUrl" class="img-msg" @click="onOpenAttachment(m)" />
                  <span v-else-if="m.imageLoading" class="img-state">加载中…</span>
                  <span v-else-if="m.imageError" class="img-state clickable" @click="onOpenAttachment(m)">{{ m.imageError }}（点击打开）</span>
                  <span v-else class="img-state clickable" @click="ensureImageUrl(m)">点击预览图片</span>
                </template>
                <template v-else>
                  <div class="file-card" @click="onOpenAttachment(m)">
                    <span class="file-icon">📄</span>
                    <span class="file-meta">
                      <span class="file-name">{{ m.file_name }}</span>
                      <span class="file-size">{{ formatSize(m.file_size) }}</span>
                    </span>
                  </div>
                </template>
                <span class="msg-time">{{ formatTime(m.created_at) }}</span>
                <button v-if="canRecall(m)" class="recall-btn" @click="onRecall(m)">撤回</button>
              </div>
            </div>
          </template>
        </div>

        <div class="chat-input-bar">
          <div class="input-tools">
            <button class="tool-btn" :disabled="picking" @click="onPickAttachment">
              {{ picking ? '发送中…' : '📎 图片 / 文件' }}
            </button>
          </div>
          <textarea
            v-model="draft"
            class="msg-textarea"
            placeholder="输入消息，Enter 发送，Shift+Enter 换行"
            @keydown.enter.exact.prevent="onSend"
          ></textarea>
          <button class="btn-send" :disabled="sending || !draft.trim()" @click="onSend">
            {{ sending ? '发送中…' : '发送' }}
          </button>
        </div>
      </template>

      <div v-else class="chat-empty">
        <p class="empty-icon">💬</p>
        <p>选择左侧会话开始聊天</p>
        <p class="empty-hint">仅可与同课题组的导师 / 学生互发消息</p>
      </div>
    </section>

    <!-- 发起聊天弹窗 -->
    <div v-if="showContactPicker" class="modal-mask" @click.self="showContactPicker = false">
      <div class="modal-box contact-box">
        <p class="modal-text contact-title">发起聊天</p>
        <div v-if="contactLoading" class="contact-state">加载中…</div>
        <div v-else-if="!contacts.length" class="contact-state">同课题组暂无可聊对象（仅导师 / 学生可互聊）</div>
        <div v-else class="contact-list">
          <div v-for="c in contacts" :key="c.id" class="contact-item" @click="openConversationByUser(c.id)">
            <span class="conv-avatar">{{ avatarText(c.display_name) }}</span>
            <div class="contact-main">
              <div class="contact-name">
                {{ c.display_name }}
                <span class="conv-role" :class="c.role_in_group === 'mentor' ? 'role-mentor' : 'role-student'">{{ c.role_in_group === 'mentor' ? '导师' : '学生' }}</span>
              </div>
              <div class="contact-sub">{{ c.group_name }}</div>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="modal-btn cancel" @click="showContactPicker = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  listChatContacts,
  listChatConversations,
  openChatConversation,
  listChatMessages,
  sendChatMessage,
  recallChatMessage,
  markChatRead,
  deleteChatConversation,
  searchChatMessages,
  getChatUnreadTotal,
  getChatAttachmentPreview,
  onChatPush,
  pickAttachment,
  openAttachment
} from '../../api'
import { useSession } from '../../composables/useSession'
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'

const route = useRoute()
const { getSessionUser } = useSession()
const currentUser = getSessionUser()
const currentUserId = currentUser ? currentUser.id : 0

// ===== 会话列表 =====
const conversations = ref([])
const convLoading = ref(false)

// ===== 当前会话与消息 =====
const currentConvId = ref(null)
const currentPeer = ref(null)
const messages = ref([])
const msgLoading = ref(false)
const hasMore = ref(true)
const loadingMore = ref(false)
const highlightId = ref(0)
const msgListRef = ref(null)

// ===== 输入与发送 =====
const draft = ref('')
const sending = ref(false)
const picking = ref(false)

// ===== 发起聊天 / 搜索 =====
const showContactPicker = ref(false)
const contactLoading = ref(false)
const contacts = ref([])
const searchKw = ref('')
const searchResults = ref([])
const searching = ref(false)

// ===== 工具函数 =====
function avatarText(name) {
  return (name || '?').charAt(0).toUpperCase()
}

function formatSize(n) {
  const size = Number(n) || 0
  if (size <= 0) return ''
  if (size < 1024) return size + ' B'
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB'
  if (size < 1024 * 1024 * 1024) return (size / 1024 / 1024).toFixed(1) + ' MB'
  return (size / 1024 / 1024 / 1024).toFixed(1) + ' GB'
}

function formatTime(t) {
  if (!t) return ''
  const d = new Date(String(t).replace(' ', 'T'))
  if (isNaN(d.getTime())) return String(t)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatListTime(t) {
  if (!t) return ''
  const d = new Date(String(t).replace(' ', 'T'))
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  if (d.toDateString() === now.toDateString()) return `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (d.getFullYear() === now.getFullYear()) return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function lastPreview(c) {
  if (c.last_is_recalled) return '[消息已撤回]'
  if (c.last_content_type === 'image') return `[图片] ${c.last_file_name || ''}`
  if (c.last_content_type === 'file') return `[文件] ${c.last_file_name || ''}`
  return c.last_content || ''
}

function canRecall(m) {
  if (m.is_recalled || m.sender_id !== currentUserId) return false
  const d = new Date(String(m.created_at).replace(' ', 'T'))
  if (isNaN(d.getTime())) return false
  return (Date.now() - d.getTime()) / 1000 <= 120
}

// ===== 会话列表 =====
async function loadConversations() {
  try {
    const res = await listChatConversations()
    if (res && res.success) {
      conversations.value = res.data || []
    }
  } catch (e) {}
}

// ===== 消息加载与渲染 =====
function scrollToBottom() {
  nextTick(() => {
    const el = msgListRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function addMessage(msg, opts = {}) {
  if (!msg || !msg.id) return
  const exist = messages.value.find((m) => m.id === msg.id)
  if (exist) {
    Object.assign(exist, msg)
    return
  }
  messages.value.push(msg)
  messages.value.sort((a, b) => a.id - b.id)
  if (msg.content_type === 'image' && !msg.is_recalled) ensureImageUrl(msg)
  const el = msgListRef.value
  const nearBottom = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120
  if (opts.scroll !== false && (msg.sender_id === currentUserId || nearBottom)) {
    scrollToBottom()
  }
}

async function loadMessages({ reset = true, beforeId = 0 } = {}) {
  if (!currentConvId.value) return
  if (reset) msgLoading.value = true
  try {
    const res = await listChatMessages(currentConvId.value, beforeId, 50)
    if (!res || !res.success) return
    const rows = res.data || []
    if (reset) messages.value = []
    for (const m of rows) addMessage(m, { scroll: false })
    hasMore.value = rows.length >= 50
    if (reset) scrollToBottom()
  } finally {
    if (reset) msgLoading.value = false
  }
}

async function loadMore() {
  if (!hasMore.value || loadingMore.value) return
  loadingMore.value = true
  try {
    const oldest = messages.value.length ? messages.value[0].id : 0
    await loadMessages({ reset: false, beforeId: oldest })
  } finally {
    loadingMore.value = false
  }
}

// 滚动监听：用户滚到顶部附近时自动加载更早
function onMsgScroll() {
  const el = msgListRef.value
  if (!el) return
  if (el.scrollTop < 40 && hasMore.value && !loadingMore.value && !msgLoading.value) {
    loadMore()
  }
}

// ===== 打开会话 =====
async function openConversationById(convId, focusMsgId = 0) {
  if (!convId) return
  currentConvId.value = convId
  const conv = conversations.value.find((c) => c.conversation_id === convId)
  currentPeer.value = conv ? conv.peer : null
  messages.value = []
  highlightId.value = 0
  hasMore.value = true
  await loadMessages({ reset: true })
  if (focusMsgId) {
    let found = messages.value.some((m) => m.id === focusMsgId)
    let pages = 0
    while (!found && hasMore.value && pages < 6) {
      pages += 1
      const oldest = messages.value.length ? messages.value[0].id : 0
      await loadMessages({ reset: false, beforeId: oldest })
      found = messages.value.some((m) => m.id === focusMsgId)
    }
    if (found) {
      highlightId.value = focusMsgId
      await nextTick()
      const el = document.getElementById('msg-' + focusMsgId)
      if (el) el.scrollIntoView({ block: 'center' })
    } else {
      scrollToBottom()
    }
  }
  scheduleMarkRead()
}

async function openConversationByUser(userId) {
  showContactPicker.value = false
  const res = await openChatConversation(userId)
  if (!res || !res.success) {
    dialogAlert((res && res.message) || '无法发起会话')
    return
  }
  await loadConversations()
  const conv = conversations.value.find((c) => c.conversation_id === res.data.conversation_id)
  currentConvId.value = res.data.conversation_id
  currentPeer.value = conv ? conv.peer : (res.data.peer || null)
  messages.value = []
  hasMore.value = true
  await loadMessages({ reset: true })
  scheduleMarkRead()
}

// ===== 已读 =====
let readTimer = null
function scheduleMarkRead() {
  clearTimeout(readTimer)
  readTimer = setTimeout(async () => {
    const cid = currentConvId.value
    if (!cid) return
    try {
      const res = await markChatRead(cid)
      if (res && res.success) {
        const conv = conversations.value.find((c) => c.conversation_id === cid)
        if (conv) conv.unread = 0
        fetchUnreadTotal()
        // 铃铛（业务通知）联动：聊天已读时后端已同步把 message 表该会话聊天消息标已读，
        // 通知布局重新拉取 message:unread-count 刷新铃铛数字（否则铃铛停留旧值）。
        window.dispatchEvent(new CustomEvent('messages-read-changed'))
      }
    } catch (e) {}
  }, 600)
}

// ===== 未读角标 =====
async function fetchUnreadTotal() {
  try {
    const res = await getChatUnreadTotal()
    const total = (res && res.success && res.data && res.data.total) || 0
    window.dispatchEvent(new CustomEvent('chat-unread-changed', { detail: { total } }))
  } catch (e) {}
}

// ===== 发送 =====
async function onSend() {
  const text = draft.value.trim()
  if (!text || !currentConvId.value || sending.value) return
  sending.value = true
  try {
    const res = await sendChatMessage({
      conversation_id: currentConvId.value,
      content_type: 'text',
      content: text
    })
    if (res && res.success) {
      draft.value = ''
      addMessage(res.data)
      loadConversations()
    } else {
      dialogAlert((res && res.message) || '发送失败')
    }
  } finally {
    sending.value = false
  }
}

// 附件（图片 / 文件）：先选文件复制到 uploads，再以附件消息发送；图片自动识别
async function onPickAttachment() {
  if (!currentConvId.value || picking.value) return
  picking.value = true
  try {
    const picked = await pickAttachment()
    if (!picked || !picked.success) {
      if (picked && picked.canceled !== true && picked.message) dialogAlert(picked.message)
      return
    }
    const isImage = /\.(png|jpe?g|gif|webp|bmp)$/i.test(picked.name || '')
    const res = await sendChatMessage({
      conversation_id: currentConvId.value,
      content_type: isImage ? 'image' : 'file',
      content: '',
      file_name: picked.name,
      file_path: picked.path
    })
    if (res && res.success) {
      addMessage(res.data)
      loadConversations()
    } else {
      dialogAlert((res && res.message) || '发送失败')
    }
  } finally {
    picking.value = false
  }
}

function onOpenAttachment(m) {
  if (!m.file_path) return
  openAttachment(m.file_path)
}

// 图片内嵌预览（base64；大图返回提示，点击打开）
async function ensureImageUrl(m) {
  if (!m || !m.file_path || m.imageUrl || m.imageLoading || m.imageError) return
  m.imageLoading = true
  try {
    const res = await getChatAttachmentPreview(m.file_path)
    if (res && res.success) m.imageUrl = res.dataUrl
    else m.imageError = (res && res.message) || '无法预览'
  } catch (e) {
    m.imageError = '无法预览'
  } finally {
    m.imageLoading = false
  }
}

// ===== 撤回（仅发送者、2 分钟内） =====
async function onRecall(m) {
  const ok = await dialogConfirm('撤回这条消息？撤回后双方都将看到「消息已撤回」。', '撤回消息')
  if (!ok) return
  try {
    const res = await recallChatMessage(m.id)
    if (res && res.success) {
      m.is_recalled = 1
      m.content = ''
      m.file_name = ''
      m.file_path = ''
      loadConversations()
    } else {
      dialogAlert((res && res.message) || '撤回失败')
    }
  } catch (e) {
    dialogAlert('撤回失败')
  }
}

// ===== 删除会话（本侧隐藏） =====
async function onDeleteConversation(c) {
  if (!c || !c.conversation_id) return
  const name = c.peer ? c.peer.display_name : '该会话'
  const ok = await dialogConfirm(`删除与「${name}」的会话？仅从你的列表中移除，对方聊天记录不受影响。`, '删除会话')
  if (!ok) return
  try {
    const res = await deleteChatConversation(c.conversation_id)
    if (res && res.success) {
      if (currentConvId.value === c.conversation_id) {
        currentConvId.value = null
        currentPeer.value = null
        messages.value = []
      }
      loadConversations()
      fetchUnreadTotal()
    } else {
      dialogAlert((res && res.message) || '删除失败')
    }
  } catch (e) {
    dialogAlert('删除失败')
  }
}

// ===== 发起聊天 =====
async function openContactPicker() {
  showContactPicker.value = true
  contactLoading.value = true
  try {
    const res = await listChatContacts()
    contacts.value = (res && res.success && res.data) || []
  } catch (e) {
    contacts.value = []
  } finally {
    contactLoading.value = false
  }
}

// ===== 搜索聊天记录 =====
let searchTimer = null
watch(searchKw, () => {
  clearTimeout(searchTimer)
  const kw = searchKw.value.trim()
  if (!kw) {
    searchResults.value = []
    searching.value = false
    return
  }
  searching.value = true
  searchTimer = setTimeout(doSearch, 400)
})

async function doSearch() {
  const kw = searchKw.value.trim()
  if (!kw) return
  try {
    const res = await searchChatMessages(kw)
    searchResults.value = (res && res.success && res.data) || []
  } catch (e) {
    searchResults.value = []
  } finally {
    searching.value = false
  }
}

async function goSearchResult(r) {
  searchKw.value = ''
  searchResults.value = []
  await openConversationById(r.conversation_id, r.id)
}

// ===== 实时推送：对方发送立即弹出 =====
function handlePush(payload) {
  const list = (payload && payload.messages) || []
  if (!list.length) return
  let needRead = false
  for (const m of list) {
    if (m.conversation_id === currentConvId.value) {
      addMessage(m)
      needRead = true
    }
  }
  if (needRead) scheduleMarkRead()
  loadConversations()
  fetchUnreadTotal()
}

// ===== 轮询兜底（推送异常时不空白） =====
let pollTimer = null
async function pollRefresh() {
  loadConversations()
  fetchUnreadTotal()
  if (currentConvId.value) {
    try {
      const res = await listChatMessages(currentConvId.value, 0, 50)
      if (res && res.success) {
        for (const m of res.data || []) addMessage(m, { scroll: false })
      }
    } catch (e) {}
  }
}

// ===== 生命周期 =====
let offPush = null

onMounted(() => {
  loadConversations()
  fetchUnreadTotal()
  offPush = onChatPush(handlePush)
  pollTimer = setInterval(pollRefresh, 30000)
  // 路由携带 conv 参数（铃铛聊天消息跳转）→ 自动打开对应会话
  const conv = Number(route.query.conv)
  if (conv > 0) {
    openConversationById(conv)
  }
})

onUnmounted(() => {
  if (offPush) offPush()
  if (pollTimer) clearInterval(pollTimer)
  if (readTimer) clearTimeout(readTimer)
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<style scoped>
.chat-page {
  display: flex;
  gap: 0;
  height: calc(100vh - 130px);
  min-height: 480px;
  background: #fff;
  border: 1px solid #eceff3;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

/* ===== 左栏 ===== */
.chat-side {
  flex: 0 0 280px;
  width: 280px;
  border-right: 1px solid #eceff3;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: #fafbfc;
}
.side-head { padding: 12px; display: flex; flex-direction: column; gap: 10px; border-bottom: 1px solid #eceff3; }
.side-actions { display: flex; align-items: center; justify-content: space-between; }
.side-title { font-size: 15px; font-weight: 600; color: #1f2329; }
.btn-new {
  padding: 5px 12px; border-radius: 8px; border: 1px solid #0d80e0; color: #0d80e0;
  background: #fff; font-size: 12.5px; cursor: pointer;
}
.btn-new:hover { background: #eef6ff; }
.btn-new:disabled { opacity: 0.6; cursor: not-allowed; }
.search-input {
  width: 100%; box-sizing: border-box; padding: 7px 10px;
  border: 1px solid #dfe3e8; border-radius: 8px; font-size: 12.5px; outline: none;
}
.search-input:focus { border-color: #0d80e0; }

.conv-list { flex: 1 1 auto; overflow-y: auto; min-height: 0; }
.conv-item {
  display: flex; align-items: center; gap: 10px;
  padding: 11px 12px; cursor: pointer; border-bottom: 1px solid #f2f4f7;
  position: relative;
}
.conv-item:hover { background: #f2f6fc; }
.conv-item.active { background: #e8f2ff; }
.conv-avatar {
  width: 36px; height: 36px; border-radius: 50%; background: #0d80e0; color: #fff;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 15px; font-weight: 600; flex-shrink: 0;
}
.conv-main { flex: 1 1 auto; min-width: 0; }
.conv-title-row { display: flex; align-items: center; gap: 6px; }
.conv-name { font-size: 13.5px; color: #1f2329; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.conv-role {
  font-size: 11px; padding: 1px 6px; border-radius: 999px; flex-shrink: 0;
}
.role-mentor { color: #0d80e0; background: #e8f2ff; }
.role-student { color: #19a558; background: #e8f7ef; }
.conv-last {
  font-size: 12px; color: #8a9099; margin-top: 3px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.conv-side { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
.conv-time { font-size: 11px; color: #a8adb5; }
.conv-badge {
  min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px;
  background: #ea4335; color: #fff; font-size: 11px;
  display: inline-flex; align-items: center; justify-content: center;
}
.conv-del {
  position: absolute; right: 10px; top: 10px;
  width: 20px; height: 20px; border: none; border-radius: 50%;
  background: rgba(0, 0, 0, 0.06); color: #8a9099; font-size: 11px;
  cursor: pointer; display: none; align-items: center; justify-content: center;
}
.conv-item:hover .conv-del { display: inline-flex; }
.conv-del:hover { background: #ea4335; color: #fff; }

.side-state { padding: 28px 16px; text-align: center; color: #8a9099; font-size: 12.5px; }
.side-hint { font-size: 11.5px; margin-top: 4px; }

.search-results { flex: 1 1 auto; overflow-y: auto; min-height: 0; }
.search-item { padding: 10px 12px; cursor: pointer; border-bottom: 1px solid #f2f4f7; }
.search-item:hover { background: #f2f6fc; }
.search-item-main {
  font-size: 12.5px; color: #1f2329; line-height: 1.5;
  overflow: hidden; text-overflow: ellipsis; display: -webkit-box;
  -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.search-item-sub { font-size: 11.5px; color: #8a9099; margin-top: 3px; }

/* ===== 右栏 ===== */
.chat-main { flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.chat-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 16px; border-bottom: 1px solid #eceff3; flex-shrink: 0;
}
.chat-peer { display: flex; align-items: center; gap: 10px; }
.chat-peer-name { font-size: 14px; font-weight: 600; color: #1f2329; }
.chat-peer-sub { font-size: 11.5px; color: #8a9099; margin-top: 2px; }
.btn-plain {
  padding: 5px 12px; border: 1px solid #dfe3e8; border-radius: 8px;
  background: #fff; color: #6b7280; font-size: 12.5px; cursor: pointer;
}
.btn-plain:hover { color: #ea4335; border-color: #ea4335; }

.msg-list { flex: 1 1 auto; overflow-y: auto; padding: 14px 16px; min-height: 0; display: flex; flex-direction: column; }
.msg-state { text-align: center; color: #a8adb5; font-size: 12.5px; padding: 40px 0; }
.load-more {
  align-self: center; margin-bottom: 10px; padding: 5px 14px;
  border: 1px solid #dfe3e8; border-radius: 999px; background: #fff;
  color: #6b7280; font-size: 12px; cursor: pointer;
}
.load-more:hover { color: #0d80e0; border-color: #0d80e0; }
.load-more:disabled { opacity: 0.6; cursor: not-allowed; }

.msg-row { display: flex; margin-bottom: 10px; }
.msg-row.mine { justify-content: flex-end; }
.msg-row.highlight .bubble { box-shadow: 0 0 0 2px #ffd591; }
.bubble {
  max-width: 62%; position: relative;
  background: #f2f4f7; border-radius: 10px; padding: 8px 12px;
  font-size: 13.5px; color: #1f2329; line-height: 1.55; word-break: break-word;
}
.msg-row.mine .bubble { background: linear-gradient(135deg, #0d80e0, #19a558); color: #fff; }
.text-content { white-space: pre-wrap; }
.recalled-text { color: #a8adb5; font-style: italic; font-size: 12.5px; }
.msg-time { display: block; font-size: 10.5px; color: #a8adb5; margin-top: 4px; }
.msg-row.mine .msg-time { color: rgba(255, 255, 255, 0.75); }
.recall-btn {
  display: block; margin-top: 4px; padding: 0;
  border: none; background: none; color: #0d80e0; font-size: 11px; cursor: pointer;
}
.msg-row.mine .recall-btn { color: rgba(255, 255, 255, 0.85); }

.img-msg { max-width: 220px; max-height: 220px; border-radius: 8px; cursor: pointer; display: block; }
.img-state { font-size: 12px; color: #8a9099; }
.img-state.clickable { cursor: pointer; color: #0d80e0; }

.file-card {
  display: flex; align-items: center; gap: 8px; cursor: pointer;
  min-width: 180px; padding: 6px 8px; background: rgba(255, 255, 255, 0.5);
  border-radius: 8px;
}
.msg-row.mine .file-card { background: rgba(255, 255, 255, 0.2); }
.file-icon { font-size: 20px; }
.file-meta { display: flex; flex-direction: column; min-width: 0; }
.file-name { font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px; }
.file-size { font-size: 11px; opacity: 0.75; }

.chat-input-bar {
  display: flex; align-items: flex-end; gap: 10px;
  padding: 10px 14px; border-top: 1px solid #eceff3; flex-shrink: 0;
}
.input-tools { flex-shrink: 0; }
.tool-btn {
  padding: 7px 12px; border: 1px solid #dfe3e8; border-radius: 8px;
  background: #fff; font-size: 12.5px; color: #4e5969; cursor: pointer;
}
.tool-btn:hover { border-color: #0d80e0; color: #0d80e0; }
.tool-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.msg-textarea {
  flex: 1 1 auto; height: 60px; resize: none; box-sizing: border-box;
  padding: 8px 10px; border: 1px solid #dfe3e8; border-radius: 8px;
  font-size: 13.5px; font-family: inherit; outline: none; line-height: 1.5;
}
.msg-textarea:focus { border-color: #0d80e0; }
.btn-send {
  padding: 9px 18px; border: none; border-radius: 8px;
  background: linear-gradient(135deg, #0d80e0, #19a558); color: #fff;
  font-size: 13px; cursor: pointer; flex-shrink: 0;
}
.btn-send:hover { opacity: 0.9; }
.btn-send:disabled { opacity: 0.5; cursor: not-allowed; }

.chat-empty {
  flex: 1 1 auto; display: flex; flex-direction: column;
  align-items: center; justify-content: center; color: #a8adb5; font-size: 13px;
}
.empty-icon { font-size: 34px; margin-bottom: 8px; }
.empty-hint { font-size: 11.5px; margin-top: 4px; }

/* ===== 发起聊天弹窗 ===== */
.modal-mask {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45); z-index: 1000;
  display: flex; align-items: center; justify-content: center;
}
.modal-box {
  width: 380px; max-height: 520px; background: #fff; border-radius: 12px;
  padding: 18px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
}
.contact-title { font-size: 15px; font-weight: 600; margin-bottom: 12px; }
.contact-list { max-height: 380px; overflow-y: auto; }
.contact-state { text-align: center; color: #8a9099; font-size: 12.5px; padding: 24px 0; }
.contact-item {
  display: flex; align-items: center; gap: 10px; padding: 9px 6px;
  cursor: pointer; border-radius: 8px;
}
.contact-item:hover { background: #f2f6fc; }
.contact-main { min-width: 0; }
.contact-name { font-size: 13.5px; color: #1f2329; display: flex; align-items: center; gap: 6px; }
.contact-sub { font-size: 11.5px; color: #8a9099; margin-top: 2px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px; }
.modal-btn { padding: 7px 16px; border-radius: 8px; font-size: 13px; cursor: pointer; }
.modal-btn.cancel { border: 1px solid #dfe3e8; background: #fff; color: #4e5969; }
.modal-btn.cancel:hover { border-color: #0d80e0; color: #0d80e0; }
</style>
