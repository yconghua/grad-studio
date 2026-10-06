<template>
  <div v-if="open" class="modal-mask" @click.self="close">
    <div class="modal lg note-edit-dialog">
      <div class="modal-head">
        <h3>{{ isCreate ? '新建笔记' : '编辑笔记' }}</h3>
        <button type="button" class="modal-close" @click="close">×</button>
      </div>
      <div class="modal-body">
        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="errorMsg" class="empty">{{ errorMsg }}</div>
        <div v-else class="note-body">
          <div class="note-meta">
            <input v-model="draftTitle" class="input note-title" maxlength="120" placeholder="笔记主题（必填，可稍后修改）" />
            <select v-model="draftCategory" class="select note-category">
              <option v-for="c in NOTE_CATEGORIES" :key="c.value" :value="c.value">{{ c.label }}</option>
            </select>
          </div>
          <div class="note-tabs">
            <button type="button" :class="!preview ? 'on' : ''" @click="preview = false">编辑</button>
            <button type="button" :class="preview ? 'on' : ''" @click="preview = true">预览</button>
            <span class="word-count">{{ draftContent.length }} / 100000</span>
            <span v-if="saveState !== 'idle'" class="save-state" :class="saveState">
              {{ saveStateText }}
            </span>
          </div>
          <textarea
            v-if="!preview"
            v-model="draftContent"
            class="note-textarea"
            placeholder="支持 Markdown 语法：## 标题、**加粗**、- 列表、> 引用、`代码`…"
          ></textarea>
          <div v-else class="note-preview">
            <MarkdownPreview :content="draftContent" />
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <span v-if="!isCreate && currentNote" class="foot-updated">最后更新于 {{ currentNote.change_ts || '-' }}</span>
        <button v-if="saveState === 'error'" type="button" class="btn btn-sm" @click="saveNow">重试保存</button>
        <button v-if="!isCreate" type="button" class="btn btn-sm" :disabled="exporting" @click="onExport">
          {{ exporting ? '导出中…' : '导出 Word' }}
        </button>
        <button v-if="!isCreate" type="button" class="btn btn-sm btn-danger" @click="onDelete">删除</button>
        <button type="button" class="btn" @click="close">取消</button>
        <button type="button" class="btn btn-primary" :disabled="saving" @click="saveNow">
          {{ isCreate ? (saving ? '创建中…' : '创建') : (saving ? '保存中…' : '保存') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { getNote, createNote, updateNote, deleteNote, exportNote } from '../../api/note'
import { NOTE_CATEGORIES } from '../../config/constants'
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'
import MarkdownPreview from '../common/MarkdownPreview.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  // 新建时传 null/undefined；编辑时传笔记 id
  noteId: { type: [Number, String], default: null }
})
const emit = defineEmits(['update:open', 'saved'])

const isCreate = computed(() => props.noteId == null || props.noteId === '')

// ===== 草稿状态 =====
const currentNote = ref(null) // 服务端最新记录（含 version），仅编辑模式有值
const draftTitle = ref('')
const draftCategory = ref('other')
const draftContent = ref('')
const preview = ref(false)
const saveState = ref('idle') // idle / saving / saved / error
const saveErrorMsg = ref('')
const saving = ref(false)
const exporting = ref(false)
const loading = ref(false)
const errorMsg = ref('')

// 防抖定时器 + 同步标志（打开加载时跳过自动保存触发）
let saveTimer = null
let syncing = false
let dirty = false

const saveStateText = computed(() => {
  if (saveState.value === 'saving') return '保存中…'
  if (saveState.value === 'saved') return '已保存'
  if (saveState.value === 'error') return saveErrorMsg.value || '保存失败'
  return ''
})

// 打开时初始化：新建重置空草稿，编辑拉取服务端最新记录
async function init() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
  dirty = false
  saving.value = false
  exporting.value = false
  preview.value = false
  saveErrorMsg.value = ''
  errorMsg.value = ''
  currentNote.value = null
  draftTitle.value = ''
  draftCategory.value = 'other'
  draftContent.value = ''
  saveState.value = isCreate.value ? 'idle' : 'saved'

  if (isCreate.value) return
  loading.value = true
  try {
    const res = await getNote(props.noteId)
    if (res && res.success && res.data) {
      if (res.data.is_deleted) {
        // 回收站笔记不可编辑：详情弹窗只读展示，编辑入口统一拦截
        errorMsg.value = '回收站笔记不可编辑，请先在回收站恢复'
        loading.value = false
        return
      }
      currentNote.value = res.data
      syncing = true
      draftTitle.value = res.data.title || ''
      draftCategory.value = res.data.category || 'other'
      draftContent.value = res.data.content || ''
      syncing = false
      saveState.value = 'saved'
    } else {
      errorMsg.value = (res && res.message) || '笔记不存在或无权查看'
    }
  } catch (e) {
    errorMsg.value = '加载失败，请重试'
  } finally {
    loading.value = false
  }
}

watch([() => props.open, () => props.noteId], () => { if (props.open) init() })

// 供父页面在路由离开前检查是否有未保存修改
defineExpose({ getDirty: () => dirty })

// ===== 自动保存（仅编辑模式：防抖 1s + 版本号乐观锁） =====
watch([draftTitle, draftCategory, draftContent], () => {
  if (syncing || loading.value || !props.open) return
  if (isCreate.value) {
    // 新建模式不自动创建（标题为空无法入库），等用户点「创建」
    dirty = true
    return
  }
  if (!currentNote.value) return
  dirty = true
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(saveNow, 1000)
})

async function saveNow() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (saving.value) return
  if (!String(draftTitle.value).trim()) {
    saveState.value = 'error'
    saveErrorMsg.value = '请输入笔记主题'
    dirty = true
    return
  }
  saving.value = true
  saveState.value = 'saving'
  try {
    if (isCreate.value) {
      const res = await createNote({
        title: draftTitle.value,
        category: draftCategory.value,
        content: draftContent.value
      })
      if (res && res.success && res.data) {
        dirty = false
        emit('saved', { action: 'create', note: res.data })
        emit('update:open', false)
        return
      }
      saveState.value = 'error'
      saveErrorMsg.value = (res && res.message) || '创建失败，请重试'
      dirty = true
    } else {
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
        emit('saved', { action: 'update', note: res.data })
      } else {
        saveState.value = 'error'
        saveErrorMsg.value = (res && res.message) || '保存失败'
        dirty = true
      }
    }
  } catch (e) {
    saveState.value = 'error'
    saveErrorMsg.value = '保存失败，请重试'
    dirty = true
  } finally {
    saving.value = false
  }
}

// ===== 导出 / 删除 =====
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

async function onDelete() {
  const ok = await dialogConfirm('删除后将移入回收站，可随时恢复。确定删除吗？', '删除笔记')
  if (!ok) return
  const res = await deleteNote(currentNote.value.id)
  if (!res || !res.success) {
    dialogAlert((res && res.message) || '删除失败，请重试')
    return
  }
  emit('saved', { action: 'delete' })
  emit('update:open', false)
}

// ===== 关闭：未保存修改需确认 =====
async function close() {
  if (dirty) {
    const ok = await dialogConfirm(
      isCreate.value ? '笔记尚未创建，确定放弃并关闭吗？' : '笔记有未保存的修改，确定关闭吗？',
      '未保存的修改'
    )
    if (!ok) return
  }
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  emit('update:open', false)
}

onBeforeUnmount(() => {
  if (saveTimer) clearTimeout(saveTimer)
})
</script>

<style scoped>
.note-edit-dialog .modal-body {
  display: flex;
  flex-direction: column;
}
.note-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  /* 编辑区高度随窗口缩放（字号放大时同步折算，不超窗） */
  height: calc(68vh / var(--app-font-zoom, 1));
  min-height: 300px;
}
.note-meta {
  display: flex;
  gap: 10px;
}
.note-title {
  flex: 1 1 auto;
  min-width: 0;
}
.note-category {
  width: 140px;
  flex: 0 0 auto;
}
.note-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
}
.note-tabs button {
  padding: 4px 12px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-2);
  font-size: 13px;
  cursor: pointer;
}
.note-tabs button:hover {
  background: var(--bg-hover);
}
.note-tabs button.on {
  background: var(--primary-soft);
  color: var(--primary);
  font-weight: 600;
}
.word-count {
  margin-left: auto;
  font-size: 12px;
  color: var(--muted);
}
.save-state {
  margin-left: 8px;
  font-size: 12px;
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
.note-textarea {
  flex: 1 1 auto;
  min-height: 0;
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
.note-textarea:focus {
  border-color: var(--primary);
}
.note-preview {
  flex: 1 1 auto;
  min-height: 0;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow-y: auto;
}
.foot-updated {
  margin-right: auto;
  font-size: 12px;
  color: var(--muted);
}
</style>
