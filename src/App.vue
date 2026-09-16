<template>
  <router-view />
  <!-- 全局代码内弹窗（替代 window.alert / confirm / prompt 系统弹窗） -->
  <AppDialog />
</template>

<script setup>
import AppDialog from './components/AppDialog.vue'
// 根组件：承载路由出口 + 全局弹窗；具体布局由 layouts/HomeLayout.vue 提供。
</script>

<style>
/* 全局基础样式（非 scoped） */
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
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
    'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  color: #1f2329;
  background: #f5f7fa;
}
</style>
