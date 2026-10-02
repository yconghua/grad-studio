<template>
  <router-view />
  <!-- 全局代码内弹窗（替代 window.alert / confirm / prompt 系统弹窗） -->
  <AppDialog />
</template>

<script setup>
import { AppDialog } from './components/dialogs'
// 根组件：承载路由出口 + 全局弹窗；具体布局由各角色布局（layouts/*Layout.vue）提供。
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
