<template>
  <!-- 周报详情弹窗（组管周报页：内容 + 附件 + 评审信息） -->
  <div v-if="visible" class="modal-mask" @click.self="close">
    <div class="modal view-modal">
      <div class="modal-head">
        <div class="modal-title">周报详情</div>
        <button type="button" class="modal-close" @click="close">×</button>
      </div>
      <div class="modal-body">
        <div v-if="!note" class="attach-empty">加载中…</div>
        <template v-else>
          <div class="view-head">
            <b>{{ note.student_name || '学生' }}</b>
            <span class="view-week">{{ weekLabel(note.week_key) }}</span>
            <span class="st" :class="'st-' + note.status">{{ statusText(note.status) }}</span>
          </div>
          <div class="view-title">{{ note.title || '（无主题）' }}</div>
          <div class="view-content"><MarkdownPreview :content="note.content || '（无内容）'" /></div>
          <div v-if="note.status === 'reviewed' || note.status === 'returned'" class="view-review">
            <b>{{ note.status === 'reviewed' ? '导师评语' : '打回理由' }}</b>
            <span v-if="note.review_score" class="score">评分 {{ note.review_score }}/5</span>
            <div class="view-comment">{{ note.review_comment || '（无）' }}</div>
          </div>
          <div class="view-attach">
            <span class="attach-label">附件（{{ attachments.length }}）</span>
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
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { reportGet, reportListAttachments, reportDownloadAttachment } from '../../api'
import { REPORT_STATUS_DRAFT, REPORT_STATUS_SUBMITTED, REPORT_STATUS_RETURNED, REPORT_STATUS_REVIEWED } from '../../config/constants'
import { dialogAlert } from '../../composables/useDialog'
import MarkdownPreview from '../../components/common/MarkdownPreview.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  noteId: { type: [Number, String], default: null }
})
const emit = defineEmits(['update:visible'])

const note = ref(null)
const attachments = ref([])

const STATUS_TEXT = {
  [REPORT_STATUS_DRAFT]: '草稿',
  [REPORT_STATUS_SUBMITTED]: '待批阅',
  [REPORT_STATUS_RETURNED]: '已打回',
  [REPORT_STATUS_REVIEWED]: '已批阅'
}
function statusText(s) {
  return STATUS_TEXT[s] || s
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
function sizeText(bytes) {
  const b = Number(bytes) || 0
  if (b >= 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + 'MB'
  if (b >= 1024) return (b / 1024).toFixed(1) + 'KB'
  return b + 'B'
}

// 打开弹窗：按 noteId 加载周报详情与附件
watch(
  () => props.visible,
  async (v) => {
    if (!v) return
    note.value = null
    attachments.value = []
    try {
      const res = await reportGet(props.noteId)
      if (!res || !res.success || !res.data) {
        dialogAlert('加载周报失败')
        return
      }
      note.value = res.data
      const att = await reportListAttachments(props.noteId)
      if (att && att.success) attachments.value = (att.data && att.data.list) || []
    } catch (e) {
      dialogAlert('加载周报失败')
    }
  }
)

function close() {
  emit('update:visible', false)
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
</script>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal {
  width: 640px;
  max-width: calc(100vw - 40px);
  max-height: calc(100vh - 80px);
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-light);
}
.modal-title { font-weight: 700; color: var(--text); }
.modal-close {
  border: none;
  background: transparent;
  font-size: 20px;
  color: var(--muted);
  cursor: pointer;
  line-height: 1;
}
.modal-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.view-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.view-week { color: var(--text-2); font-size: 13px; }
.view-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  padding: 8px 10px;
  background: var(--bg-hover);
  border-radius: var(--radius-md);
}
.view-content {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  min-height: 100px;
}
.view-review {
  border: 1px solid var(--border);
  border-left: 3px solid var(--success);
  border-radius: var(--radius-md);
  padding: 8px 12px;
  font-size: 13px;
}
.view-review .score { color: var(--success); font-weight: 600; margin-left: 10px; }
.view-comment { margin-top: 4px; color: var(--text-2); white-space: pre-wrap; word-break: break-word; }
.view-attach { border: 1px solid var(--border); border-radius: var(--radius-md); padding: 8px 12px; }
.attach-label { font-size: 13px; font-weight: 600; color: var(--text); }
.attach-empty { font-size: 12px; color: var(--muted); padding: 6px 0 2px; }
.attach-list { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
.attach-item { display: flex; align-items: center; gap: 8px; font-size: 12px; }
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
</style>
