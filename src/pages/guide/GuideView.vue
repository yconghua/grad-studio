<template>
  <div class="guide-layout">
    <!-- 顶栏：品牌 + 极简头像下拉（引导页导航精简，只保留个人资料 / 退出登录） -->
    <header class="topbar">
      <div class="brand">
        <img :src="logoUrl" class="brand-logo" alt="平台标识" />
        <span class="brand-name">{{ appName }}</span>
      </div>
      <UserAvatarMenu :profile-path="profilePath" minimal />
    </header>

    <!-- 主体：左侧导航（引导说明 / 聊天）+ 右侧内容区 -->
    <div class="body">
      <aside class="side">
        <nav class="nav">
          <router-link
            v-for="item in guideNav"
            :key="item.path"
            :to="item.path"
            class="nav-item"
            active-class="active"
          >
            <span class="nav-label">{{ item.title }}</span>
            <span
              v-if="item.key === chatUnreadBadgeKey && chatUnreadCount > 0"
              class="nav-badge"
            >{{ chatUnreadCount > 99 ? '99+' : chatUnreadCount }}</span>
          </router-link>
        </nav>
        <div class="side-foot">
          <ThemeSwitcher />
        </div>
      </aside>

      <main class="content" :class="{ 'is-chat': isChatPage }">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import UserAvatarMenu from '../../components/layout/UserAvatarMenu.vue'
import ThemeSwitcher from '../../components/layout/ThemeSwitcher.vue'
import { useAppName } from '../../composables/useAppName'
import logoUrl from '../../assets/logo.ico'

// 引导布局（顶栏 + 左导航）：未入组 / 未指定导师 / 组管异常未绑定的兜底外壳，
// 与角色布局同构；导航项 = 引导说明 + 聊天（聊天为全平台功能，未入组同样可用）。
// 聊天未读角标由主进程 ChatPoller 推送 + 挂载时主动拉取（与 RoleLayout 同机制）。
const route = useRoute()
const { appName } = useAppName()

const guideNav = [
  { key: 'guide-home', path: '/guide', title: '引导说明' },
  { key: 'guide-chat', path: '/guide/chat', title: '聊天' }
]

// 聊天页占满内容区：聊天界面自带内部滚动，外层不再滚动
const isChatPage = computed(() => /-chat$/.test(String(route.name || '')))

// 个人资料入口：引导页下拉统一指向引导页风格的个人资料页（无侧栏）
const profilePath = '/guide/profile'

// ===== 聊天未读角标（事件驱动 + 挂载/聚焦时主动拉一次） =====
const chatUnreadBadgeKey = 'guide-chat'
const chatUnreadCount = ref(0)
let unsubChatEvent = null

async function refreshChatUnread() {
  try {
    const res = await window.api.chat.unreadCount()
    if (res && res.success) {
      chatUnreadCount.value = Number((res.data || {}).unreadCount) || 0
    }
  } catch (e) {
    // 拉取失败静默忽略，等待下一次事件推送或聚焦重试
  }
}

function onChatPush(data) {
  if (data && data.unreadTotal !== undefined) {
    chatUnreadCount.value = Number(data.unreadTotal) || 0
  }
}

onMounted(() => {
  refreshChatUnread()
  unsubChatEvent = window.api.chat.onEvent(onChatPush)
})

onUnmounted(() => {
  if (unsubChatEvent) unsubChatEvent()
})
</script>

<style scoped>
.guide-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-page);
}
.topbar {
  flex-shrink: 0;
  height: 56px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.brand-logo {
  width: 30px;
  height: 30px;
  object-fit: contain;
}
.brand-name {
  min-width: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
}
.body {
  flex: 1;
  display: flex;
  min-height: 0;
}
.side {
  width: 220px;
  flex-shrink: 0;
  background: var(--bg-card);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}
.nav {
  flex: 1;
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}
.nav-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-2);
  text-decoration: none;
  transition: background 0.15s;
}
.nav-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nav-badge {
  flex-shrink: 0;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--unread);
  color: var(--on-accent);
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  box-sizing: border-box;
}
.nav-item:hover {
  background: var(--bg-hover);
  color: var(--text);
}
.nav-item.active {
  background: var(--primary-soft);
  color: var(--primary);
  font-weight: 600;
}
.side-foot {
  flex-shrink: 0;
  padding: 10px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: center;
}
.content {
  flex: 1;
  min-width: 0;
  overflow: auto;
}
.content.is-chat {
  overflow: hidden;
}
</style>
