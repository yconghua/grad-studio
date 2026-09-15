<template>
  <router-view />
</template>

<script setup>
// 根组件：仅承载路由出口（<router-view />），无任何业务逻辑；
// 具体布局（顶栏 / 侧边导航）由 layouts/HomeLayout.vue 提供。
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
