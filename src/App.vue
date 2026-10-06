<template>
  <router-view />
  <!-- 全局代码内弹窗（替代 window.alert / confirm / prompt 系统弹窗） -->
  <AppDialog />
  <!-- 全局轻量提示（非阻塞，3 秒自动消失） -->
  <AppToast />
</template>

<script setup>
import { onMounted } from 'vue'
import { AppDialog } from './components/dialogs'
import AppToast from './components/common/AppToast.vue'
import { applyInitialFontScale } from './composables/useFontScale'
import { useAutoRefresh } from './composables/useAutoRefresh'
// 根组件：承载路由出口 + 全局弹窗；具体布局由各角色布局（layouts/*Layout.vue）提供。

onMounted(applyInitialFontScale)
// 超管改全局默认字号后，无个人字号设置的账号立即跟随（个人设置优先，不受影响）
useAutoRefresh(applyInitialFontScale)
</script>

<style>
/* 全局基础样式（非 scoped）：颜色/字体全部引用设计令牌 */
* {
  box-sizing: border-box;
}
html,
body,
#app {
  height: 100%;
  margin: 0;
  padding: 0;
}
body {
  font-family: var(--font-family);
  color: var(--text);
  background: var(--bg-page);
}
</style>
