<template>
  <div class="page notes-page">
    <div class="page-head">
      <div>
        <h2 class="page-title">我的周报</h2>
        <p class="page-sub">每周一份科研工作周报，导师批阅；最近 {{ BACKFILL }} 周可补交</p>
      </div>
    </div>

    <div class="notes-body">
      <!-- 左：历史列表 -->
      <aside class="notes-list">
        <div class="notes-list-head">
          <span class="list-title">历史周报</span>
          <div class="head-actions">
            <button type="button" class="btn btn-sm" :disabled="!backfillWeeks.length" @click="onBackfill">补交</button>
            <button type="button" class="btn btn-primary btn-sm" @click="onStartThisWeek">本周</button>
          </div>
        </div>
        <div class="notes-cards">
          <div v-if="loading" class="empty">加载中…</div>
          <div v-else-if="!list.length" class="empty">还没有周报，点击「本周」开始第一篇</div>
          <template v-else>
            <div
              v-for="n in list"
              :key="n.id"
              class="note-card"
              :class="{ on: currentId === n.id }"
              @click="onPick(n)"
            >
              <div class="note-card-title">
                {{ weekLabel(n.week_key) }}
                <span v-if="Number(n.is_late) === 1" class="tag tag-orange">补交</span>
              </div>
              <div class="note-card-meta">
                <span class="st" :class="'st-' + n.status">{{ statusText(n.status) }}</span>
                <span class="time">{{ timeText(n.submitted_at || n.change_ts) }}</span>
              </div>
              <div class="note-card-summary">{{ summaryOf(n) }}</div>
            </div>
            <div v-if="totalPages > 1" class="pager">
              <button type="button" class="btn btn-sm" :disabled="page <= 1" @click="onPrevPage">上一页</button>
              <span>第 {{ page }} / {{ totalPages }} 页</span>
              <button type="button" class="btn btn-sm" :disabled="page >= totalPages" @click="onNextPage">下一页</button>
            </div>
          </template>
        </div>
      </aside>

      <!-- 右：周报编辑器 -->
      <section class="notes-editor">
        <div v-if="!currentNote" class="empty editor-empty">
          选择左侧周报查看，或点击「本周」开始书写
        </div>
        <div v-else class="editor">
          <div class="editor-head">
            <div class="editor-title-box">
              <div class="editor-week">{{ weekLabel(currentNote.week_key) }}</div>
              <span class="st st-lg" :class="'st-' + currentNote.status">{{ statusText(currentNote.status) }}</span>
            </div>
            <div class="editor-actions">
              <template v-if="canEdit">
                <button type="button" class="btn btn-primary btn-sm" :disabled="submitting" @click="onSubmit">
                  {{ submitting ? '提交中…' : '提交周报' }}
                </button>
              </template>
              <template v-else-if="canWithdraw">
                <button type="button" class="btn btn-sm" @click="onWithdraw">撤回提交</button>
              </template>
            </div>
          </div>

          <div class="editor-meta">
            <input v-model="draftTitle" class="input editor-title" maxlength="120" placeholder="周报主题" :disabled="!canEdit" />
            <span class="meta-item" v-if="currentNote.submitted_at">提交：{{ currentNote.submitted_at }}</span>
            <span v-if="saveState !== 'idle'" class="save-state" :class="saveState">
              {{ saveState === 'saving' ? '保存中…' : saveState === 'saved' ? '已保存' : saveErrorMsg || '保存失败' }}
            </span>
          </div>

          <!-- 批阅信息 -->
          <div v-if="currentNote.status === 'reviewed' || currentNote.status === 'returned'" class="review-box" :class="'rv-' + currentNote.status">
            <div class="review-head">
              <b>{{ currentNote.status === 'reviewed' ? '导师评语' : '打回理由' }}</b>
              <span v-if="currentNote.status === 'reviewed' && currentNote.review_score" class="score">评分：{{ currentNote.review_score }}/5</span>
              <span class="reviewer" v-if="currentNote.reviewed_at">导师：{{ currentNote.reviewed_at }}</span>
            </div>
            <div class="review-body">{{ currentNote.review_comment || '（无评语）' }}</div>
            <div v-if="currentNote.revoke_reason" class="revoke-note">批阅已撤回：{{ currentNote.revoke_reason }}</div>
          </div>

          <div class="editor-body">
            <div class="editor-tabs">
              <button type="button" :class="!preview ? 'on' : ''" @click="preview = false">编辑</button>
              <button type="button" :class="preview ? 'on' : ''" @click="preview = true">预览</button>
              <span class="word-count">{{ draftContent.length }} / 100000</span>
            </div>
            <textarea
              v-if="!preview"
              v-model="draftContent"
              class="editor-textarea"
              :disabled="!canEdit"
              placeholder="支持 Markdown 语法：## 标题、**加粗**、- 列表…"
            ></textarea>
            <div v-else class="editor-preview">
              <MarkdownPreview :content="draftContent" />
            </div>
          </div>

          <!-- 附件区 -->
          <div class="attach-box">
            <div class="attach-head">
              <span>附件</span>
              <span class="quota" v-if="quota">已用 {{ sizeText(quota.used) }} / 1GB（单文件 ≤ {{ sizeText(quota.maxFile) }}）</span>
              <label v-if="canEdit" class="btn btn-sm attach-btn">
                上传附件
                <input type="file" class="file-input" :accept="acceptExts" @change="onFileChange" />
              </label>
            </div>
            <div v-if="!attachments.length" class="attach-empty">暂无附件（可选，支持 PDF / Word / 图片）</div>
            <div v-else class="attach-list">
              <div v-for="a in attachments" :key="a.id" class="attach-item">
                <span class="attach-icon">📎</span>
                <span class="attach-name" :title="a.file_name">{{ a.file_name }}</span>
                <span class="attach-size">{{ sizeText(a.file_size) }}</span>
                <button type="button" class="btn btn-sm" @click="onDownload(a)">下载</button>
                <button v-if="canEdit" type="button" class="btn btn-sm btn-danger" @click="onDeleteAttach(a)">删除</button>
              </div>
            </div>
          </div>

          <div class="editor-foot">
            <span class="editor-updated">最后更新于 {{ currentNote.change_ts || '-' }}</span>
            <button v-if="saveState === 'error'" type="button" class="btn btn-sm" @click="saveNow">重试保存</button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount, onMounted } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import {
  reportMyWeek, reportCreate, reportSaveDraft, reportSubmit, reportWithdrawSubmit,
  reportListMine, reportGet, reportListAttachments, reportAddAttachment,
  reportDeleteAttachment, reportDownloadAttachment, reportAttachmentQuota
} from '../../api'
import { REPORT_BACKFILL_WEEKS, REPORT_STATUS_DRAFT, REPORT_STATUS_SUBMITTED, REPORT_STATUS_RETURNED, REPORT_STATUS_REVIEWED } from '../../config/constants'
import { dialogAlert, dialogConfirm, dialogPrompt } from '../../composables/useDialog'
import { useAutoRefresh } from '../../composables/useAutoRefresh'
import { refreshAfterWrite } from '../../composables/useGlobalRefresh'
import MarkdownPreview from '../../components/common/MarkdownPreview.vue'

const BACKFILL = REPORT_BACKFILL_WEEKS

// ===== 列表 =====
const page = ref(1)
const totalPages = ref(1)
const list = ref([])
const loading = ref(false)

// ===== 编辑器 =====
const currentNote = ref(null)
const currentId = computed(() => (currentNote.value ? currentNote.value.id : null))
const draftTitle = ref('')
const draftContent = ref('')
const preview = ref(false)
const saveState = ref('idle')
const saveErrorMsg = ref('')
const submitting = ref(false)
const attachments = ref([])
const quota = ref(null)

let saveTimer = null
let savingNow = false
let syncing = false
let dirty = false

// 可编辑：draft / returned
const canEdit = computed(() => {
  const s = currentNote.value && currentNote.value.status
  return s === REPORT_STATUS_DRAFT || s === REPORT_STATUS_RETURNED
})
// 可撤回提交：submitted 且 1h 窗口内（服务端兜底校验）
const canWithdraw = computed(() => {
  if (!currentNote.value || currentNote.value.status !== REPORT_STATUS_SUBMITTED) return false
  const t = new Date(String(currentNote.value.submitted_at).replace(/-/g, '/'))
  if (Number.isNaN(t.getTime())) return false
  return Date.now() - t.getTime() <= 60 * 60 * 1000
})

// 可补交的周（本周 + 最近 N 周，无记录的）
const backfillWeeks = computed(() => {
  const keys = []
  for (let i = 0; i <= BACKFILL; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i * 7)
    keys.push(isoWeekKey(d))
  }
  const existing = new Set(list.value.map((r) => r.week_key))
  return keys.filter((k) => !existing.has(k))
})

// 附件可接受扩展名（同共享常量）
const acceptExts = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.gif', '.webp'].join(',')

function isoWeekKey(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayNum = d.getDay() || 7
  d.setDate(d.getDate() + 4 - dayNum)
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
  return `${d.getFullYear()}-${String(week).padStart(2, '0')}`
}

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
function timeText(ts) {
  return ts ? String(ts).slice(5, 16) : ''
}
function summaryOf(n) {
  const s = String(n.summary || '')
    .replace(/[#*`>\[\]!-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return s || '（无内容）'
}
function sizeText(bytes) {
  const b = Number(bytes) || 0
  if (b >= 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + 'MB'
  if (b >= 1024) return (b / 1024).toFixed(1) + 'KB'
  return b + 'B'
}

// ===== 加载 =====
async function load() {
  loading.value = true
  try {
    const res = await reportListMine(page.value)
    const d = res && res.data
    if (res && res.success && d) {
      list.value = d.list || []
      totalPages.value = d.totalPages || 1
      page.value = d.page || 1
    }
  } catch (e) {
    list.value = []
  } finally {
    loading.value = false
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

async function loadAttachments(reportId) {
  try {
    const res = await reportListAttachments(reportId)
    if (res && res.success) {
      attachments.value = (res.data && res.data.list) || []
      quota.value = (res.data && res.data.quota) || null
    }
  } catch (e) {
    attachments.value = []
  }
}

async function openNoteById(id) {
  try {
    const res = await reportGet(id)
    if (!res || !res.success || !res.data) return
    currentNote.value = res.data
    syncing = true
    draftTitle.value = res.data.title || ''
    draftContent.value = res.data.content || ''
    preview.value = false
    saveState.value = 'saved'
    saveErrorMsg.value = ''
    dirty = false
    syncing = false
    loadAttachments(id)
  } catch (e) {
    currentNote.value = null
  }
}

function onPick(n) {
  openNoteById(n.id)
}

// 本周：已有则打开，无则创建
async function onStartThisWeek() {
  try {
    const res = await reportMyWeek()
    if (res && res.success && res.data) {
      openNoteById(res.data.id)
      return
    }
    const created = await reportCreate()
    if (created && created.success && created.data) {
      page.value = 1
      await load()
      openNoteById(created.data.id)
    } else {
      dialogAlert((created && created.message) || '创建失败，请重试')
    }
  } catch (e) {
    dialogAlert('创建失败，请重试')
  }
}

// 补交：选择可补交周创建草稿
async function onBackfill() {
  const keys = backfillWeeks.value
  if (!keys.length) {
    dialogAlert('最近 ' + BACKFILL + ' 周没有可补交的周次')
    return
  }
  const options = keys
    .map((k) => weekLabel(k))
    .map((label, i) => `${i + 1}. ${label}`)
    .join('\n')
  const answer = await dialogPrompt(`可选补交周次（输入序号）：\n${options}`, '', '补交周报')
  if (answer === null) return
  const idx = parseInt(String(answer).trim(), 10) - 1
  if (!Number.isInteger(idx) || idx < 0 || idx >= keys.length) {
    dialogAlert('序号不正确')
    return
  }
  const created = await reportCreate(keys[idx])
  if (created && created.success && created.data) {
    page.value = 1
    await load()
    openNoteById(created.data.id)
  } else {
    dialogAlert((created && created.message) || '创建失败，请重试')
  }
}

// ===== 自动保存 =====
watch([draftTitle, draftContent], () => {
  if (syncing || !currentNote.value || !canEdit.value) return
  dirty = true
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(saveNow, 1000)
})

async function saveNow() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (!currentNote.value || !canEdit.value || savingNow) return
  if (!String(draftTitle.value).trim()) {
    saveState.value = 'error'
    saveErrorMsg.value = '请输入周报主题'
    dirty = true
    return
  }
  savingNow = true
  saveState.value = 'saving'
  try {
    const res = await reportSaveDraft(currentNote.value.id, {
      title: draftTitle.value,
      content: draftContent.value,
      version: currentNote.value.version
    })
    if (res && res.success && res.data) {
      currentNote.value = res.data
      saveState.value = 'saved'
      saveErrorMsg.value = ''
      dirty = false
    } else {
      saveState.value = 'error'
      saveErrorMsg.value = (res && res.message) || '保存失败'
      dirty = true
    }
  } catch (e) {
    saveState.value = 'error'
    saveErrorMsg.value = '保存失败，请重试'
    dirty = true
  } finally {
    savingNow = false
  }
}

// 提交：先保存当前修改再提交
async function onSubmit() {
  if (!currentNote.value || !canEdit.value) return
  if (dirty || saveState.value === 'error') {
    await saveNow()
    if (saveState.value === 'error') return
  }
  const ok = await dialogConfirm('提交后不可再修改（1 小时内可撤回），确定提交吗？', '提交周报')
  if (!ok) return
  submitting.value = true
  try {
    const res = await reportSubmit(currentNote.value.id, { version: currentNote.value.version })
    if (res && res.success && res.data) {
      currentNote.value = res.data
      saveState.value = 'saved'
      dirty = false
      await load()
      await refreshAfterWrite('已提交，等待导师批阅')
    } else {
      dialogAlert((res && res.message) || '提交失败，请重试')
    }
  } catch (e) {
    dialogAlert('提交失败，请重试')
  } finally {
    submitting.value = false
  }
}

// 撤回提交（1h 窗口内）
async function onWithdraw() {
  const ok = await dialogConfirm('撤回后周报回到草稿状态，可修改后重新提交。确定撤回吗？', '撤回提交')
  if (!ok) return
  const res = await reportWithdrawSubmit(currentNote.value.id, { version: currentNote.value.version })
  if (res && res.success && res.data) {
    currentNote.value = res.data
    saveState.value = 'saved'
    dirty = false
    await load()
    await refreshAfterWrite('已撤回提交')
  } else {
    dialogAlert((res && res.message) || '撤回失败，请重试')
  }
}

// ===== 附件 =====
async function onFileChange(e) {
  const file = e.target && e.target.files && e.target.files[0]
  e.target.value = ''
  if (!file) return
  if (file.size > 50 * 1024 * 1024) {
    dialogAlert('单文件不能超过 50MB')
    return
  }
  try {
    const data = await file.arrayBuffer()
    const res = await reportAddAttachment({
      reportId: currentNote.value.id,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      data
    })
    if (res && res.success) {
      loadAttachments(currentNote.value.id)
    } else {
      dialogAlert((res && res.message) || '上传失败，请重试')
    }
  } catch (err) {
    dialogAlert('上传失败，请重试')
  }
}

async function onDownload(a) {
  try {
    await reportDownloadAttachment(a.id)
  } catch (e) {
    // 取消/失败不额外提示
  }
}

async function onDeleteAttach(a) {
  const ok = await dialogConfirm(`确定删除附件「${a.file_name}」吗？`, '删除附件')
  if (!ok) return
  const res = await reportDeleteAttachment(a.id)
  if (res && res.success) {
    loadAttachments(currentNote.value.id)
  } else {
    dialogAlert((res && res.message) || '删除失败，请重试')
  }
}

// 离开页面前：未保存修改需确认
onBeforeRouteLeave(async () => {
  if (!dirty || !currentNote.value) return true
  const ok = await dialogConfirm('周报有未保存的修改，确定离开吗？', '未保存的修改')
  return !!ok
})

onMounted(() => {
  load()
  onStartThisWeek()
})
// 数据变动（本页写操作或外部改动）后后台静默重拉，保持周报列表最新
useAutoRefresh(load)

onBeforeUnmount(() => {
  if (saveTimer) clearTimeout(saveTimer)
})
</script>

<style scoped>
.notes-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.notes-body {
  flex: 1 1 auto;
  display: flex;
  gap: 14px;
  min-height: 0;
  margin-top: 4px;
}

/* 左栏 */
.notes-list {
  flex: 0 0 300px;
  max-width: 300px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  overflow: hidden;
}
.notes-list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-light);
}
.list-title {
  font-weight: 600;
  color: var(--text);
  font-size: 14px;
}
.head-actions {
  display: flex;
  gap: 6px;
}
.notes-cards {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.note-card {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.note-card:hover {
  border-color: var(--primary);
}
.note-card.on {
  border-color: var(--primary);
  background: var(--primary-soft);
}
.note-card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.note-card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--muted);
}
.note-card-summary {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-2);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.notes-cards .pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding-top: 4px;
  font-size: 12px;
  color: var(--text-2);
}

/* 状态徽标 */
.st {
  display: inline-block;
  padding: 0 8px;
  border-radius: var(--radius-full);
  font-size: 12px;
  line-height: 20px;
}
.st-draft { background: var(--bg-hover); color: var(--text-2); }
.st-submitted { background: var(--primary-soft); color: var(--primary); }
.st-returned { background: var(--danger-soft); color: var(--danger); }
.st-reviewed { background: var(--success-soft); color: var(--success); }
.st-lg { font-size: 13px; line-height: 22px; }

/* 右栏 */
.notes-editor {
  flex: 1 1 auto;
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.editor-empty {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
}
.editor {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.editor-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-light);
}
.editor-title-box {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.editor-week {
  font-weight: 700;
  color: var(--text);
  font-size: 15px;
  white-space: nowrap;
}
.editor-actions {
  display: flex;
  gap: 8px;
  flex: 0 0 auto;
}
.editor-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--border-light);
  font-size: 12px;
  color: var(--muted);
  flex-wrap: wrap;
}
.editor-title {
  flex: 1 1 240px;
  min-width: 0;
}
.meta-item {
  white-space: nowrap;
}
.save-state { margin-left: auto; white-space: nowrap; }
.save-state.saving { color: var(--text-2); }
.save-state.saved { color: var(--success); }
.save-state.error { color: var(--danger); }

/* 批阅信息 */
.review-box {
  margin: 10px 14px 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  font-size: 13px;
}
.rv-reviewed { border-left: 3px solid var(--success); }
.rv-returned { border-left: 3px solid var(--danger); }
.review-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.review-head .score { color: var(--success); font-weight: 600; }
.review-head .reviewer { color: var(--muted); font-size: 12px; margin-left: auto; }
.review-body {
  margin-top: 6px;
  color: var(--text-2);
  white-space: pre-wrap;
  word-break: break-word;
}
.revoke-note {
  margin-top: 6px;
  font-size: 12px;
  color: var(--danger);
}

/* 编辑主体 */
.editor-body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.editor-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 14px 0;
}
.editor-tabs button {
  padding: 4px 12px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-2);
  font-size: 13px;
  cursor: pointer;
}
.editor-tabs button.on {
  background: var(--primary-soft);
  color: var(--primary);
  font-weight: 600;
}
.word-count {
  margin-left: auto;
  font-size: 12px;
  color: var(--muted);
  padding-right: 6px;
}
.editor-textarea {
  flex: 1 1 auto;
  min-height: 0;
  margin: 10px 14px 0;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  color: var(--text);
  font-size: 14px;
  line-height: 1.7;
  resize: none;
  outline: none;
  font-family: inherit;
}
.editor-textarea:focus { border-color: var(--primary); }
.editor-textarea:disabled { background: var(--bg-hover); color: var(--text-2); cursor: not-allowed; }
.editor-preview {
  flex: 1 1 auto;
  min-height: 0;
  margin: 10px 14px 0;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow-y: auto;
}

/* 附件区 */
.attach-box {
  margin: 10px 14px 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 8px 12px;
  max-height: 200px;
  overflow-y: auto;
}
.attach-head {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}
.attach-head .quota { font-weight: 400; font-size: 12px; color: var(--muted); }
.attach-btn { margin-left: auto; cursor: pointer; }
.file-input { display: none; }
.attach-empty {
  font-size: 12px;
  color: var(--muted);
  padding: 8px 0 2px;
}
.attach-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 6px;
}
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
.attach-size { color: var(--muted); flex: 0 0 auto; }

.editor-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  font-size: 12px;
  color: var(--muted);
}
.editor-updated { flex: 1 1 auto; }

@media (max-width: 860px) {
  .notes-body { flex-direction: column; }
  .notes-list { flex: 0 0 300px; max-width: none; }
}
</style>
