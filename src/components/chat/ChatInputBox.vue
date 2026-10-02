<template>
  <div class="chat-input-box">
    <textarea
      ref="taEl"
      v-model="text"
      class="chat-textarea"
      :disabled="disabled"
      :placeholder="disabled ? '对方已删除，无法继续聊天' : '输入消息，Enter 发送，Shift+Enter 换行'"
      @keydown.enter.exact.prevent="onSend"
    ></textarea>
    <div class="input-foot">
      <span class="char-count">{{ text.length }}/{{ maxLength }}</span>
      <button type="button" class="btn btn-primary" :disabled="disabled || !canSend" @click="onSend">
        发送
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

// 消息输入框：Enter 发送、Shift+Enter 换行、2000 字上限（与主进程校验口径一致）
const props = defineProps({
  disabled: { type: Boolean, default: false }
})
const emit = defineEmits(['send'])

const maxLength = 2000
const text = ref('')
const taEl = ref(null)

const canSend = computed(() => !props.disabled && text.value.trim().length > 0)

function onSend() {
  if (!canSend.value) return
  const content = text.value.trim()
  emit('send', content)
  text.value = ''
}

// 输入框在发送后保持焦点；切换会话时清空并聚焦
watch(
  () => props.disabled,
  () => {
    if (!props.disabled && taEl.value) taEl.value.focus()
  }
)

defineExpose({ focus: () => taEl.value && taEl.value.focus() })
</script>

<style scoped>
.chat-input-box {
  border-top: 1px solid var(--border);
  padding: 10px 14px 12px;
  background: var(--bg-card);
}
.chat-textarea {
  width: 100%;
  height: 72px;
  resize: none;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  padding: 8px 10px;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
}
.chat-textarea:focus {
  border-color: var(--primary);
}
.chat-textarea[disabled] {
  background: var(--bg-muted);
  color: var(--text-3);
}
.input-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}
.char-count {
  font-size: 12px;
  color: var(--muted);
}
</style>
