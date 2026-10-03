<template>
  <div class="page mentor-report">
    <div class="page-head">
      <div>
        <h2 class="page-title">周报批阅</h2>
        <p class="page-sub">批阅名下学生的周报；补交周报置顶显示，批阅 24 小时内可撤回</p>
      </div>
    </div>

    <!-- 统计卡 -->
    <div class="stat-row">
      <div class="stat-card">
        <span class="stat-num">{{ statsData.submitted ?? '-' }}</span>
        <span class="stat-label">本周已提交</span>
      </div>
      <div class="stat-card">
        <span class="stat-num">{{ statsData.reviewed ?? '-' }}</span>
        <span class="stat-label">本周已批阅</span>
      </div>
      <div class="stat-card">
        <span class="stat-num">{{ statsData.submitRate ?? '-' }}<i v-if="statsData.submitRate !== null">%</i></span>
        <span class="stat-label">本周提交率</span>
      </div>
      <div class="stat-card">
        <span class="stat-num">{{ statsData.avgScore ?? '-' }}</span>
        <span class="stat-label">平均评分</span>
      </div>
      <div class="stat-card stat-wide">
        <span class="stat-label" style="font-weight: 600">未交学生</span>
        <span class="stat-sub">{{ missedText }}</span>
      </div>
    </div>

    <div class="report-body">
      <!-- 左：列表 -->
      <aside class="report-list">
        <div class="list-tabs">
          <button type="button" :class="tab === 'todo' ? 'on' : ''" @click="switchTab('todo')">
            待批阅<span v-if="todoCount">（{{ todoCount }}）</span>
          </button>
          <button type="button" :class="tab === 'done' ? 'on' : ''" @click="switchTab('done')">已批阅</button>
        </div>
        <div class="list-cards">
          <div v-if="loading" class="empty">加载中…</div>
          <div v-else-if="!list.length" class="empty">{{ tab === 'todo' ? '暂无待批阅的周报' : '暂无已批阅周报' }}</div>
          <template v-else>
            <div
              v-for="n in list"
              :key="n.id"
              class="item-card"
              :class="{ on: currentId === n.id }"
              @click="onPick(n)"
            >
              <div class="item-title">
                {{ n.student_name || '学生' }}
                <span class="tag tag-orange" v-if="Number(n.is_late) === 1">补交</span>
                <span class="st" :class="'st-' + n.status">{{ statusText(n.status) }}</span>
              </div>
              <div class="item-week">{{ weekLabel(n.week_key) }}</div>
              <div class="item-meta">提交于 {{ n.submitted_at || '-' }}</div>
            </div>
            <div v-if="totalPages > 1" class="pager">
              <button type="button" class="btn btn-sm" :disabled="page <= 1" @click="onPrevPage">上一页</button>
              <span>第 {{ page }} / {{ totalPages }} 页</span>
              <button type="button" class="btn btn-sm" :disabled="page >= totalPages" @click="onNextPage">下一页</button>
            </div>
          </template>
        </div>
      </aside>

      <!-- 右：详情/批阅 -->
      <section class="report-detail">
        <div v-if="!currentNote" class="empty detail-empty">选择左侧周报查看详情并批阅</div>
        <div v-else class="detail">
          <div class="detail-head">
            <div class="detail-user">
              <span class="detail-name">{{ currentNote.student_name || '学生' }}</span>
              <span class="detail-week">{{ weekLabel(currentNote.week_key) }}</span>
              <span v-if="Number(currentNote.is_late) === 1" class="tag tag-orange">补交</span>
              <span class="st" :class="'st-' + currentNote.status">{{ statusText(currentNote.status) }}</span>
            </div>
            <div class="detail-meta">
              提交于 {{ currentNote.submitted_at || '-' }}
              <span v-if="currentNote.reviewed_at">｜批阅于 {{ currentNote.reviewed_at }}</span>
            </div>
          </div>

          <div class="detail-title">{{ currentNote.title || '（无主题）' }}</div>

          <div class="detail-content">
            <MarkdownPreview :content="currentNote.content || '（无内容）'" />
          </div>

          <!-- 附件 -->
          <div class="detail-attach">
            <div class="attach-label">附件（{{ attachments.length }}）</div>
            <div v-if="!attachments.length" class="attach-empty">无附件</div>
            <div v-else class="attach-list">
              <div v-for="a in attachments" :key="a.id" class="attach-item">
                <span class="attach-icon">📎</span>
                <span class="attach-name" :title="a.file_name">{{ a.file_name }}</span>
                <span class="attach-size">{{ sizeText(a.file_size) }}</span>
                <button type="button" class="btn btn-sm" @click="onDownload(a)">下载</button>
              </div>
            </div>
          </div>

          <!-- 批阅区 -->
          <div v-if="currentNote.status === 'submitted'" class="review-form">
            <div class="review-form-title">批阅</div>
            <div class="score-row">
              <span class="score-label">评分（通过时可选）</span>
              <div class="score-options">
                <button
                  v-for="s in [1, 2, 3, 4, 5]"
                  :key="s"
                  type="button"
                  class="score-btn"
                  :class="{ on: score === s }"
                  @click="score = score === s ? null : s"
                >{{ s }}</button>
              </div>
            </div>
            <textarea
              v-model="comment"
              class="comment-input"
              maxlength="5000"
              :placeholder="action === 'return' ? '请输入打回理由（必填）' : '请输入评语（必填）'"
            ></textarea>
            <div class="form-actions">
              <button type="button" class="btn btn-primary" :disabled="reviewing" @click="onReview('approve')">
                {{ reviewing ? '提交中…' : '通过' }}
              </button>
              <button type="button" class="btn btn-danger" :disabled="reviewing" @click="onReview('return')">
                打回
              </button>
            </div>
          </div>

          <!-- 已批阅信息 -->
          <div v-else-if="currentNote.status === 'reviewed'" class="reviewed-box">
            <div class="reviewed-head">
              <b>批阅结果</b>
              <span v-if="currentNote.review_score" class="score">评分 {{ currentNote.review_score }}/5</span>
              <span class="by">批阅人：{{ currentNote.reviewed_by_name || '导师' }}</span>
            </div>
            <div class="reviewed-comment">{{ currentNote.review_comment || '（无评语）' }}</div>
            <button
              v-if="canUnreview"
              type="button"
              class="btn btn-sm"
              @click="onUnreview"
            >撤回批阅（24h 内）</button>
          </div>

          <div v-else-if="currentNote.status === 'returned'" class="reviewed-box rv-returned">
            <div class="reviewed-head"><b>打回理由</b></div>
            <div class="reviewed-comment">{{ currentNote.review_comment || '（无理由）' }}</div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  reportStats, reportListToReview, reportGet, reportReview, reportUnreview,
  reportListGroup, reportListAttachments, reportDownloadAttachment
} from '../../api'
import { REPORT_STATUS_DRAFT, REPORT_STATUS_SUBMITTED, REPORT_STATUS_RETURNED, REPORT_STATUS_REVIEWED } from '../../config/constants'
import { dialogAlert, dialogConfirm, dialogPrompt } from '../../composables/useDialog'
import { useSession } from '../../composables/useSession'
import MarkdownPreview from '../../components/MarkdownPreview.vue'

const tab = ref('todo')
const page = ref(1)
const totalPages = ref(1)
const list = ref([])
const loading = ref(false)
const todoCount = ref(0)

const currentNote = ref(null)
const currentId = computed(() => (currentNote.value ? currentNote.value.id : null))
const attachments = ref([])

const score = ref(null)
const comment = ref('')
const action = ref('approve')
const reviewing = ref(false)

const statsData = ref({})

function weekLabel(key) {
  const m = /^(\d{4})-(\d{1,2})$/.exec(key || '')
  if (!m) return key
  const year = Number(m[1])
  const week = Number(m[2])
  const jan4 = new Date(year, 0, 4)
  const day = jan4.getDay() || 7
  const firstMonday = new Date(year, 0, 4 - (day - 1))
  firstMonday.setHours(0, 0, 0, 0)
  const monday = new Date(firstMonday.getTime() + (week - 1) * 7 * 86400000)
  const sunday = new Date(monday.getTime() + 6 * 86400000)
  const fmt = (x) => `${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  return `${year}年第${week}周（${fmt(monday)}~${fmt(sunday)}）`
}

const STATUS_TEXT = {
  [REPORT_STATUS_DRAFT]: '草稿',
  [REPORT_STATUS_SUBMITTED]: '待批阅',
  [REPORT_STATUS_RETURNED]: '已打回',
  [REPORT_STATUS_REVIEWED]: '已批阅'
}
function statusText(s) {
  return STATUS_TEXT[s] || s
}
function sizeText(bytes) {
  const b = Number(bytes) || 0
  if (b >= 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + 'MB'
  if (b >= 1024) return (b / 1024).toFixed(1) + 'KB'
  return b + 'B'
}

const missedText = computed(() => {
  const list2 = statsData.value.missedList || []
  if (!list2.length) return '本周全员已提交'
  return list2.slice(0, 5).map((s) => s.realName || s.username).join('、') + (list2.length > 5 ? ` 等 ${list2.length} 人` : '')
})

// 已批且是自己批的，24h 内可撤回
const canUnreview = computed(() => {
  const n = currentNote.value
  if (!n || n.status !== REPORT_STATUS_REVIEWED || !n.reviewed_by) return false
  if (Number(n.reviewed_by) !== Number(meId.value)) return false
  const t = new Date(String(n.reviewed_at).replace(/-/g, '/'))
  if (Number.isNaN(t.getTime())) return false
  return Date.now() - t.getTime() <= 24 * 60 * 60 * 1000
})

const meId = ref(null)

async function loadStats() {
  try {
    const res = await reportStats({})
    if (res && res.success) statsData.value = res.data || {}
  } catch (e) {
    statsData.value = {}
  }
}

async function load() {
  loading.value = true
  try {
    const params = { page: page.value }
    const res = tab.value === 'todo'
      ? await reportListToReview(page.value)
      : await reportListGroup({ status: 'reviewed', page: page.value })
    const d = res && res.data
    if (res && res.success && d) {
      list.value = d.list || []
      totalPages.value = d.totalPages || 1
      page.value = d.page || 1
      if (tab.value === 'todo') {
        todoCount.value = d.total || 0
      }
    } else {
      list.value = []
    }
  } catch (e) {
    list.value = []
  } finally {
    loading.value = false
  }
}

function switchTab(t) {
  if (tab.value === t) return
  tab.value = t
  page.value = 1
  currentNote.value = null
  attachments.value = []
  score.value = null
  comment.value = ''
  load()
}

async function loadAttachments(id) {
  try {
    const res = await reportListAttachments(id)
    if (res && res.success) attachments.value = (res.data && res.data.list) || []
  } catch (e) {
    attachments.value = []
  }
}

async function onPick(n) {
  try {
    const res = await reportGet(n.id)
    if (!res || !res.success || !res.data) return
    currentNote.value = res.data
    score.value = null
    comment.value = ''
    action.value = 'approve'
    loadAttachments(n.id)
  } catch (e) {
    dialogAlert('加载周报失败')
  }
}

function onPrevPage() {
  if (page.value <= 1) return
  page.value--
  load()
}
function onNextPage() {
  if (page.value >= totalPages.value) return
  page.value++
  load()
}

async function onReview(act) {
  action.value = act
  const c = String(comment.value || '').trim()
  if (!c) {
    dialogAlert(act === 'return' ? '打回必须填写打回理由' : '请填写评语')
    return
  }
  const ok = await dialogConfirm(
    act === 'approve' ? '确认通过该周报？' : '确认打回？学生将收到打回理由并可修改后重新提交。',
    act === 'approve' ? '通过周报' : '打回周报'
  )
  if (!ok) return
  reviewing.value = true
  try {
    const res = await reportReview(currentNote.value.id, {
      action: act,
      comment: c,
      score: act === 'approve' ? score.value : null,
      version: currentNote.value.version
    })
    if (res && res.success && res.data) {
      currentNote.value = res.data
      comment.value = ''
      score.value = null
      await load()
      await loadStats()
      dialogAlert(act === 'approve' ? '已通过' : '已打回')
    } else {
      dialogAlert((res && res.message) || '操作失败，请重试')
    }
  } catch (e) {
    dialogAlert('操作失败，请重试')
  } finally {
    reviewing.value = false
  }
}

async function onUnreview() {
  const reason = await dialogPrompt('请输入撤回理由（学生将收到通知）：', '', '撤回批阅')
  if (reason === null) return
  if (!String(reason).trim()) {
    dialogAlert('撤回理由必填')
    return
  }
  const res = await reportUnreview(currentNote.value.id, { reason, version: currentNote.value.version })
  if (res && res.success && res.data) {
    currentNote.value = res.data
    await load()
    await loadStats()
    dialogAlert('已撤回批阅')
  } else {
    dialogAlert((res && res.message) || '撤回失败，请重试')
  }
}

async function onDownload(a) {
  try {
    const res = await reportDownloadAttachment(a.id)
    if (res && res.success) {
      dialogAlert(`附件已保存：${a.file_name}`)
    } else if (!(res && res.canceled)) {
      dialogAlert((res && res.message) || '下载失败，请重试')
    }
  } catch (e) {
    dialogAlert('下载失败，请重试')
  }
}

onMounted(() => {
  const user = useSession().getSessionUser()
  meId.value = user ? Number(user.id) : null
  loadStats()
  load()
})
</script>

<style scoped>
.mentor-report {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* 统计行 */
.stat-row {
  display: flex;
  gap: 10px;
  margin-top: 2px;
  flex-wrap: wrap;
}
.stat-card {
  flex: 1 1 120px;
  max-width: 180px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-num {
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
}
.stat-label {
  font-size: 12px;
  color: var(--muted);
}
.stat-sub {
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.stat-wide {
  flex: 1 1 220px;
  max-width: 300px;
}

/* 主体 */
.report-body {
  flex: 1 1 auto;
  display: flex;
  gap: 14px;
  min-height: 0;
  margin-top: 10px;
}
.report-list {
  flex: 0 0 300px;
  max-width: 300px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  overflow: hidden;
}
.list-tabs {
  display: flex;
  padding: 8px 10px 0;
  gap: 4px;
}
.list-tabs button {
  flex: 1;
  padding: 6px 0;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--text-2);
  font-size: 13px;
  cursor: pointer;
}
.list-tabs button.on {
  color: var(--primary);
  border-bottom-color: var(--primary);
  font-weight: 600;
}
.list-cards {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.item-card {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
}
.item-card:hover { border-color: var(--primary); }
.item-card.on {
  border-color: var(--primary);
  background: var(--primary-soft);
}
.item-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  flex-wrap: wrap;
}
.item-week {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-2);
}
.item-meta {
  margin-top: 2px;
  font-size: 12px;
  color: var(--muted);
}

/* 详情 */
.report-detail {
  flex: 1 1 auto;
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.detail-empty {
  flex: 1 1 auto;
  margin: 0;
}
.detail {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 14px;
}
.detail > * {
  width: 100%;
  box-sizing: border-box;
}
.detail > * + * {
  margin-top: 12px;
}
.detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.detail-user {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.detail-name { font-size: 16px; font-weight: 700; color: var(--text); }
.detail-week { font-size: 13px; color: var(--text-2); }
.detail-meta { font-size: 12px; color: var(--muted); }
.detail-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  padding: 8px 10px;
  background: var(--bg-hover);
  border-radius: var(--radius-md);
}
.detail-content {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  min-height: 120px;
}

/* 附件 */
.detail-attach {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 8px 12px;
}
.attach-label { font-size: 13px; font-weight: 600; color: var(--text); }
.attach-empty { font-size: 12px; color: var(--muted); padding: 6px 0 2px; }
.attach-list { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
.attach-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.attach-icon { color: var(--text-2); }
.attach-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
}
.attach-size { color: var(--muted); }

/* 批阅表单 */
.review-form {
  border: 1px solid var(--primary);
  border-radius: var(--radius-md);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.review-form-title { font-size: 14px; font-weight: 700; color: var(--text); }
.score-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.score-label { font-size: 12px; color: var(--text-2); }
.score-options { display: flex; gap: 6px; }
.score-btn {
  width: 32px;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  background: var(--bg-card);
  color: var(--text-2);
  cursor: pointer;
  font-size: 13px;
}
.score-btn.on {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}
.comment-input {
  min-height: 80px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 8px 10px;
  font-size: 13px;
  line-height: 1.6;
  resize: vertical;
  background: var(--bg-card);
  color: var(--text);
  font-family: inherit;
}
.form-actions {
  display: flex;
  gap: 10px;
}

/* 已批信息 */
.reviewed-box {
  border: 1px solid var(--border);
  border-left: 3px solid var(--success);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  font-size: 13px;
}
.reviewed-box.rv-returned { border-left-color: var(--danger); }
.reviewed-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.reviewed-head .score { color: var(--success); font-weight: 600; }
.reviewed-head .by { color: var(--muted); font-size: 12px; margin-left: auto; }
.reviewed-comment {
  margin: 6px 0;
  color: var(--text-2);
  white-space: pre-wrap;
  word-break: break-word;
}

.st {
  display: inline-block;
  padding: 0 8px;
  border-radius: var(--radius-full);
  font-size: 12px;
  line-height: 20px;
}
.st-submitted { background: var(--primary-soft); color: var(--primary); }
.st-returned { background: var(--danger-soft); color: var(--danger); }
.st-reviewed { background: var(--success-soft); color: var(--success); }

@media (max-width: 860px) {
  .report-body { flex-direction: column; }
  .report-list { flex: 0 0 260px; max-width: none; }
}
</style>
