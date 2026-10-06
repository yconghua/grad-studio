<template>
  <div class="page notes-page">
    <div class="page-head">
      <div>
        <h2 class="page-title">我的笔记</h2>
        <p class="page-sub">学生私人科研草稿本：默认仅自己可见</p>
      </div>
      <button type="button" class="btn btn-primary" @click="onCreate">新建笔记</button>
    </div>

    <div class="tabs-row">
      <div class="tabs">
        <button type="button" :class="tab === 'active' ? 'on' : ''" @click="switchTab('active')">我的笔记</button>
        <button type="button" :class="tab === 'deleted' ? 'on' : ''" @click="switchTab('deleted')">回收站</button>
      </div>
      <div class="toolbar">
        <select v-model="categoryFilter" class="select" @change="onFilterChange">
          <option value="">全部类别</option>
          <option v-for="c in NOTE_CATEGORIES" :key="c.value" :value="c.value">{{ c.label }}</option>
        </select>
        <input
          v-if="tab === 'active'"
          v-model="keyword"
          class="input search-input"
          placeholder="搜索标题关键词…"
          @keyup.enter="onFilterChange"
        />
        <button v-if="keyword || categoryFilter" type="button" class="btn btn-sm" @click="onResetFilter">重置</button>
      </div>
    </div>

    <div class="tbl-wrap">
      <table v-resizable-columns v-sortable-columns="{ field: sortField, order: sortOrder, onSort }" class="tbl">
        <thead>
          <tr>
            <th data-sort="title">标题</th>
            <th data-sort="category">分类</th>
            <th :data-sort="tab === 'deleted' ? 'deleted_at' : 'time'">{{ tab === 'deleted' ? '删除时间' : '更新时间' }}</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="4"><div class="empty">加载中…</div></td>
          </tr>
          <tr v-else-if="!list.length">
            <td colspan="4">
              <div class="empty">{{ tab === 'deleted' ? '回收站是空的' : '还没有笔记，点击右上角「新建笔记」开始' }}</div>
            </td>
          </tr>
          <tr v-for="n in list" :key="n.id" class="row-click" @click="onPick(n)">
            <td><span class="title-cell" :title="n.title || '无标题笔记'">{{ n.title || '无标题笔记' }}</span></td>
            <td><span class="cat-badge">{{ categoryLabel(n.category) }}</span></td>
            <td class="time-cell">{{ timeText(tab === 'deleted' ? n.deleted_at : n.change_ts) }}</td>
            <td class="op-cell" @click.stop>
              <template v-if="tab === 'deleted'">
                <button type="button" class="btn btn-sm" @click="onRestore(n)">恢复</button>
                <button type="button" class="btn btn-sm btn-danger" @click="onPurge(n)">彻底删除</button>
              </template>
              <template v-else>
                <button type="button" class="btn btn-sm" @click="onEditRow(n)">编辑</button>
                <button type="button" class="btn btn-sm btn-danger" @click="onDeleteRow(n)">删除</button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="totalPages > 1" class="pager">
        <button type="button" class="btn btn-sm" :disabled="page <= 1" @click="page--; load()">上一页</button>
        <span>第 {{ page }} / {{ totalPages }} 页</span>
        <button type="button" class="btn btn-sm" :disabled="page >= totalPages" @click="page++; load()">下一页</button>
      </div>
    </div>

    <NoteEditDialog
      ref="editorRef"
      :open="editorOpen"
      :note-id="editorNoteId"
      @update:open="editorOpen = $event"
      @saved="onEditorSaved"
    />
    <NoteDetailDialog
      :open="detailOpen"
      :note-id="detailNoteId"
      @update:open="detailOpen = $event"
      @edit="onDetailEdit"
      @saved="onEditorSaved"
    />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRoute, onBeforeRouteLeave } from 'vue-router'
import { listNotes, deleteNote, restoreNote, purgeNote } from '../../api/note'
import { NOTE_CATEGORIES } from '../../config/constants'
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'
import { useAutoRefresh } from '../../composables/useAutoRefresh'
import { refreshAfterWrite } from '../../composables/useGlobalRefresh'
import NoteEditDialog from '../../components/note/NoteEditDialog.vue'
import NoteDetailDialog from '../../components/note/NoteDetailDialog.vue'

// ===== 列表 =====
const tab = ref('active') // active 我的笔记 / deleted 回收站
const categoryFilter = ref('')
const keyword = ref('')
const sortField = ref('')
const sortOrder = ref('')
const page = ref(1)
const totalPages = ref(1)
const list = ref([])
const loading = ref(false)

// ===== 详情 / 编辑弹窗 =====
const editorRef = ref(null)
const editorOpen = ref(false)
const editorNoteId = ref(null)
const detailOpen = ref(false)
const detailNoteId = ref(null)

function categoryLabel(value) {
  const item = NOTE_CATEGORIES.find((c) => c.value === value)
  return item ? item.label : value
}

// 时间：'YYYY-MM-DD HH:mm:ss' → 'MM-DD HH:mm'
function timeText(ts) {
  return ts ? String(ts).slice(5, 16) : ''
}

async function load() {
  loading.value = true
  try {
    const res = await listNotes({
      status: tab.value,
      category: categoryFilter.value || '',
      keyword: keyword.value.trim(),
      sortField: sortField.value,
      sortOrder: sortOrder.value,
      page: page.value
    })
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
  // 排序字段语义随 tab 变化（active→change_ts / deleted→deleted_at），切换时重置
  sortField.value = ''
  sortOrder.value = ''
  page.value = 1
  load()
}

function onFilterChange() {
  page.value = 1
  load()
}

function onSort(field, order) {
  sortField.value = field
  sortOrder.value = order
  page.value = 1
  load()
}

function onResetFilter() {
  categoryFilter.value = ''
  keyword.value = ''
  onFilterChange()
}

// ===== 弹窗：新建 / 详情 / 编辑 / 全局搜索直达 =====
function openEditor(id) {
  editorNoteId.value = id
  editorOpen.value = true
}

function openDetail(id) {
  detailNoteId.value = id
  detailOpen.value = true
}

function onCreate() {
  openEditor(null)
}

// 点击行：打开详情（我的笔记 / 回收站均可只读查看）
function onPick(n) {
  openDetail(n.id)
}

// 表格操作列「编辑」：直接进入编辑弹窗
function onEditRow(n) {
  openEditor(n.id)
}

// 详情弹窗内点「编辑」：关闭详情再打开编辑
function onDetailEdit(id) {
  detailOpen.value = false
  openEditor(id)
}

const route = useRoute()

// 全局搜索直达：?open=<id> → 自动打开详情弹窗。
// 用 watch 而非 onMounted：同路由下 query 变化（已在本页再点搜索结果）也会触发。
watch(
  () => route.query.open,
  (openId) => {
    if (openId != null && /^\d+$/.test(String(openId))) {
      openDetail(Number(openId))
    }
  },
  { immediate: true }
)

function onEditorSaved(payload) {
  load()
  const action = payload && payload.action
  if (action === 'create') {
    refreshAfterWrite('笔记已创建')
  } else if (action === 'delete') {
    refreshAfterWrite('已移入回收站')
  }
  // update：自动保存静默刷新列表，不打扰
}

// 离开页面前：弹窗内有未保存修改需确认
onBeforeRouteLeave(async () => {
  if (editorOpen.value && editorRef.value && editorRef.value.getDirty()) {
    const ok = await dialogConfirm('笔记有未保存的修改，确定离开吗？', '未保存的修改')
    return !!ok
  }
  return true
})

// ===== 删除 / 恢复 / 彻底删除 =====
async function onDeleteRow(n) {
  const ok = await dialogConfirm('删除后将移入回收站，可随时恢复。确定删除吗？', '删除笔记')
  if (!ok) return
  const res = await deleteNote(n.id)
  if (!res || !res.success) {
    dialogAlert((res && res.message) || '删除失败，请重试')
    return
  }
  load()
  await refreshAfterWrite('已移入回收站')
}

async function onRestore(n) {
  const res = await restoreNote(n.id)
  if (!res || !res.success) {
    dialogAlert((res && res.message) || '恢复失败，请重试')
    return
  }
  load()
  await refreshAfterWrite('已恢复')
}

async function onPurge(n) {
  const ok = await dialogConfirm('彻底删除后不可恢复，确定删除吗？', '彻底删除笔记')
  if (!ok) return
  const res = await purgeNote(n.id)
  if (!res || !res.success) {
    dialogAlert((res && res.message) || '删除失败，请重试')
    return
  }
  load()
  await refreshAfterWrite('已彻底删除')
}

load()
// 数据变动（本页写操作或外部改动）后后台静默重拉，保持笔记列表最新
useAutoRefresh(load)
</script>

<style scoped>
.notes-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.tabs-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.tabs {
  display: flex;
  gap: 4px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 4px;
  flex: 0 0 auto;
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
.toolbar {
  flex: 1 1 auto;
  margin-bottom: 0;
}
.search-input {
  width: 240px;
}
.title-cell {
  display: inline-block;
  max-width: 420px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
}
.cat-badge {
  display: inline-block;
  color: var(--primary);
  background: var(--primary-soft);
  padding: 1px 8px;
  border-radius: var(--radius-full);
  font-size: 12px;
}
.time-cell {
  color: var(--text-2);
  white-space: nowrap;
}
.row-click {
  cursor: pointer;
}
.op-cell {
  white-space: nowrap;
}
.op-cell .btn + .btn {
  margin-left: 8px;
}
</style>
