<template>
  <div class="theme-switcher">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      class="ts-item"
      :class="{ active: mode === opt.value }"
      :title="opt.label"
      @click="setTheme(opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<script setup>
import { useTheme } from '../../composables/useTheme'

// 主题切换器：三态（亮 / 暗 / 跟随系统），只写本地偏好，不承载业务
const { mode, setTheme } = useTheme()
const options = [
  { value: 'light', label: '亮' },
  { value: 'dark', label: '暗' },
  { value: 'system', label: '跟随' }
]
</script>

<style scoped>
.theme-switcher {
  display: flex;
  gap: 2px;
  padding: 2px;
  background: var(--bg-hover);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
}
.ts-item {
  border: none;
  background: none;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: 12px;
  color: var(--text-2);
  cursor: pointer;
}
.ts-item:hover {
  color: var(--text);
}
.ts-item.active {
  background: var(--bg-card);
  color: var(--primary);
  box-shadow: var(--shadow-sm);
  font-weight: 600;
}
</style>
