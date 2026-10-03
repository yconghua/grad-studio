<template>
  <div class="page notes-page">
    <div class="page-head">
      <div>
        <h2 class="page-title">我的笔记</h2>
        <p class="page-sub">学生私人科研草稿本：默认仅自己可见</p>
      </div>
    </div>

    <div class="notes-body">
      <!-- 左：笔记列表 -->
      <aside class="notes-list">
        <div class="notes-list-head">
          <div class="tabs">
            <button type="button" :class="tab === 'active' ? 'on' : ''" @click="switchTab('active')">全部</button>
            <button type="button" :class="tab === 'deleted' ? 'on' : ''" @click="switchTab('deleted')">回收站</button>
          </div>
          <button type="button" class="btn btn-primary btn-sm" @click="onCreate">新建</button>
        </div>
        <div class="notes-filter">
          <select v-model="categoryFilter" class="select" @change="onFilterChange">
            <option value="">全部类别</option>
            <option v-for="c in NOTE_CATEGORIES" :key="c.value" :value="c.value">{{ c.label }}</option>
          </select>
        </div>

        <div class="notes-cards">
          <div v-if="loading" class="empty">加载中…</div>
          <div v-else-if="!list.length" class="empty">
            {{ tab === 'deleted' ? '回收站是空的' : '还没有笔记，点击「新建」开始' }}
          </div>
          <template v-else>
            <div
              v-for="n in list"
              :key="n.id"
              class="note-card"
              :class="{ on: currentId === n.id, trash: tab === 'deleted' }"
              @click="onPick(n)"
            >
              <div class="note-card-title">{{ n.title || '无标题笔记' }}</div>
              <div class="note-card-meta">
                <span class="cat">{{ categoryLabel(n.category) }}</span>
                <span class="time">{{ timeText(n.updated_at) }}</span>
              </div>
              <div class="note-card-summary">{{ summaryOf(n) }}</div>
              <div v-if="tab === 'deleted'" class="note-card-actions">
                <button type="button" class="btn btn-sm" @click.stop="onRestore(n)">恢复</button>
                <button type="button" class="btn btn-sm btn-danger" @click.stop="onPurge(n)">彻底删除</button>
              </div>
            </div>
            <div v-if="totalPages > 1" class="pager">
              <button type="button" class="btn btn-sm" :disabled="page <= 1" @click="page--; load()">上一页</button>
              <span>第 {{ page }} / {{ totalPages }} 页</span>
              <button type="button" class="btn btn-sm" :disabled="page >= totalPages" @click="page++; load()">下一页</button>
            </div>
          </template>
        </div>
      </aside>

      <!-- 右：编辑器 -->
      <section class="notes-editor">
        <div v-if="!currentNote" class="empty editor-empty">
          {{ tab === 'deleted' ? '回收站笔记仅支持恢复或彻底删除' : '选择左侧笔记开始编辑' }}
        </div>
        <div v-else class="editor">
          <div class="editor-head">
            <input v-model="draftTitle" class="input editor-title" maxlength="120" placeholder="笔记主题" />
            <div class="editor-actions">
              <button type="button" class="btn btn-sm" :disabled="exporting" @click="onExport">
                {{ exporting ? '导出中…' : '导出' }}
              </button>
              <button v-if="tab === 'active'" type="button" class="btn btn-sm btn-danger" @click="onDelete">删除</button>
            </div>
          </div>
          <div class="editor-meta">
            <select v-model="draftCategory" class="select editor-category">
              <option v-for="c in NOTE_CATEGORIES" :key="c.value" :value="c.value">{{ c.label }}</option>
            </select>
            <span class="editor-created">创建时间：{{ currentNote.created_at || '-' }}</span>
            <span v-if="saveState !== 'idle'" class="save-state" :class="saveState">
              {{ saveState === 'saving' ? '保存中…' : saveState === 'saved' ? '已保存' : saveErrorMsg || '保存失败' }}
            </span>
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
              placeholder="支持 Markdown 语法：## 标题、**加粗**、- 列表、> 引用、`代码`…"
            ></textarea>
            <div v-else class="editor-preview">
              <MarkdownPreview :content="draftContent" />
            </div>
          </div>
          <div class="editor-foot">
            <span class="editor-updated">最后更新于 {{ currentNote.updated_at || '-' }}</span>
            <button v-if="saveState === 'error'" type="button" class="btn btn-sm" @click="saveNow">重试保存</button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { listNotes, getNote, createNote, updateNote, deleteNote, restoreNote, purgeNote, exportNote } from '../../api'
import { NOTE_CATEGORIES } from '../../config/constants'
import { dialogAlert, dialogConfirm, dialogPrompt } from '../../composables/useDialog'
import MarkdownPreview from '../../components/MarkdownPreview.vue'

// ===== 列表 =====
const tab = ref('active') // active 全部 / deleted 回收站
const categoryFilter = ref('')
const page = ref(1)
const totalPages = ref(1)
const list = ref([])
const loading = ref(false)

// ===== 编辑器 =====
const currentNote = ref(null) // 当前打开的服务端最新记录（含 version）
const currentId = computed(() => (currentNote.value ? currentNote.value.id : null))
const draftTitle = ref('')
const draftCategory = ref('other')
const draftContent = ref('')
const preview = ref(false) // false 编辑 / true 预览
const saveState = ref('idle') // idle 未编辑 / saving 保存中 / saved 已保存 / error 保存失败
const saveErrorMsg = ref('')
const exporting = ref(false)

// 防抖定时器 + 自动保存进行中标志（防止并发提交）
let saveTimer = null
let savingNow = false
// 打开笔记 / 新建后同步草稿时跳过自动保存触发
let syncing = false
// 存在未保存修改（离开页面提示用）
let dirty = false

function categoryLabel(value) {
  const item = NOTE_CATEGORIES.find((c) => c.value === value)
  return item ? item.label : value
}

// 列表更新时间：'YYYY-MM-DD HH:mm:ss' → 'MM-DD HH:mm'
function timeText(ts) {
  return ts ? String(ts).slice(5, 16) : ''
}

// 摘要：清洗 Markdown 符号后截断，最多两行视觉（CSS line-clamp 控制）
function summaryOf(n) {
  const s = String(n.summary || '')
    .replace(/[#*`>\[\]!-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return s || '（无内容）'
}

async function load() {
  loading.value = true
  try {
    const res = await listNotes({ status: tab.value, category: categoryFilter.value || '', page: page.value })
    const d = res && res.data
    if (res && res.success && d) {
      list.value = d.list || []
      totalPages.value = d.totalPages || 1
      page.value = d.page || 1
    }
  } catch (e) {
    // 列表加载失败：保留旧数据并清空，避免展示陈旧内容
    list.value = []
  } finally {
    loading.value = false
  }
}

function switchTab(t) {
  if (tab.value === t) return
  tab.value = t
  page.value = 1
  load()
}

function onFilterChange() {
  page.value = 1
  load()
}

// ===== 打开 / 新建 =====
async function openNoteById(id) {
  try {
    const res = await getNote(id)
    if (!res || !res.success || !res.data) return
    currentNote.value = res.data
    syncing = true
    draftTitle.value = res.data.title || ''
    draftCategory.value = res.data.category || 'other'
    draftContent.value = res.data.content || ''
    preview.value = false
    saveState.value = 'saved'
    saveErrorMsg.value = ''
    dirty = false
    syncing = false
  } catch (e) {
    // 打开失败（如已被删除）：清空编辑器
    currentNote.value = null
  }
}

function onPick(n) {
  // 回收站笔记不可编辑，仅提供恢复/彻底删除
  if (tab.value === 'deleted') return
  openNoteById(n.id)
}

// 新建：先输标题再建（复用全局输入弹窗）
async function onCreate() {
  const title = await dialogPrompt('请输入笔记主题（可稍后修改）', '', '新建笔记')
  if (title === null) return
  const t = String(title).trim()
  if (!t) {
    dialogAlert('主题不能为空')
    return
  }
  if (t.length > 120) {
    dialogAlert('主题不能超过 120 字')
    return
  }
  const res = await createNote({ title: t })
  if (!res || !res.success) {
    dialogAlert((res && res.message) || '创建失败，请重试')
    return
  }
  tab.value = 'active'
  categoryFilter.value = ''
  page.value = 1
  await load()
  openNoteById(res.data.id)
}

// ===== 自动保存 =====
watch([draftTitle, draftCategory, draftContent], () => {
  if (syncing || !currentNote.value) return
  dirty = true
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(saveNow, 1000)
})

async function saveNow() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (!currentNote.value || savingNow) return
  // 主题为空不能保存（与服务端校验一致）
  if (!String(draftTitle.value).trim()) {
    saveState.value = 'error'
    saveErrorMsg.value = '请输入笔记主题'
    dirty = true
    return
  }
  savingNow = true
  saveState.value = 'saving'
  try {
    const res = await updateNote(currentNote.value.id, {
      title: draftTitle.value,
      category: draftCategory.value,
      content: draftContent.value,
      version: currentNote.value.version
    })
    if (res && res.success && res.data) {
      currentNote.value = res.data
      saveState.value = 'saved'
      saveErrorMsg.value = ''
      dirty = false
      // 更新列表里的该项（updated_at 已变化，局部刷新）
      const idx = list.value.findIndex((x) => x.id === currentNote.value.id)
      if (idx >= 0) {
        list.value[idx] = { ...list.value[idx], updated_at: res.data.updated_at }
      }
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

// 离开页面前：未保存修改需确认（拦截路由离开）
onBeforeRouteLeave(async () => {
  if (!dirty || !currentNote.value) return true
  const ok = await dialogConfirm('笔记有未保存的修改，确定离开吗？', '未保存的修改')
  return !!ok
})

// ===== 删除 / 恢复 / 彻底删除 / 导出 =====
async function onDelete() {
  const ok = await dialogConfirm('删除后将移入回收站，可随时恢复。确定删除吗？', '删除笔记')
  if (!ok) return
  const id = currentNote.value.id
  const res = await deleteNote(id)
  if (!res || !res.success) {
    dialogAlert((res && res.message) || '删除失败，请重试')
    return
  }
  if (currentId.value === id) currentNote.value = null
  load()
}

async function onRestore(n) {
  const res = await restoreNote(n.id)
  if (!res || !res.success) {
    dialogAlert((res && res.message) || '恢复失败，请重试')
    return
  }
  load()
}

async function onPurge(n) {
  const ok = await dialogConfirm('彻底删除后不可恢复，确定删除吗？', '彻底删除笔记')
  if (!ok) return
  const res = await purgeNote(n.id)
  if (!res || !res.success) {
    dialogAlert((res && res.message) || '删除失败，请重试')
    return
  }
  if (currentId.value === n.id) currentNote.value = null
  load()
}

async function onExport() {
  exporting.value = true
  try {
    const res = await exportNote(currentNote.value.id)
    if (res && res.success) {
      dialogAlert('笔记已导出')
    } else if (res && res.canceled) {
      // 用户取消保存：静默
    } else {
      dialogAlert((res && res.message) || '导出失败，请重试')
    }
  } catch (e) {
    dialogAlert('导出失败，请重试')
  } finally {
    exporting.value = false
  }
}

onBeforeUnmount(() => {
  if (saveTimer) clearTimeout(saveTimer)
})

load()
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

/* ===== 左：列表栏 ===== */
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
.tabs {
  display: flex;
  gap: 4px;
}
.tabs button {
  padding: 5px 14px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-2);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.tabs button:hover {
  background: var(--bg-hover);
}
.tabs button.on {
  background: var(--primary-soft);
  color: var(--primary);
  font-weight: 600;
}
.notes-filter {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-light);
}
.notes-filter .select {
  width: 100%;
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
.note-card.trash {
  cursor: default;
}
.note-card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.note-card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--muted);
}
.note-card-meta .cat {
  color: var(--primary);
  background: var(--primary-soft);
  padding: 0 6px;
  border-radius: var(--radius-full);
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
.note-card-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
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

/* ===== 右：编辑器栏 ===== */
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
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-light);
}
.editor-title {
  flex: 1 1 auto;
  min-width: 0;
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
}
.editor-category {
  width: 130px;
}
.save-state {
  margin-left: auto;
}
.save-state.saving {
  color: var(--text-2);
}
.save-state.saved {
  color: var(--success);
}
.save-state.error {
  color: var(--danger);
}
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
.editor-textarea:focus {
  border-color: var(--primary);
}
.editor-preview {
  flex: 1 1 auto;
  min-height: 0;
  margin: 10px 14px 0;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow-y: auto;
}
.editor-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  font-size: 12px;
  color: var(--muted);
}
.editor-updated {
  flex: 1 1 auto;
}

/* 窄屏：列表与编辑器上下堆叠（Electron 固定 1100 宽一般不会触发） */
@media (max-width: 860px) {
  .notes-body {
    flex-direction: column;
  }
  .notes-list {
    flex: 0 0 320px;
    max-width: none;
  }
}
</style>
