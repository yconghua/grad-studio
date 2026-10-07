<template>
  <div v-if="loading" class="lls lls-loading">加载中…</div>
  <div v-else-if="error" class="lls lls-error">
    <span>{{ error }}</span>
    <button type="button" class="lls-retry" @click="onRetry">重试</button>
  </div>
  <div v-else-if="empty" class="lls lls-empty">{{ emptyText || '暂无数据' }}</div>
</template>

<script setup>
// 统一列表加载三态：加载中 / 加载失败（带重试）/ 空态。
// 使用方把 loading / error / empty 三个布尔值传入，空态文案可自定义；
// 重试按钮回调 onRetry 由使用方绑定（通常是重新调用加载函数）。
defineProps({
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  empty: { type: Boolean, default: false },
  emptyText: { type: String, default: '' },
  onRetry: { type: Function, default: null }
})
</script>

<style scoped>
.lls {
  font-size: 13px;
  line-height: 1.8;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  text-align: center;
}
.lls-loading {
  color: var(--muted);
}
.lls-error {
  color: var(--danger);
  background: var(--danger-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.lls-retry {
  height: 26px;
  padding: 0 14px;
  border: 1px solid var(--danger-border);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  color: var(--danger);
  font-size: 12px;
  cursor: pointer;
}
.lls-retry:hover {
  background: var(--danger-soft);
}
.lls-empty {
  color: var(--muted);
}
</style>
