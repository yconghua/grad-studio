<template>
  <div class="role-layout">
    <!-- 无边框窗口自绘标题栏（拖拽 + 最小化/关闭） -->
    <AppTitleBar />

    <!-- 顶栏：左侧 logo + 系统名 + 汉堡按钮，右侧头像下拉 -->
    <header class="topbar">
      <div class="brand">
        <img :src="logoUrl" class="brand-logo" alt="平台标识" />
        <span class="brand-name">{{ appName }}</span>
        <!-- 导航栏收起/展开开关（状态记忆 localStorage） -->
        <button
          class="side-toggle"
          type="button"
          :title="sideCollapsed ? '展开导航栏' : '收起导航栏'"
          @click="toggleSide"
        >
          <MenuFoldOutlined v-if="!sideCollapsed" />
          <MenuUnfoldOutlined v-else />
        </button>
      </div>
      <GlobalSearch />
      <UserAvatarMenu :profile-path="profilePath" :introduction-path="introductionPath" :settings-path="settingsPath" />
    </header>

    <!-- 主体：左侧导航（可拖动调宽，可整体收起）+ 右侧内容区（标签栏 + 页面内容） -->
    <div class="body">
      <aside
        class="side"
        :class="{ collapsed: sideCollapsed }"
        :style="{ width: (sideCollapsed ? SIDE_COLLAPSED_WIDTH : sideWidth) + 'px' }"
      >
        <nav class="nav">
          <router-link
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            class="nav-item"
            active-class="active"
          >
            <component :is="navIcons[item.icon]" class="nav-icon" v-if="navIcons[item.icon]" />
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
        <div class="side-foot">
          <ThemeSwitcher />
        </div>
        <!-- 右侧拖拽条：左右拖动调整导航栏宽度（收起时隐藏） -->
        <div v-if="!sideCollapsed" class="side-resizer" title="拖动调整导航栏宽度" @mousedown="onResizeStart"></div>
      </aside>

      <!-- 右侧列：标签栏 + 页面内容，标签栏只占内容区宽度、不占用左侧导航栏 -->
      <div class="main-col">
        <!-- 标签栏：浏览器风格多标签页（打开/关闭/拖拽排序，固定工作台标签在最前） -->
        <TabBar />
        <main class="content" :class="{ 'is-chat': isChatPage }">
          <router-view />
        </main>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UserAvatarMenu from '../components/layout/UserAvatarMenu.vue'
import ThemeSwitcher from '../components/layout/ThemeSwitcher.vue'
import AppTitleBar from '../components/layout/AppTitleBar.vue'
import TabBar from '../components/layout/TabBar.vue'
import GlobalSearch from '../components/layout/GlobalSearch.vue'
import { useAutoRefresh } from '../composables/useAutoRefresh'
// 导航图标按配置里的 icon 名映射（配置保持纯数据，图标集中在此注册）
import {
  DashboardOutlined,
  BellOutlined,
  TeamOutlined,
  UserOutlined,
  ApartmentOutlined,
  NotificationOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  FileTextOutlined,
  SettingOutlined,
  MessageOutlined,
  EditOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined
} from '@ant-design/icons-vue'
import { useAppName } from '../composables/useAppName'
import { useSession } from '../composables/useSession'
import { pathForBiz } from '../config/notificationRoutes'
import logoUrl from '../assets/logo.ico'

// 导航项 icon 名字符串 → 图标组件（缺失时该项不渲染图标，不影响布局）
const navIcons = {
  DashboardOutlined,
  BellOutlined,
  TeamOutlined,
  UserOutlined,
  ApartmentOutlined,
  NotificationOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  FileTextOutlined,
  SettingOutlined,
  MessageOutlined,
  EditOutlined
}

// 汉堡按钮：收起/展开导航栏（状态记忆 localStorage，启动时恢复）
const SIDE_COLLAPSED_KEY = 'gra_studio_side_collapsed'
let savedCollapsed = false
try {
  savedCollapsed = localStorage.getItem(SIDE_COLLAPSED_KEY) === '1'
} catch (e) {
  // 读取失败默认展开
}
const sideCollapsed = ref(savedCollapsed)

function toggleSide() {
  sideCollapsed.value = !sideCollapsed.value
  try {
    localStorage.setItem(SIDE_COLLAPSED_KEY, sideCollapsed.value ? '1' : '0')
  } catch (e) {
    // 存储失败静默，状态仅本次会话生效
  }
}

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

// ===== 左侧导航栏宽度（可拖动调整，localStorage 记忆） =====
const SIDE_MIN = 160
const SIDE_MAX = 360
// 收起态宽度：只保留一条图标栏（文字隐藏、角标保留）
const SIDE_COLLAPSED_WIDTH = 56
const SIDE_STORAGE_KEY = 'gra_studio_side_width'
let savedSideWidth = 0
try {
  savedSideWidth = parseInt(localStorage.getItem(SIDE_STORAGE_KEY) || '', 10) || 0
} catch (e) {
  // 读取失败沿用默认宽度
}
// 默认导航栏宽度（可拖动调整，localStorage 记忆）；
// 旧默认值 220 视为未自定义，直接采用新默认 200
const SIDE_DEFAULT = 200
const sideWidth = ref(savedSideWidth >= SIDE_MIN && savedSideWidth <= SIDE_MAX && savedSideWidth !== 220 ? savedSideWidth : SIDE_DEFAULT)

let resizing = false
let resizeStartX = 0
let resizeStartWidth = 0

// 按下拖拽条开始：记录起点，挂全局移动/松开监听
function onResizeStart(e) {
  resizing = true
  resizeStartX = e.clientX
  resizeStartWidth = sideWidth.value
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'
  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeEnd)
  e.preventDefault()
}

// 拖动中：按鼠标横向位移更新宽度，限制在 [SIDE_MIN, SIDE_MAX]
function onResizeMove(e) {
  if (!resizing) return
  const next = resizeStartWidth + (e.clientX - resizeStartX)
  sideWidth.value = Math.min(SIDE_MAX, Math.max(SIDE_MIN, next))
}

// 松开结束：移除监听并保存宽度
function onResizeEnd() {
  if (!resizing) return
  resizing = false
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
  try {
    localStorage.setItem(SIDE_STORAGE_KEY, String(sideWidth.value))
  } catch (e) {
    // 存储失败静默，宽度仅本次会话生效
  }
}

onUnmounted(() => {
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
})

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

// 订阅全局刷新：公告页写操作（一键已读等）广播后立即重拉角标，不等 30s 轮询
useAutoRefresh(refreshUnread)

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
    router.push(pathForBiz(data.bizType, user && user.role, data.bizId))
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
.side-toggle {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-2);
  font-size: 15px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}
.side-toggle:hover {
  background: var(--bg-hover);
  color: var(--text);
}
.body {
  flex: 1;
  display: flex;
  min-height: 0;
}
.main-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.side {
  position: relative;
  width: 200px;
  flex-shrink: 0;
  background: var(--bg-card);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  transition: width 0.2s ease;
}
.side.collapsed {
  overflow: hidden;
  border-right: none;
}
/* 收起态：图标条模式——导航项只留图标居中，文字隐藏，角标贴图标右上角 */
.side.collapsed .nav {
  padding: 12px 8px;
}
.side.collapsed .nav-item {
  position: relative;
  justify-content: center;
  padding: 10px 0;
}
.side.collapsed .nav-label {
  display: none;
}
.side.collapsed .nav-badge {
  position: absolute;
  top: 4px;
  right: 2px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  font-size: 10px;
  line-height: 16px;
  box-sizing: border-box;
}
.side.collapsed .side-foot {
  display: none;
}
.side-resizer {
  position: absolute;
  top: 0;
  right: -3px;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  z-index: 20;
}
.side-resizer:hover {
  background: var(--primary-soft);
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
.nav-icon {
  flex-shrink: 0;
  font-size: 16px;
  color: var(--text-3);
}
.nav-item:hover .nav-icon,
.nav-item.active .nav-icon {
  color: inherit;
}
.nav-label {
  min-width: 0;
  flex: 1;
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
