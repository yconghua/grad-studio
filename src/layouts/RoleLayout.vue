<template>
  <div class="role-layout">
    <!-- 左侧：品牌 + 导航菜单（导航配置由各角色布局传入，互不共用） -->
    <aside class="side">
      <div class="brand">
        <img :src="logoUrl" class="brand-logo" alt="平台标识" />
        <span class="brand-name">{{ appName }}</span>
      </div>
      <nav class="nav">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          active-class="active"
        >
          {{ item.title }}
        </router-link>
      </nav>
      <div class="side-foot">Gra Studio · 课题组科研管理平台</div>
    </aside>

    <!-- 右侧：顶栏（页面标题 + 头像下拉）+ 内容区 -->
    <div class="main">
      <header class="topbar">
        <div class="crumb">{{ pageTitle }}</div>
        <UserAvatarMenu :profile-path="profilePath" :introduction-path="introductionPath" :settings-path="settingsPath" />
      </header>
      <main class="content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import UserAvatarMenu from '../components/layout/UserAvatarMenu.vue'
import { useAppName } from '../composables/useAppName'
import logoUrl from '../assets/logo.ico'

// 布局外壳（角色布局共用的框架组件）：
// 导航菜单、工作台/个人资料/设置入口由各角色布局以 props 传入，保证四角色页面相互独立。
const props = defineProps({
  navItems: { type: Array, required: true },
  homePath: { type: String, required: true },
  profilePath: { type: String, required: true },
  introductionPath: { type: String, required: true },
  settingsPath: { type: String, required: true }
})

const route = useRoute()
const { appName } = useAppName()

// 顶栏标题：优先取路由 meta.title，未配置时回退菜单第一项标题
const pageTitle = computed(() => {
  const t = route.meta && route.meta.title
  if (t) return t
  return (props.navItems[0] && props.navItems[0].title) || ''
})
</script>

<style scoped>
.role-layout {
  display: flex;
  height: 100%;
  background: #f5f7fa;
}
.side {
  width: 220px;
  flex-shrink: 0;
  background: #fff;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 18px;
  border-bottom: 1px solid #eef0f3;
}
.brand-logo {
  width: 30px;
  height: 30px;
  object-fit: contain;
}
.brand-name {
  font-size: 15px;
  font-weight: 700;
  color: #1f2329;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nav {
  flex: 1;
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.nav-item {
  display: block;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 14px;
  color: #4b5563;
  text-decoration: none;
  transition: background 0.15s;
}
.nav-item:hover {
  background: #f5f7fa;
  color: #1f2329;
}
.nav-item.active {
  background: #eef2ff;
  color: #4f6ef7;
  font-weight: 600;
}
.side-foot {
  padding: 12px 18px;
  font-size: 12px;
  color: #9aa1ac;
  border-top: 1px solid #eef0f3;
}
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.topbar {
  height: 56px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}
.crumb {
  font-size: 15px;
  font-weight: 600;
  color: #1f2329;
}
.content {
  flex: 1;
  overflow: auto;
}
</style>
