<template>
  <div class="placeholder">
    <div class="placeholder-icon">📄</div>
    <h2 class="placeholder-title">{{ title }}</h2>
    <p class="placeholder-desc">「{{ title }}」页面正在建设中，敬请期待。</p>
  </div>
</template>

<script setup>
// 通用占位页：所有二级导航与个人主页页签在接入真实内容前统一指向本组件，
// 页面标题取自路由 meta.title（由 navConfig 生成路由时写入）。
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const title = computed(() => route.meta.title || '页面')
</script>

<style scoped>
.placeholder {
  height: 100%;
  min-height: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
  background: #fff;
  border: 1px solid #eceff3;
  border-radius: 12px;
  padding: 40px 24px;
}
.placeholder-icon {
  font-size: 44px;
  line-height: 1;
}
.placeholder-title {
  margin: 8px 0 0;
  font-size: 20px;
  font-weight: 700;
  color: #1f2329;
}
.placeholder-desc {
  margin: 0;
  font-size: 14px;
  color: #8a9099;
}
</style>
