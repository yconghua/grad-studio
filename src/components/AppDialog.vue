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
import { dialogState, dialogClose } from '../composables/useDialog'

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
  z-index: 300; /* 高于业务表单弹窗（200） */
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}
.dialog-box {
  width: 380px;
  max-width: 92vw;
  background: #fff;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
}
.dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #eceff3;
}
.dialog-head h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2329;
}
.dialog-close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: #f2f3f5;
  color: #4e5969;
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
  color: #1f2329;
  word-break: break-word;
}
.dialog-input {
  width: 100%;
  min-height: 36px;
  margin-top: 12px;
  padding: 0 10px;
  font-size: 13px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  outline: none;
  box-sizing: border-box;
}
.dialog-input:focus {
  border-color: #0d80e0;
}
.dialog-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid #eceff3;
}
.dialog-btn {
  height: 34px;
  padding: 0 18px;
  font-size: 13px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  background: #fff;
  color: #4e5969;
  cursor: pointer;
  transition: all 0.2s;
}
.dialog-btn:hover {
  border-color: #0d80e0;
  color: #0d80e0;
}
.dialog-btn.primary {
  border: none;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  color: #fff;
  font-weight: 600;
}
.dialog-btn.primary:hover {
  opacity: 0.92;
}
</style>
