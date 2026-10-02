<template>
  <div class="msg-row" :class="{ mine, failed: message.status === -1, pending: message.status === 0 }">
    <div class="msg-bubble">
      <div v-if="message.status === 2" class="msg-recalled">消息已撤回</div>
      <div v-else class="msg-content">{{ message.content }}</div>
      <div class="msg-meta">
        <span class="msg-time">{{ timeText(message.createdAt) }}</span>
        <span v-if="message.status === 0" class="msg-state">发送中</span>
        <span v-else-if="message.status === -1" class="msg-state error">发送失败</span>
      </div>
    </div>
    <div class="msg-ops">
      <button
        v-if="message.status === -1"
        type="button"
        class="btn btn-sm btn-danger"
        @click="$emit('retry', message)"
      >重试</button>
      <button
        v-if="mine && message.status === 1 && canRecall"
        type="button"
        class="btn btn-sm"
        @click="$emit('recall', message)"
      >撤回</button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'

// 单条消息：自己发的靠右（可撤回，2 分钟窗口本地倒计时），对方靠左；
// 撤回后服务端清空内容置 status=2，统一显示「消息已撤回」占位
const props = defineProps({
  message: { type: Object, required: true },
  mine: { type: Boolean, default: false }
})
defineEmits(['recall', 'retry'])

const RECALL_WINDOW_SECONDS = 120

// 每秒刷新当前时间：撤回按钮在窗口内可见，超时自动消失
const now = ref(Date.now())
let timer = null
onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const canRecall = computed(() => {
  const d = parseTime(props.message.createdAt)
  if (!d) return false
  return now.value - d.getTime() <= RECALL_WINDOW_SECONDS * 1000
})

// 服务端时间（YYYY-MM-DD HH:mm:ss）与本地时间统一解析
function parseTime(ts) {
  if (!ts) return null
  const d = new Date(String(ts).replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? null : d
}

function timeText(ts) {
  const d = parseTime(ts)
  if (!d) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<style scoped>
.msg-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  align-items: flex-end;
}
.msg-row.mine {
  flex-direction: row-reverse;
}
.msg-row.pending .msg-bubble {
  opacity: 0.6;
}
.msg-row.failed .msg-bubble {
  border: 1px solid var(--danger-border);
}
.msg-bubble {
  max-width: 68%;
  padding: 8px 12px;
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  border: 1px solid var(--border);
  word-break: break-word;
  white-space: pre-wrap;
}
.msg-row.mine .msg-bubble {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--on-accent);
}
.msg-content {
  font-size: 14px;
  line-height: 1.5;
}
.msg-recalled {
  font-size: 13px;
  color: var(--muted);
  font-style: italic;
}
.msg-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-disabled);
}
.msg-row.mine .msg-meta {
  color: color-mix(in srgb, var(--on-accent) 75%, transparent);
}
.msg-state.error {
  color: var(--danger);
}
.msg-ops {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
</style>
