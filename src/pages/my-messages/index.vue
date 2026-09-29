<template>
  <div class="page">
    <div class="page-head card">
      <div class="header-left">
        <h2 class="page-title">💬 我的消息</h2>
        <p class="page-desc">系统站内消息：任务指派、周报批阅、成果审核、组会汇报等通知都会在这里汇总。</p>
      </div>
      <button class="btn btn-primary" :disabled="msgSaving" @click="onMarkAllRead">
        {{ msgSaving ? '处理中…' : '全部已读' }}
      </button>
    </div>

    <div class="card">
      <p v-if="loading" class="state">加载中…</p>
      <p v-else-if="!messages.length" class="state">暂无消息</p>
      <div v-else class="msg-list">
        <div
          v-for="m in messages"
          :key="m.id"
          class="msg-item"
          :class="{ unread: m.status === 'unread' }"
          @click="onMsgItemClick(m)"
        >
          <div class="msg-item-main">
            <span class="msg-dot" v-if="m.status === 'unread'"></span>
            <div class="msg-item-body">
              <div class="msg-item-title">{{ m.title || '系统消息' }}</div>
              <div class="msg-item-content">{{ m.content || '' }}</div>
            </div>
          </div>
          <div class="msg-item-side">
            <span class="msg-type">{{ msgTypeText(m.msg_type) }}</span>
            <span class="msg-item-time">{{ formatTime(m.created_at) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listMyMessages, markMessageRead, markAllMessagesRead } from '../../api'
import { useSession } from '../../composables/useSession'

const router = useRouter()
const { getSessionUser } = useSession()
const currentUser = getSessionUser()

const messages = ref([])
const loading = ref(false)
const msgSaving = ref(false)

const MSG_TYPE_TEXT = {
  task: '任务',
  weekly: '周报',
  achievement: '成果',
  meeting_report: '组会汇报',
  notice: '公告',
  system: '系统'
}
function msgTypeText(t) { return MSG_TYPE_TEXT[t] || '通知' }

// 消息类型 → 落地页面（与顶栏铃铛跳转逻辑保持一致）
const REF_ROUTE_MAP = { notice: '/notice', achievement: '/achievement' }
function msgTarget(m) {
  if (m.ref_type === 'task') {
    const role = currentUser?.role || ''
    if (role === 'student') {
      return { path: '/my-work', query: m.ref_id ? { focus: m.ref_id } : {} }
    }
    return '/task'
  }
  if (m.ref_type === 'weekly') {
    return { path: '/research-record', query: { tab: 'weekly', ...(m.ref_id ? { focus: m.ref_id } : {}) } }
  }
  return REF_ROUTE_MAP[m.ref_type] || null
}

function formatTime(t) {
  if (!t) return ''
  const d = new Date(t)
  if (isNaN(d.getTime())) return String(t)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function load() {
  loading.value = true
  try {
    const res = await listMyMessages({})
    messages.value = (res && res.success && res.data) || []
  } catch (e) {
    messages.value = []
  } finally {
    loading.value = false
  }
}

// 点击消息：未读先标记已读，再跳转对应业务页面（无对应页面则仅标已读）
async function onMsgItemClick(m) {
  if (m.status === 'unread') {
    try { await markMessageRead(m.id) } catch (e) {}
    m.status = 'read'
    notifyReadChanged()
  }
  const target = msgTarget(m)
  if (target) router.push(target)
}

async function onMarkAllRead() {
  if (!messages.value.some((m) => m.status === 'unread')) return
  msgSaving.value = true
  try {
    await markAllMessagesRead()
    messages.value = messages.value.map((m) => ({ ...m, status: 'read' }))
    notifyReadChanged()
  } catch (e) {
  } finally {
    msgSaving.value = false
  }
}

// 已读状态变化后通知顶栏刷新未读角标（本页与顶栏铃铛为独立组件，无共享响应式状态）
function notifyReadChanged() {
  window.dispatchEvent(new Event('messages-read-changed'))
}

onMounted(load)
</script>

<style scoped>
.page { display: flex; flex-direction: column; gap: 16px; }
.card {
  background: #fff; border: 1px solid #eceff3; border-radius: 12px; padding: 18px 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}
.page-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.header-left { display: flex; align-items: flex-end; gap: 14px; }
.page-title { margin: 0; font-size: 18px; color: #1f2329; }
.page-desc { margin: 0 0 3px; font-size: 13px; color: #8a9099; }
.state { padding: 36px 0; text-align: center; color: #8a9099; font-size: 13px; }

.btn {
  padding: 7px 14px; border-radius: 8px; border: 1px solid #dfe3e8; background: #fff;
  font-size: 13px; color: #1f2329; cursor: pointer;
}
.btn:hover { border-color: #0d80e0; color: #0d80e0; }
.btn-primary { background: linear-gradient(135deg, #0d80e0, #19a558); color: #fff; border: none; }
.btn-primary:hover { opacity: 0.9; color: #fff; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }

.msg-list { display: flex; flex-direction: column; }
.msg-item {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
  padding: 14px 6px; cursor: pointer; border-bottom: 1px solid #f2f4f7;
}
.msg-item:last-child { border-bottom: none; }
.msg-item:hover { background: #f7f9fc; }
.msg-item.unread { background: #eef6ff; }
.msg-item.unread:hover { background: #e3f0ff; }
.msg-item-main { display: flex; align-items: flex-start; gap: 10px; flex: 1 1 auto; min-width: 0; }
.msg-dot {
  width: 8px; height: 8px; border-radius: 50%; background: #ea4335;
  flex-shrink: 0; margin-top: 6px;
}
.msg-item-body { flex: 1 1 auto; min-width: 0; }
.msg-item-title { font-size: 14px; color: #1f2329; font-weight: 500; margin-bottom: 4px; }
.msg-item-content {
  font-size: 13px; color: #4e5969; line-height: 1.5;
  overflow: hidden; text-overflow: ellipsis; display: -webkit-box;
  -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.msg-item-side { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
.msg-type {
  font-size: 11px; color: #0d80e0; background: #eef6ff;
  padding: 2px 8px; border-radius: 999px;
}
.msg-item-time { font-size: 12px; color: #8a9099; }
</style>
