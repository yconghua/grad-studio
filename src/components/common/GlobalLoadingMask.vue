<template>
  <!-- 全屏"数据加载中"遮罩：切换账号等耗时流程期间禁止用户操作 -->
  <div v-if="isLoading" class="global-loading-mask">
    <div class="gl-spinner"></div>
    <div class="gl-text">正在加载数据，请稍候…</div>
  </div>
</template>

<script setup>
import { useGlobalLoading } from '../../composables/useGlobalLoading'

const { isLoading } = useGlobalLoading()
</script>

<style scoped>
.global-loading-mask {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: color-mix(in srgb, var(--bg-page) 78%, transparent);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  cursor: wait;
}
.gl-spinner {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 3px solid color-mix(in srgb, var(--primary) 25%, transparent);
  border-top-color: var(--primary);
  animation: gl-spin 0.9s linear infinite;
}
.gl-text {
  font-size: 14px;
  color: var(--text-2);
}
@keyframes gl-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
