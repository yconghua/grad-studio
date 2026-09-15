<template>
  <div v-if="visible" class="privacy-overlay">
    <div class="privacy-backdrop" @click="emit('close')"></div>
    <div class="privacy-dialog confirm-dialog" role="dialog" aria-modal="true">
      <div class="privacy-body">
        <p class="confirm-text">确定删除该数据库连接配置吗？此操作不可撤销。</p>
      </div>
      <div class="modal-foot">
        <button type="button" class="save-btn ghost" @click="emit('close')">取消</button>
        <button type="button" class="save-btn danger" @click="emit('confirmed', targetId)">确认删除</button>
      </div>
    </div>
  </div>
</template>

<script setup>
// 删除连接确认弹窗（从登录页抽离）：纯 UI，不发起请求
// 父组件传入 targetId，确认时 emit('confirmed', id) 由父组件执行删除并刷新连接清单
defineProps({
  visible: { type: Boolean, default: false },
  targetId: { type: String, default: '' }
})
const emit = defineEmits(['close', 'confirmed'])
</script>

<style scoped>
.privacy-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.privacy-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
}
.privacy-dialog {
  position: relative;
  z-index: 1;
  width: 560px;
  max-width: 92vw;
  max-height: 80vh;
  background: #fff;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
}
.confirm-dialog {
  max-width: 360px;
}
.privacy-body {
  padding: 18px 22px;
  overflow-y: auto;
}
.confirm-text {
  font-size: 14px;
  color: #4e5969;
  line-height: 1.6;
  margin: 10px 4px 4px;
}
.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin: 18px 18px 10px 0;
}
.save-btn {
  height: 38px;
  padding: 0 22px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}
.save-btn:hover {
  opacity: 0.92;
}
.save-btn.ghost {
  background: #fff;
  color: #0d80e0;
  border: 1px solid #0d80e0;
}
.save-btn.danger {
  background: #ea4335;
  color: #fff;
}
.save-btn.danger:hover {
  opacity: 0.92;
}
</style>
