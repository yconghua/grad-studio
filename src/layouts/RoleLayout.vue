<template>
  <div class="role-layout">
    <!-- 顶栏：左侧 logo + 系统名（固定字号完整显示），右侧头像下拉 -->
    <header class="topbar">
      <div class="brand">
        <img :src="logoUrl" class="brand-logo" alt="平台标识" />
        <span class="brand-name">{{ appName }}</span>
      </div>
      <UserAvatarMenu :profile-path="profilePath" :introduction-path="introductionPath" :settings-path="settingsPath" />
    </header>

    <!-- 主体：左侧导航（固定 220px）+ 右侧内容区 -->
    <div class="body">
      <aside class="side">
        <nav class="nav">
          <router-link
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            class="nav-item"
            active-class="active"
          >
            <span class="nav-label">{{ item.title }}</span>
            <span
              v-if="showBadge && item.key === unreadBadgeKey && unreadCount > 0"
              class="nav-badge"
            >{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
            <span
              v-if="showChatBadge && item.key === chatUnreadBadgeKey && chatUnreadCount > 0"
              class="nav-badge"
            >{{ chatUnreadCount > 99 ? '99+' : chatUnreadCount }}</span>
            <span
              v-if="showNotificationBadge && item.key === notificationBadgeKey && notificationUnreadCount > 0"
              class="nav-badge"
            >{{ notificationUnreadCount > 99 ? '99+' : notificationUnreadCount }}</span>
          </router-link>
        </nav>
      </aside>

      <main class="content" :class="{ 'is-chat': isChatPage }">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UserAvatarMenu from '../components/layout/UserAvatarMenu.vue'
import { useAppName } from '../composables/useAppName'
import { useSession } from '../composables/useSession'
import { pathForBiz } from '../config/notificationRoutes'
import logoUrl from '../assets/logo.ico'

// 布局外壳（角色布局共用的框架组件）：
// 导航菜单、工作台/个人资料/设置入口由各角色布局以 props 传入，保证四角色页面相互独立。
// 未读角标：仅导师/学生布局开启 unreadPolling 并指定 unreadBadgeKey（超管/组管不传，
// 只通过已读统计查看），开启后在本层做轻量轮询拉未读数，不依赖消息表 / WebSocket。
const props = defineProps({
  navItems: { type: Array, required: true },
  homePath: { type: String, required: true },
  profilePath: { type: String, required: true },
  introductionPath: { type: String, required: true },
  settingsPath: { type: String, required: true },
  unreadPolling: { type: Boolean, default: false },
  unreadBadgeKey: { type: String, default: '' },
  // 聊天未读角标：传入导航中聊天项的 key 即开启（四个角色都传），
  // 与公告角标并存；数据源为主进程 ChatPoller 推送 + 挂载/聚焦时主动拉取
  chatUnreadBadgeKey: { type: String, default: '' },
  // 通知中心未读角标：传入导航中通知中心项的 key 即开启（四个角色都传），
  // 数据源为主进程 NotificationPoller 推送 + 挂载/聚焦时主动拉取
  notificationBadgeKey: { type: String, default: '' }
})

const route = useRoute()
const router = useRouter()
const { getSessionUser } = useSession()
const { appName } = useAppName()

// 聊天页（* -chat 路由）占满内容区：聊天界面自带内部滚动，外层不再滚动，避免双层滚动条
const isChatPage = computed(() => /-chat$/.test(String(route.name || '')))

// ===== 公告未读角标（轻量轮询，仅导师/学生布局开启） =====
const unreadCount = ref(0)
const showBadge = computed(() => props.unreadPolling && !!props.unreadBadgeKey)

// 当前是否停在课题组公告页（轮询发现新公告时顺带通知页面刷新列表）
const isNoticePage = computed(() => route.path.endsWith('/notices'))

// 拉取一次未读数：服务端按「当前有效课题组 + 已发布 + 无已读记录」计算，
// 换组/离组后下一次拉取即按新组重算；未读数变化且正停在公告页时，
// 派发全局事件让公告页重新拉列表（新公告标为未读展示出来）。
// 服务端返回 { unreadCount, notInGroup }：无组用户恒 0，角标不显示。
async function refreshUnread() {
  if (!showBadge.value) return
  try {
    const res = await window.api.notice.unreadCount()
    if (res && res.success) {
      const d = res.data || {}
      const next = Number(d.unreadCount) || 0
      if (next !== unreadCount.value) {
        unreadCount.value = next
        if (isNoticePage.value) {
          window.dispatchEvent(new CustomEvent('grad-notice-unread-changed'))
        }
      }
    }
  } catch (e) {
    // 拉取失败静默忽略，等待下一次轮询或路由切换重试
  }
}

let timer = null
function onFocus() {
  refreshUnread()
  refreshNotificationUnread()
}

onMounted(() => {
  refreshUnread()
  if (showBadge.value || showNotificationBadge.value) {
    // 轮询间隔 30 秒；窗口重新聚焦、路由切换时也主动拉一次
    timer = setInterval(refreshUnread, 30000)
    window.addEventListener('focus', onFocus)
  }
})

watch(() => route.path, refreshUnread)
// 路由切换时顺带刷新通知角标（点击消息跳转业务页再返回，角标立即更新，不等轮询）
watch(() => route.path, refreshNotificationUnread)

// ===== 聊天未读角标（主进程 ChatPoller 事件驱动 + 挂载/聚焦时主动拉一次） =====
const chatUnreadCount = ref(0)
const showChatBadge = computed(() => !!props.chatUnreadBadgeKey)
let unsubChatEvent = null

async function refreshChatUnread() {
  if (!showChatBadge.value) return
  try {
    const res = await window.api.chat.unreadCount()
    if (res && res.success) {
      chatUnreadCount.value = Number((res.data || {}).unreadCount) || 0
    }
  } catch (e) {
    // 拉取失败静默忽略，等待下一次事件推送或聚焦重试
  }
}

// 事件驱动：ChatPoller 每 2 秒检测共享库变化并推送 unreadTotal，直接更新角标
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

// ===== 通知中心未读角标（主进程 NotificationPoller 事件驱动 + 挂载/聚焦时主动拉一次） =====
const notificationUnreadCount = ref(0)
const showNotificationBadge = computed(() => !!props.notificationBadgeKey)
let unsubNotificationEvent = null

async function refreshNotificationUnread() {
  if (!showNotificationBadge.value) return
  try {
    const res = await window.api.notification.unreadCount()
    if (res && res.success) {
      notificationUnreadCount.value = Number((res.data || {}).unreadCount) || 0
    }
  } catch (e) {
    // 拉取失败静默忽略，等待下一次事件推送或聚焦重试
  }
}

// 事件驱动：NotificationPoller 推送 unreadTotal 更新角标；
// type='navigate'（点击系统通知）时按业务类型跳转对应路由
function onNotificationPush(data) {
  if (!data) return
  if (data.unreadTotal !== undefined) {
    notificationUnreadCount.value = Number(data.unreadTotal) || 0
  }
  if (data.type === 'navigate' && data.bizType) {
    const user = getSessionUser()
    router.push(pathForBiz(data.bizType, user && user.role))
  }
}

onMounted(() => {
  refreshNotificationUnread()
  unsubNotificationEvent = window.api.notification.onEvent(onNotificationPush)
})

onUnmounted(() => {
  if (unsubNotificationEvent) unsubNotificationEvent()
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
  window.removeEventListener('focus', onFocus)
})
</script>

<style scoped>
.role-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f5f7fa;
}
.topbar {
  flex-shrink: 0;
  height: 56px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
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
  color: #1f2329;
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
  background: #fff;
  border-right: 1px solid #e5e7eb;
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
  color: #4b5563;
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
  background: #ef4444;
  color: #fff;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  box-sizing: border-box;
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
.content {
  flex: 1;
  min-width: 0;
  overflow: auto;
}
.content.is-chat {
  overflow: hidden;
}
</style>
