<template>
  <div v-if="visible" class="modal-mask" @click.self="close">
    <div class="modal-box">
      <div class="modal-head">
        <h4>任务评论</h4>
        <button class="modal-close" @click="close">×</button>
      </div>
      <div class="modal-body">
        <div class="comment-list">
          <div v-if="loading" class="empty">加载中…</div>
          <div v-else-if="!comments.length" class="empty">暂无评论</div>
          <div v-for="c in comments" :key="c.id" class="comment-item">
            <div class="comment-head">
              <span class="comment-author">{{ authorName(c.author_id) }}</span>
              <span class="comment-time">{{ fmtTime(c.created_at) }}</span>
            </div>
            <div class="comment-content" v-html="renderMarkdown(c.content)"></div>
          </div>
        </div>

        <div class="comment-input">
          <div class="mention-bar" v-if="mentionList.length">
            <div
              v-for="m in mentionList"
              :key="m.id"
              class="mention-item"
              @click="pickMention(m)"
            >{{ m.real_name || m.username }}</div>
          </div>
          <textarea
            v-model="draft"
            class="comment-textarea"
            placeholder="写下评论，输入 @ 提及成员"
            rows="3"
            @input="onInput"
            @keydown.down.prevent="showNextMention"
            @keydown.up.prevent="showPrevMention"
          ></textarea>
          <div class="comment-actions">
            <button class="btn btn-primary" @click="submit" :disabled="sending">
              {{ sending ? '发送中…' : '发送' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { collab } from '../api'
import { listMembers } from '../api'
import { dialogAlert } from '../composables/useDialog'

const props = defineProps({
  visible: Boolean,
  taskId: [Number, String],
  taskTitle: String
})
const emit = defineEmits(['close'])

const comments = ref([])
const loading = ref(false)
const draft = ref('')
const sending = ref(false)
const members = ref([])
const mentionList = ref([])
const mentionStart = ref(-1)
const selectedMention = ref(0)
const mentionedIds = ref([])

watch(
  () => props.visible,
  async (v) => {
    if (v && props.taskId) {
      await loadMembers()
      await loadComments()
    }
  }
)

async function loadMembers() {
  try {
    const res = await listMembers()
    if (res && res.success) members.value = res.members || []
  } catch (e) {}
}

async function loadComments() {
  loading.value = true
  try {
    const res = await collab.taskComment.list({ task_id: props.taskId })
    comments.value = (res && res.list) || []
  } catch (e) {
    comments.value = []
  } finally {
    loading.value = false
  }
}

function authorName(id) {
  const m = members.value.find((x) => x.id === id)
  return m ? (m.real_name || m.username) : `用户${id}`
}

function fmtTime(v) {
  return v ? String(v).slice(0, 16) : ''
}

function renderMarkdown(text) {
  if (!text) return ''
  let html = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  html = html
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>')
  return html
}

function onInput(e) {
  const val = draft.value
  const pos = e.target.selectionStart
  const before = val.slice(0, pos)
  const atIdx = before.lastIndexOf('@')
  if (atIdx >= 0) {
    const afterAt = before.slice(atIdx + 1)
    if (!/\s/.test(afterAt)) {
      const kw = afterAt.toLowerCase()
      mentionList.value = members.value
        .filter((m) => (m.real_name || m.username).toLowerCase().includes(kw))
        .slice(0, 8)
      mentionStart.value = atIdx
      selectedMention.value = 0
      return
    }
  }
  mentionList.value = []
}

function pickMention(m) {
  const before = draft.value.slice(0, mentionStart.value)
  const afterAt = draft.value.slice(mentionStart.value + 1)
  const spaceIdx = afterAt.search(/\s/)
  const rest = spaceIdx >= 0 ? afterAt.slice(spaceIdx) : ''
  draft.value = `${before}@${m.real_name || m.username} ${rest}`
  if (!mentionedIds.value.includes(m.id)) mentionedIds.value.push(m.id)
  mentionList.value = []
  mentionStart.value = -1
}

function showNextMention() {
  if (!mentionList.value.length) return
  selectedMention.value = (selectedMention.value + 1) % mentionList.value.length
}
function showPrevMention() {
  if (!mentionList.value.length) return
  selectedMention.value = (selectedMention.value - 1 + mentionList.value.length) % mentionList.value.length
}

async function submit() {
  const text = draft.value.trim()
  if (!text) return
  sending.value = true
  try {
    const res = await collab.taskComment.create({
      task_id: props.taskId,
      content: text,
      mentions: mentionedIds.value.join(',')
    })
    if (res && res.success) {
      draft.value = ''
      mentionedIds.value = []
      await loadComments()
    } else {
      console.warn('[taskComment.submit] 后端拒绝:', res)
      await dialogAlert((res && res.message) || '发送失败，请稍后重试')
    }
  } catch (e) {
    console.error('[taskComment.submit] 异常:', e)
    await dialogAlert('发送失败，请稍后重试')
  } finally {
    sending.value = false
  }
}

function close() {
  draft.value = ''
  mentionedIds.value = []
  mentionList.value = []
  emit('close')
}
</script>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 300;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-box {
  width: 640px;
  max-width: 92vw;
  max-height: 80vh;
  background: #fff;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #eceff3;
}
.modal-head h4 {
  margin: 0;
  font-size: 15px;
}
.modal-close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: #f2f3f5;
  cursor: pointer;
  font-size: 18px;
}
.modal-body {
  padding: 14px 18px;
  overflow-y: auto;
  flex: 1;
}
.comment-list {
  margin-bottom: 14px;
}
.comment-item {
  padding: 10px 0;
  border-bottom: 1px solid #f0f2f5;
}
.comment-head {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #8a9099;
  margin-bottom: 4px;
}
.comment-author {
  color: #0d80e0;
  font-weight: 600;
}
.comment-content {
  font-size: 13px;
  color: #1f2329;
  line-height: 1.6;
}
.comment-content code {
  background: #f2f3f5;
  padding: 1px 4px;
  border-radius: 3px;
}
.empty {
  text-align: center;
  color: #8a9099;
  padding: 20px 0;
  font-size: 13px;
}
.mention-bar {
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  margin-bottom: 6px;
  max-height: 160px;
  overflow-y: auto;
}
.mention-item {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
}
.mention-item:hover {
  background: #f0f7ff;
}
.comment-textarea {
  width: 100%;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  padding: 10px;
  font-size: 13px;
  resize: vertical;
  box-sizing: border-box;
}
.comment-actions {
  text-align: right;
  margin-top: 8px;
}
.btn {
  padding: 6px 16px;
  border: 1px solid #dfe3e8;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
}
.btn-primary {
  background: #0d80e0;
  color: #fff;
  border: none;
}
</style>
