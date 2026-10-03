<template>
  <!-- 全局代码内弹窗：替代 window.alert/confirm/prompt（系统弹窗） -->
  <div v-if="dialogState.visible" class="dialog-mask" @click.self="onCancel">
    <div class="dialog-box">
      <div class="dialog-head">
        <h4>{{ dialogState.title }}</h4>
        <button v-if="dialogState.type !== 'alert'" class="dialog-close" @click="onCancel" aria-label="关闭">×</button>
      </div>
      <div class="dialog-body">
        <p class="dialog-message">{{ dialogState.message }}</p>
        <input
          v-if="dialogState.type === 'prompt'"
          v-model="dialogState.inputValue"
          class="dialog-input"
          :placeholder="dialogState.placeholder"
          @keyup.enter="onOk"
        />
      </div>
      <div class="dialog-foot">
        <template v-if="dialogState.type === 'alert'">
          <button class="dialog-btn primary" @click="onOk">确定</button>
        </template>
        <template v-else>
          <button class="dialog-btn" @click="onCancel">取消</button>
          <button class="dialog-btn primary" @click="onOk">确定</button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { dialogState, dialogClose } from '../../composables/useDialog'

// 确定：alert/confirm 返回 true，prompt 返回输入值
function onOk() {
  if (dialogState.type === 'prompt') {
    dialogClose(dialogState.inputValue ?? '')
  } else {
    dialogClose(true)
  }
}
// 取消：confirm 返回 false，prompt 返回 null
function onCancel() {
  dialogClose(dialogState.type === 'prompt' ? null : false)
}
</script>

<style scoped>
.dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 2000; /* 高于所有业务弹窗（1000），全局提示永远置顶 */
  background: var(--mask);
  display: flex;
  align-items: center;
  justify-content: center;
}
.dialog-box {
  width: 380px;
  max-width: 92vw;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
}
.dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-light);
}
.dialog-head h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}
.dialog-close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--gray-soft);
  color: var(--text-2);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}
.dialog-body {
  padding: 20px;
}
.dialog-message {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text);
  word-break: break-word;
}
.dialog-input {
  width: 100%;
  min-height: 36px;
  margin-top: 12px;
  padding: 0 10px;
  font-size: 13px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  outline: none;
  box-sizing: border-box;
}
.dialog-input:focus {
  border-color: var(--primary);
}
.dialog-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--border-light);
}
.dialog-btn {
  height: 34px;
  padding: 0 18px;
  font-size: 13px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  color: var(--text-2);
  cursor: pointer;
  transition: all 0.2s;
}
.dialog-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
}
.dialog-btn.primary {
  border: none;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
  color: var(--on-accent);
  font-weight: 600;
}
.dialog-btn.primary:hover {
  opacity: 0.92;
}
</style>
