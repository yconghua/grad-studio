<template>
  <div class="app-toast-wrap">
    <transition-group name="toast">
      <div v-for="t in toastState.list" :key="t.id" class="app-toast" :class="`toast-${t.type}`">
        <span class="toast-dot" />
        <span class="toast-text">{{ t.message }}</span>
      </div>
    </transition-group>
  </div>
</template>

<script setup>
import { toastState } from '../../composables/useToast'
</script>

<style scoped>
.app-toast-wrap {
  position: fixed;
  top: 56px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3000;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}
.app-toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 18px;
  border-radius: 10px;
  font-size: 13px;
  color: var(--text);
  background: var(--bg-card);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-md);
}
.toast-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.toast-success .toast-dot { background: var(--success); }
.toast-error .toast-dot { background: var(--danger); }
.toast-info .toast-dot { background: var(--primary); }
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
