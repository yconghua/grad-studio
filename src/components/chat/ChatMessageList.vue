<template>
  <div ref="listEl" class="chat-message-list" @scroll="onScroll">
    <div v-if="hasMore" class="load-more">
      <button type="button" class="btn btn-sm" :disabled="loadingMore" @click="$emit('load-more')">
        {{ loadingMore ? '加载中…' : '加载更早消息' }}
      </button>
    </div>

    <div v-if="!messages.length" class="empty-list">暂无消息，发一条打个招呼吧</div>

    <ChatMessageItem
      v-for="m in messages"
      :key="m.localKey || m.id"
      :message="m"
      :mine="Number(m.senderId) === myUserId"
      @recall="$emit('recall', m)"
    />
  </div>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue'
import ChatMessageItem from './ChatMessageItem.vue'

// 消息列表：按 id 升序展示；顶部上拉加载更早；新消息到达后自动滚动到底
const props = defineProps({
  messages: { type: Array, default: () => [] },
  myUserId: { type: Number, required: true },
  hasMore: { type: Boolean, default: false },
  loadingMore: { type: Boolean, default: false }
})
const emit = defineEmits(['load-more', 'recall'])

const listEl = ref(null)
let userScrolledUp = false

// 是否贴在底部（留 40px 容差；用于外部决定要不要自动已读）
function isAtBottom() {
  const el = listEl.value
  if (!el) return true
  return el.scrollTop + el.clientHeight >= el.scrollHeight - 40
}

function scrollToBottom(force = false) {
  if (!force && userScrolledUp) return
  const el = listEl.value
  if (el) el.scrollTop = el.scrollHeight
}

function onScroll() {
  const el = listEl.value
  if (!el) return
  userScrolledUp = el.scrollTop + el.clientHeight < el.scrollHeight - 40
  // 滚动到顶部附近触发加载更早
  if (el.scrollTop <= 40 && props.hasMore && !props.loadingMore) {
    emit('load-more')
  }
}

// 消息数量或内容变化（新消息 / 撤回 / 发送中状态替换）时滚动到底
watch(
  () => props.messages,
  async (list) => {
    await nextTick()
    scrollToBottom()
  },
  { deep: true }
)

defineExpose({ isAtBottom, scrollToBottom })
</script>

<style scoped>
.chat-message-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 18px;
}
.load-more {
  text-align: center;
  padding: 4px 0 10px;
}
.empty-list {
  text-align: center;
  color: #9aa1ac;
  font-size: 13px;
  padding: 40px 0;
}
</style>
