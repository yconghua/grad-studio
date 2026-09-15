<template>
  <div class="profile">
    <!-- 固定头部：页面标题 + 横向页签导航，滚动时钉在内容区顶部不随内容滚走 -->
    <div class="profile-head">
      <h2 class="page-title">个人主页</h2>

      <!-- 横向导航（按角色区分；点击切换路由，子页面由 RouterView 渲染） -->
      <nav class="tab-bar">
        <RouterLink
          v-for="tab in tabs"
          :key="tab.key"
          :to="`/profile/${tab.key}`"
          class="tab-item"
          :class="{ active: isTabActive(tab.key) }"
        >
          {{ tab.label }}
        </RouterLink>
      </nav>
    </div>

    <div class="tab-body">
      <RouterView />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { ROLE_ADMIN } from '../../config/constants'
import { useSession } from '../../composables/useSession'

const route = useRoute()
const { getSessionUser } = useSession()
// 当前登录用户（登录时写入 localStorage；角色用于决定页签显示）
const user = ref(getSessionUser())
const isAdmin = computed(() => user.value?.role === ROLE_ADMIN)

// 横向导航页签：所有用户 = 个人信息 + 网址收藏夹；管理员额外 = 用户管理 + 系统管理（网址收藏夹统一排最后）
const tabs = computed(() => {
  const base = [
    { key: 'info', label: '个人信息' }
  ]
  if (isAdmin.value) {
    base.push({ key: 'users', label: '用户管理' })
    base.push({ key: 'sys', label: '系统管理' })
  }
  base.push({ key: 'weblinks', label: '网址收藏夹' })
  return base
})

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
/* 内容区：独立滚动；隐藏滚动条但保留滚动效果（仅本页生效，其他页面不受影响） */
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
