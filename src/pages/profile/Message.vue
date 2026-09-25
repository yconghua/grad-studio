<template>
  <div class="page">
    <div class="head">
      <h3 class="title">消息中心</h3>
      <div class="head-right">
        <span class="badge">{{ unread }} 条未读</span>
        <button v-if="isManager" class="btn-send" @click="openSend">发消息</button>
        <button class="btn-mark-all" @click="markAll" v-if="unread > 0">全部已读</button>
      </div>
    </div>

    <div class="tabs">
      <button class="tab" :class="{ active: filter === 'all' }" @click="setFilter('all')">全部</button>
      <button class="tab" :class="{ active: filter === 'unread' }" @click="setFilter('unread')">未读</button>
    </div>

    <div v-if="loading" class="empty">加载中…</div>
    <div v-else-if="!filteredList.length" class="empty">{{ filter === 'unread' ? '暂无未读消息' : '暂无消息' }}</div>
    <div v-else class="list">
      <div v-for="m in filteredList" :key="m.id" class="item" :class="{ unread: m.status === 'unread' }" @click="open(m)">
        <div class="item-head">
          <span class="item-title">{{ m.title || '（无标题）' }}</span>
          <span class="item-time">{{ fmt(m.created_at) }}</span>
        </div>
        <p class="item-content">{{ m.content }}</p>
        <span v-if="m.status === 'unread'" class="dot">未读</span>
      </div>
    </div>

    <!-- 发消息弹窗（仅导师 / 管理员） -->
    <div v-if="sendVisible" class="modal-mask" @click.self="sendVisible = false">
      <div class="modal-box">
        <div class="modal-head">
          <h4>发送消息</h4>
          <button class="modal-close" @click="sendVisible = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-item">
            <label class="form-label">收件人<span class="req"> *</span></label>
            <select v-model="sendForm.receiver_id" class="form-input">
              <option :value="null">请选择收件人</option>
              <option v-for="u in members" :key="u.id" :value="u.id">{{ u.real_name || u.username }}（{{ roleLabel(u.role) }}）</option>
            </select>
          </div>
          <div class="form-item">
            <label class="form-label">标题<span class="req"> *</span></label>
            <input v-model="sendForm.title" class="form-input" placeholder="如：请及时填写本周周报" />
          </div>
          <div class="form-item">
            <label class="form-label">内容</label>
            <textarea v-model="sendForm.content" class="form-input" rows="4" placeholder="消息正文（可选）"></textarea>
          </div>
          <p v-if="sendError" class="form-error">{{ sendError }}</p>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="sendVisible = false">取消</button>
          <button class="btn btn-primary" @click="submitSend" :disabled="sending">{{ sending ? '发送中…' : '发送' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { system, listMembers } from '../../api'
import { useRole } from '../../composables/useRole'
import { dialogAlert } from '../../composables/useDialog'

const router = useRouter()
const { isManager } = useRole()
const list = ref([])
const members = ref([])
const loading = ref(true)
const unread = ref(0)
// 列表筛选：all 全部 / unread 只看未读
const filter = ref('all')
const filteredList = computed(() =>
  filter.value === 'unread' ? list.value.filter((m) => m.status === 'unread') : list.value
)
function setFilter(v) {
  filter.value = v
}

// 发消息弹窗状态
const sendVisible = ref(false)
const sendForm = ref({})
const sendError = ref('')
const sending = ref(false)

// 通知类别 → 页面路由；无映射的（如 manual / 未知）不跳转。
// 注意：后端 notify 大部分通知只写 type、不写 biz_type，所以优先取 biz_type，兜底用 type。
const BIZ_ROUTES = {
  task: '/collaboration/task',
  approval: '/collaboration/approval',
  weekly_report: '/collaboration/weekly-report',
  meeting: '/collaboration/meeting',
  activity: '/collaboration/activity',
  forum: '/collaboration/forum',
  mention: '/collaboration/task'
}

function fmt(v) {
  return v ? String(v).slice(0, 16) : '-'
}
function roleLabel(v) {
  const map = { admin: '管理员', mentor: '导师', student: '学生' }
  return map[v] || v || '-'
}

async function load() {
  loading.value = true
  try {
    const res = await system.myMessages()
    list.value = res && res.success ? res.list || [] : []
    const u = await system.unreadCount()
    unread.value = u && u.success ? u.count : 0
  } catch (e) {
    list.value = []
  } finally {
    loading.value = false
  }
}

async function loadMembers() {
  try {
    const res = await listMembers()
    members.value = res && res.success ? res.members || [] : []
  } catch (e) {
    members.value = []
  }
}

async function markAll() {
  try {
    await system.markAllRead()
    window.dispatchEvent(new CustomEvent('messages-read'))
    await load()
  } catch (e) {}
}

async function open(m) {
  if (m.status === 'unread') {
    try {
      await system.markRead(m.id)
      // 通知顶部导航立即刷新未读数字
      window.dispatchEvent(new CustomEvent('messages-read'))
    } catch (e) {}
  }
  // 根据消息类别跳转（biz_type 优先，无则用 type）
  const route = BIZ_ROUTES[m.biz_type || m.type]
  if (route) router.push(route)
  await load()
}

function openSend() {
  sendForm.value = { receiver_id: null, title: '', content: '' }
  sendError.value = ''
  sendVisible.value = true
}

async function submitSend() {
  sendError.value = ''
  if (!sendForm.value.receiver_id) {
    sendError.value = '请选择收件人'
    return
  }
  if (!sendForm.value.title || !String(sendForm.value.title).trim()) {
    sendError.value = '请填写标题'
    return
  }
  sending.value = true
  try {
    // 构造普通对象再传，避免 Vue reactive proxy 直接走 IPC 导致序列化异常
    const payload = {
      receiver_id: sendForm.value.receiver_id,
      title: String(sendForm.value.title || '').trim(),
      content: String(sendForm.value.content || ''),
      type: 'manual'
    }
    const res = await system.sendMessage(payload)
    if (res && res.success) {
      sendVisible.value = false
      await dialogAlert('消息已发送')
      await load()
    } else {
      sendError.value = (res && res.message) || '发送失败'
    }
  } catch (e) {
    console.error('[Message.send] 异常:', e)
    sendError.value = '发送过程出现异常，请重试'
  } finally {
    sending.value = false
  }
}

onMounted(() => {
  load()
  loadMembers()
})
</script>

<style scoped>
.page {
  background: #fff;
  border: 1px solid #eceff3;
  border-radius: 12px;
  padding: 18px 20px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.head-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.badge {
  font-size: 12px;
  color: #0d80e0;
  background: #eef6ff;
  padding: 4px 10px;
  border-radius: 999px;
}
.btn-send {
  font-size: 12px;
  border: none;
  border-radius: 6px;
  padding: 4px 12px;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  color: #fff;
  cursor: pointer;
}
.btn-send:disabled {
  opacity: 0.6;
}
.btn-mark-all {
  font-size: 12px;
  border: 1px solid #dfe3e8;
  border-radius: 6px;
  padding: 4px 10px;
  background: #fff;
  cursor: pointer;
  color: #4e5969;
}
.btn-mark-all:hover {
  border-color: #0d80e0;
  color: #0d80e0;
}
/* 全部 / 未读筛选 */
.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.tab {
  font-size: 13px;
  padding: 5px 16px;
  border: 1px solid #dfe3e8;
  border-radius: 999px;
  background: #fff;
  color: #4e5969;
  cursor: pointer;
}
.tab.active {
  border-color: #0d80e0;
  background: #eef6ff;
  color: #0d80e0;
  font-weight: 600;
}
.empty {
  text-align: center;
  color: #8a9099;
  padding: 30px 0;
}
.item {
  padding: 12px 14px;
  border: 1px solid #eceff3;
  border-radius: 10px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.2s;
}
.item:hover {
  border-color: #0d80e0;
}
.item.unread {
  background: #f6faff;
  border-left: 3px solid #0d80e0;
}
.item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.item-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}
.item-time {
  font-size: 12px;
  color: #8a9099;
}
.item-content {
  margin: 6px 0 0;
  font-size: 13px;
  color: #4e5969;
  line-height: 1.6;
}
.dot {
  display: inline-block;
  margin-top: 6px;
  font-size: 11px;
  color: #0d80e0;
}
.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-box {
  width: 480px;
  max-width: 92vw;
  max-height: 85vh;
  background: #fff;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #eceff3;
}
.modal-head h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.modal-close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: #f2f3f5;
  color: #4e5969;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}
.modal-body {
  padding: 16px 20px;
  overflow-y: auto;
}
.form-item {
  margin-bottom: 12px;
}
.form-label {
  display: block;
  font-size: 13px;
  color: #4e5969;
  margin-bottom: 6px;
}
.req {
  color: #ea4335;
}
.form-input {
  width: 100%;
  min-height: 36px;
  padding: 0 10px;
  font-size: 13px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  outline: none;
  box-sizing: border-box;
}
.form-input:focus {
  border-color: #0d80e0;
}
.form-error {
  margin: 8px 0 0;
  font-size: 13px;
  color: #ea4335;
}
.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid #eceff3;
}
.btn {
  height: 34px;
  padding: 0 16px;
  font-size: 13px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  background: #fff;
  color: #4e5969;
  cursor: pointer;
}
.btn:hover {
  border-color: #0d80e0;
  color: #0d80e0;
}
.btn-primary {
  border: none;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  color: #fff;
  font-weight: 600;
}
.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
