<template>
  <div v-if="open" class="modal-mask" @click.self="close">
    <div class="modal lg note-detail-dialog">
      <div class="modal-head">
        <h3>笔记详情</h3>
        <button type="button" class="modal-close" @click="close">×</button>
      </div>
      <div class="modal-body">
        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="errorMsg" class="empty">{{ errorMsg }}</div>
        <div v-else-if="note" class="detail">
          <div class="detail-head">
            <h3 class="detail-title">{{ note.title || '无标题笔记' }}</h3>
            <span class="cat-badge">{{ categoryLabel(note.category) }}</span>
          </div>
          <div class="detail-meta">
            <span>创建于 {{ note.created_at || '-' }}</span>
            <span>最后更新 {{ note.change_ts || '-' }}</span>
          </div>
          <div v-if="note.content" class="detail-body">
            <MarkdownPreview :content="note.content" />
          </div>
          <div v-else class="detail-empty">（无内容）</div>
        </div>
      </div>
      <div v-if="note && !note.is_deleted" class="modal-foot">
        <span class="foot-spacer"></span>
        <button type="button" class="btn btn-sm" :disabled="exporting" @click="onExport">
          {{ exporting ? '导出中…' : '导出 Word' }}
        </button>
        <button type="button" class="btn" @click="$emit('edit', note.id)">编辑</button>
        <button type="button" class="btn btn-danger" @click="onDelete">删除</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { getNote, deleteNote, exportNote } from '../../api/note'
import { NOTE_CATEGORIES } from '../../config/constants'
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'
import MarkdownPreview from '../common/MarkdownPreview.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  noteId: { type: [Number, String], default: null }
})
const emit = defineEmits(['update:open', 'edit', 'saved'])

const note = ref(null)
const loading = ref(false)
const errorMsg = ref('')
const exporting = ref(false)

function categoryLabel(value) {
  const item = NOTE_CATEGORIES.find((c) => c.value === value)
  return item ? item.label : value
}

async function init() {
  note.value = null
  errorMsg.value = ''
  exporting.value = false
  if (props.noteId == null) return
  loading.value = true
  try {
    const res = await getNote(props.noteId)
    if (res && res.success && res.data) {
      note.value = res.data
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

function close() {
  emit('update:open', false)
}

async function onExport() {
  exporting.value = true
  try {
    const res = await exportNote(note.value.id)
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
  const res = await deleteNote(note.value.id)
  if (!res || !res.success) {
    dialogAlert((res && res.message) || '删除失败，请重试')
    return
  }
  emit('saved', { action: 'delete' })
  close()
}
</script>

<style scoped>
.note-detail-dialog .modal-body {
  overflow: auto;
}
.detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.detail-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  word-break: break-word;
}
.cat-badge {
  flex: 0 0 auto;
  color: var(--primary);
  background: var(--primary-soft);
  padding: 2px 10px;
  border-radius: var(--radius-full);
  font-size: 12px;
  margin-top: 2px;
}
.detail-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--muted);
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-light);
}
.detail-body {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  min-height: 120px;
  max-height: calc(52vh / var(--app-font-zoom, 1));
  overflow-y: auto;
}
.detail-empty {
  color: var(--muted);
  font-size: 13px;
  padding: 24px 0;
  text-align: center;
}
.foot-spacer {
  flex: 1 1 auto;
}
</style>
