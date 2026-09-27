<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">📢 课题组公告</h2>
      <div class="ph-right">
        <span v-if="loaded && unreadCount > 0" class="unread-badge">未读 {{ unreadCount }}</span>
        <button v-if="isGroupAdmin" class="btn btn-primary" @click="openCreate">＋ 发布公告</button>
      </div>
    </div>

    <div v-if="!currentGroupId" class="empty-block">
      <p>请先选择/输入课题组ID</p>
    </div>

    <template v-else>
      <div v-if="loading" class="empty-block"><p>加载中…</p></div>
      <div v-else-if="errorMsg" class="error-block">{{ errorMsg }}</div>
      <div v-else-if="!notices.length" class="empty-block">
        <p>📭 暂无公告</p>
      </div>

      <div v-else class="notice-list">
        <div
          v-for="n in notices"
          :key="n.id"
          class="notice-card"
          :class="{ top: n.is_top === 1, unread: n.is_read === 0 }"
          @click="openDetail(n)"
        >
          <div class="nc-main">
            <div class="nc-title-row">
              <span v-if="n.is_top === 1" class="pin-tag">📌 置顶</span>
              <span class="nc-title">{{ n.title }}</span>
              <span v-if="n.is_read === 0" class="dot-unread" title="未读"></span>
            </div>
            <p class="nc-summary">{{ n.content || '（无正文）' }}</p>
            <div class="nc-meta">
              <span>发布人：{{ usernameMap[n.publisher_id] || ('#' + n.publisher_id) }}</span>
              <span>发布时间：{{ fmtTime(n.published_at) }}</span>
              <span class="read-state">{{ n.is_read === 1 ? '已读' : '未读' }}</span>
            </div>
          </div>
          <div v-if="isGroupAdmin" class="nc-actions" @click.stop>
            <button class="btn btn-ghost" @click="openEdit(n)">编辑</button>
            <button class="btn btn-danger" @click="askRemove(n)">删除</button>
          </div>
        </div>
      </div>
    </template>

    <!-- 公告详情 -->
    <div v-if="detailVisible" class="modal-mask" @click.self="detailVisible = false">
      <div class="modal-box modal-lg">
        <h3 class="modal-title">
          <span v-if="detail.is_top === 1" class="pin-tag">📌 置顶</span>
          {{ detail.title }}
        </h3>
        <div class="detail-meta">
          发布人：{{ usernameMap[detail.publisher_id] || ('#' + detail.publisher_id) }} ·
          {{ fmtTime(detail.published_at) }}
        </div>
        <div class="detail-body">{{ detail.content || '（无正文）' }}</div>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="detailVisible = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 新增/编辑弹窗 -->
    <div v-if="formVisible" class="modal-mask" @click.self="formVisible = false">
      <div class="modal-box modal-lg">
        <h3 class="modal-title">{{ form.id ? '编辑公告' : '发布公告' }}</h3>
        <div class="form-item">
          <label class="form-label">公告标题 <span class="req">*</span></label>
          <input v-model="form.title" class="form-input" maxlength="200" placeholder="请输入公告标题" />
        </div>
        <div class="form-item">
          <label class="form-label">公告正文</label>
          <textarea v-model="form.content" class="form-textarea" rows="6" placeholder="请输入公告正文"></textarea>
        </div>
        <div class="form-item">
          <label class="check-label">
            <input type="checkbox" v-model="form.is_topBool" />
            置顶显示（置顶公告将排在列表最前）
          </label>
        </div>
        <p v-if="formError" class="form-error">{{ formError }}</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="formVisible = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="onSave">
            {{ saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 删除确认 -->
    <div v-if="removeTarget" class="modal-mask" @click.self="removeTarget = null">
      <div class="modal-box">
        <p class="modal-text">确定删除公告「{{ removeTarget.title }}」吗？</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="removeTarget = null">取消</button>
          <button class="btn btn-danger" :disabled="removing" @click="onRemove">
            {{ removing ? '删除中…' : '确认删除' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'
import { ref, computed, watch, onMounted } from 'vue'
import {
  listNotices, createNotice, updateNotice, removeNotice,
  markNoticeRead, getNoticeUnreadCount, listMembers
} from '../../api'
import { useGroupContext } from '../../composables/useGroupContext'
import { useRole } from '../../composables/useRole'

const { currentGroupId, loadGroups } = useGroupContext()
const { isGroupAdmin } = useRole()

const notices = ref([])
const loading = ref(false)
const loaded = ref(false)
const errorMsg = ref('')
const unreadCount = ref(0)
const usernameMap = ref({})

const detailVisible = ref(false)
const detail = ref({})

const formVisible = ref(false)
const form = ref({ id: null, title: '', content: '', is_topBool: false })
const formError = ref('')
const saving = ref(false)

const removeTarget = ref(null)
const removing = ref(false)

function fmtTime(t) {
  if (!t) return '-'
  return String(t).replace('T', ' ').slice(0, 16)
}

async function loadUserMap() {
  try {
    const res = await listMembers()
    if (res && res.success) {
      const map = {}
      ;(res.members || []).forEach((m) => { map[m.id] = m.username })
      usernameMap.value = map
    }
  } catch (e) { /* 用户名解析失败不阻断 */ }
}

async function loadNotices() {
  if (!currentGroupId.value) {
    notices.value = []
    loaded.value = false
    unreadCount.value = 0
    return
  }
  loading.value = true
  try {
    const res = await listNotices(currentGroupId.value)
    if (res && res.success) {
      notices.value = res.notices || []
      loaded.value = true
    } else {
      notices.value = []
      loaded.value = true
      errorMsg.value = (res && res.message) || '加载失败'
    }
  } catch (e) {
    notices.value = []
    loaded.value = true
    errorMsg.value = '网络错误，加载失败'
  } finally {
    loading.value = false
  }
  loadUnread()
}

async function loadUnread() {
  if (!currentGroupId.value) { unreadCount.value = 0; return }
  try {
    const res = await getNoticeUnreadCount(currentGroupId.value)
    if (res && res.success) unreadCount.value = res.count || 0
  } catch (e) { /* 忽略 */ }
}

// 通知布局导航栏：公告未读数已变化，请重新拉取
function notifyUnreadChanged() {
  window.dispatchEvent(new CustomEvent('notice-unread-changed'))
}

function openDetail(n) {
  detail.value = n
  detailVisible.value = true
  if (n.is_read === 0) {
    markNoticeRead(n.id).then((res) => {
      if (res && res.success) {
        n.is_read = 1
        loadUnread()
        notifyUnreadChanged()
      }
    }).catch(() => {})
  }
}

function openCreate() {
  form.value = { id: null, title: '', content: '', is_topBool: false }
  formError.value = ''
  formVisible.value = true
}

function openEdit(n) {
  form.value = { id: n.id, title: n.title || '', content: n.content || '', is_topBool: n.is_top === 1 }
  formError.value = ''
  formVisible.value = true
}

async function onSave() {
  if (!form.value.title.trim()) { formError.value = '公告标题不能为空'; return }
  saving.value = true
  formError.value = ''
  const payload = {
    group_id: currentGroupId.value,
    title: form.value.title.trim(),
    content: form.value.content,
    is_top: form.value.is_topBool ? 1 : 0
  }
  try {
    const res = form.value.id
      ? await updateNotice({ id: form.value.id, ...payload })
      : await createNotice(payload)
    if (res && res.success) {
      formVisible.value = false
      loadNotices()
      notifyUnreadChanged()
    } else {
      formError.value = (res && res.message) || '保存失败'
    }
  } catch (e) {
    formError.value = '网络错误，保存失败'
  } finally {
    saving.value = false
  }
}

function askRemove(n) {
  removeTarget.value = n
}

async function onRemove() {
  removing.value = true
  try {
    const res = await removeNotice(removeTarget.value.id)
    if (res && res.success) {
      removeTarget.value = null
      loadNotices()
      notifyUnreadChanged()
    } else {
      dialogAlert((res && res.message) || '删除失败')
    }
  } catch (e) {
    dialogAlert('网络错误，删除失败')
  } finally {
    removing.value = false
  }
}

watch(currentGroupId, () => { loadNotices() })

onMounted(() => {
  loadGroups()
  loadUserMap()
  loadNotices()
})
</script>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.page-title { font-size: 18px; font-weight: 600; color: #1f2329; margin: 0; }
.ph-right { display: flex; align-items: center; gap: 10px; }
.unread-badge {
  background: #ea4335; color: #fff; font-size: 12px;
  padding: 3px 10px; border-radius: 999px;
}

.empty-block {
  background: #fff; border: 1px solid #eceff3; border-radius: 12px;
  padding: 48px 20px; text-align: center; color: #8a9099; font-size: 14px;
}
.error-block {
  background: #fff; border: 1px solid #eceff3; border-radius: 12px;
  padding: 24px; text-align: center; color: #ea4335; font-size: 14px;
}

.notice-list { display: flex; flex-direction: column; gap: 12px; }
.notice-card {
  background: #fff; border: 1px solid #eceff3; border-radius: 12px;
  padding: 16px 18px; display: flex; justify-content: space-between; gap: 16px;
  box-shadow: 0 1px 3px rgba(16, 24, 40, 0.04); cursor: pointer; transition: box-shadow 0.15s;
}
.notice-card:hover { box-shadow: 0 4px 14px rgba(13, 128, 224, 0.12); }
.notice-card.top { border-left: 3px solid #0d80e0; }
.notice-card.unread { background: #f0f7ff; }
.nc-main { flex: 1; min-width: 0; }
.nc-title-row { display: flex; align-items: center; gap: 8px; }
.nc-title { font-size: 15px; font-weight: 600; color: #1f2329; }
.pin-tag {
  background: #e6f4ff; color: #0d80e0; font-size: 12px;
  padding: 2px 8px; border-radius: 6px; white-space: nowrap;
}
.dot-unread {
  width: 8px; height: 8px; border-radius: 50%; background: #ea4335; display: inline-block;
}
.nc-summary {
  margin: 8px 0 0; font-size: 13px; color: #4e5969; line-height: 1.6;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.nc-meta { margin-top: 10px; font-size: 12px; color: #8a9099; display: flex; gap: 16px; flex-wrap: wrap; }
.read-state { color: #19a558; }
.nc-actions { display: flex; flex-direction: column; gap: 8px; align-self: center; }

/* 按钮 */
.btn {
  height: 32px; padding: 0 14px; border-radius: 8px; font-size: 13px;
  cursor: pointer; border: 1px solid #dfe3e8; background: #fff; color: #1f2329;
}
.btn-primary {
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  border: none; color: #fff; font-weight: 600;
}
.btn-ghost { background: #fff; color: #4e5969; }
.btn-ghost:hover { border-color: #0d80e0; color: #0d80e0; }
.btn-danger { background: #fff; color: #ea4335; border-color: #f5c6c2; }
.btn-danger:hover { background: #ea4335; color: #fff; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* 弹窗 */
.modal-mask {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal-box {
  background: #fff; border-radius: 12px; padding: 24px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18); width: 420px;
}
.modal-box.modal-lg { width: 560px; max-width: 92vw; max-height: 86vh; overflow-y: auto; }
.modal-title { margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #1f2329; display: flex; align-items: center; gap: 8px; }
.modal-text { font-size: 15px; margin: 0 0 20px; color: #1f2329; }
.detail-meta { font-size: 12px; color: #8a9099; margin-bottom: 12px; }
.detail-body {
  font-size: 14px; color: #1f2329; line-height: 1.8;
  background: #f7f9fc; border-radius: 8px; padding: 14px; white-space: pre-wrap;
}
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }

.form-item { margin-bottom: 14px; }
.form-label { display: block; font-size: 13px; color: #4e5969; margin-bottom: 6px; }
.req { color: #ea4335; }
.form-input, .form-textarea {
  width: 100%; box-sizing: border-box; border: 1px solid #dfe3e8; border-radius: 8px;
  padding: 8px 10px; font-size: 13px; outline: none; color: #1f2329; background: #fff;
}
.form-input:focus, .form-textarea:focus { border-color: #0d80e0; }
.form-textarea { resize: vertical; font-family: inherit; }
.check-label { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #4e5969; cursor: pointer; }
.form-error { color: #ea4335; font-size: 13px; margin: 8px 0 0; }
</style>
