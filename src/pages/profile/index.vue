<template>
  <div class="profile">
    <!-- 固定头部：页面标题 + 横向页签导航，滚动时钉在内容区顶部不随内容滚走 -->
    <div class="profile-head">
      <h2 class="page-title">个人主页</h2>

      <!-- 横向导航（点击切换路由，子页面由 RouterView 渲染） -->
      <nav class="tab-bar">
        <RouterLink
          v-for="tab in profileNavItems"
          :key="tab.key"
          :to="`/profile/${tab.key}`"
          class="tab-item"
          :class="{ active: isTabActive(tab.key) }"
        >
          {{ tab.title }}
        </RouterLink>
      </nav>
    </div>

    <div class="tab-body">
      <RouterView />
    </div>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { profileNavItems } from '../../config/navConfig'

const route = useRoute()

// 页签高亮：按当前路由精确匹配（直达 URL / 刷新后依然正确）
function isTabActive(key) {
  return route.path === `/profile/${key}`
}
</script>

<style scoped>
/* 整页高度撑满内容区：头部固定 + 内容区自行滚动（不触发外层 .home-content 滚动条） */
.profile {
  height: 100%;
  display: flex;
  flex-direction: column;
}
/* 固定头部：标题 + 页签导航不参与滚动（滚动只发生在下方 .tab-body） */
.profile-head {
  flex: 0 0 auto;
}
.page-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 16px;
}
/* 横向导航（页签） */
.tab-bar {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid #eceff3;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.tab-item {
  display: inline-block;
  padding: 10px 18px;
  font-size: 14px;
  color: #4e5969;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 0.2s;
  text-decoration: none;
}
.tab-item:hover {
  color: #0d80e0;
}
.tab-item.active {
  color: #0d80e0;
  border-bottom-color: #0d80e0;
  font-weight: 600;
}
/* 内容区：独立滚动；隐藏滚动条但保留滚动效果（仅本页生效） */
.tab-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;    /* Firefox */
  -ms-overflow-style: none; /* 旧版 Edge/IE */
}
.tab-body::-webkit-scrollbar {
  display: none;            /* Chrome / Edge / Safari */
}
</style>
