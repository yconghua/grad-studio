<template>
  <div class="home-layout">
    <!-- 顶部全局导航：品牌 + 全局搜索框 + 消息铃铛 + 头像下拉菜单 -->
    <header class="home-header">
      <div class="brand-wrap">
        <img class="brand-logo" :src="logoUrl" alt="logo" />
        <span class="brand">{{ appName }}</span>
        <button class="collapse-btn" @click="collapsed = !collapsed" title="折叠/展开导航">☰</button>
      </div>

      <div class="header-right">
        <!-- 全局搜索框（骨架：搜索接口待接入，当前提示建设中） -->
        <div class="search-box">
          <input
            v-model="searchKeyword"
            class="search-input"
            placeholder="全局搜索"
            @focus="searchVisible = true"
            @blur="onSearchBlur"
          />
          <div v-if="searchVisible" class="search-panel">
            <div class="search-state">
              {{ searchKeyword.trim() ? '全局搜索功能建设中，将在接口接入后启用。' : '输入关键词进行全局搜索。' }}
            </div>
          </div>
        </div>

        <!-- 站内消息通知铃铛：未读角标 + 点击展开消息面板 -->
        <div class="bell-wrap" ref="bellWrapRef" @click.stop="toggleMsgPanel">
          <span class="bell" title="站内消息">🔔</span>
          <span v-if="msgUnread > 0" class="bell-badge">{{ msgUnread > 99 ? '99+' : msgUnread }}</span>
          <transition name="menu-fade">
            <div v-if="msgPanelOpen" class="msg-panel" @click.stop>
              <div class="msg-panel-header">
                <span class="msg-panel-title">站内消息</span>
                <button class="msg-read-all" @click="onMarkAllRead">全部已读</button>
              </div>
              <div class="msg-list">
                <div v-if="msgLoading" class="msg-empty">加载中…</div>
                <div v-else-if="!msgList.length" class="msg-empty">暂无消息</div>
                <div
                  v-for="m in msgList"
                  :key="m.id"
                  class="msg-item"
                  :class="{ unread: m.status === 'unread' }"
                  @click="onMsgItemClick(m)"
                >
                  <div class="msg-item-title">{{ m.title || '系统消息' }}</div>
                  <div class="msg-item-content">{{ m.content || '' }}</div>
                  <div class="msg-item-time">{{ formatTime(m.created_at) }}</div>
                </div>
              </div>
            </div>
          </transition>
        </div>

        <!-- 头像下拉菜单：个人资料 / 修改密码 / 使用帮助 / 退出登录 -->
        <div class="user-menu" ref="userMenuRef" @click="userMenuOpen = !userMenuOpen">
          <span class="user-avatar">{{ avatarText }}</span>
          <span v-if="!collapsed" class="user-name">{{ currentUser?.username || '未登录' }}</span>
          <span class="user-caret" :class="{ open: userMenuOpen }">▾</span>

          <transition name="menu-fade">
            <div v-if="userMenuOpen" class="user-dropdown" @click.stop>
              <RouterLink class="dropdown-item" to="/profile" @click="userMenuOpen = false">个人资料</RouterLink>
              <RouterLink class="dropdown-item" to="/profile/password" @click="userMenuOpen = false">修改密码</RouterLink>
              <RouterLink class="dropdown-item" to="/help" @click="userMenuOpen = false">使用帮助</RouterLink>
              <div class="dropdown-divider"></div>
              <button class="dropdown-item danger" @click="onLogout">退出登录</button>
            </div>
          </transition>
        </div>
      </div>
    </header>

    <!-- 中间主体：左侧动态权限菜单 + 右侧内容区 -->
    <div class="home-body">
      <nav class="home-nav" :class="{ collapsed: collapsed }">
        <RouterLink
          v-for="item in visibleMenus"
          :key="item.key"
          :to="menuPath(item)"
          class="nav-item"
          :class="{ 'router-link-active': isActive(item) }"
          :title="item.title"
        >
          <span class="nav-icon">{{ menuIcon(item) }}</span>
          <span v-if="!collapsed" class="nav-item-title">{{ item.title }}</span>
          <span v-if="!collapsed && menuBadge(item)" class="nav-badge">{{ menuBadge(item) }}</span>
        </RouterLink>
      </nav>

      <main class="home-content">
        <RouterView />
      </main>
    </div>

    <footer class="home-footer">{{ appName }}</footer>

    <!-- 退出登录确认 -->
    <div v-if="showConfirm" class="modal-mask" @click.self="cancelLogout">
      <div class="modal-box">
        <p class="modal-text">确定要退出登录吗？</p>
        <div class="modal-actions">
          <button class="modal-btn cancel" @click="cancelLogout" :disabled="exiting">取消</button>
          <button class="modal-btn ok" @click="confirmLogout" :disabled="exiting">{{ exiting ? '退出中…' : '确定退出' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  logout,
  getMessageUnreadCount,
  listMyMessages,
  markMessageRead,
  markAllMessagesRead,
  getNoticeUnreadCount
} from '../api'
import { visibleNavItems } from '../config/navConfig'
import { useSession } from '../composables/useSession'
import { useGroupContext } from '../composables/useGroupContext'
import logoUrl from '../assets/logo.ico'

const { clearSession, getSessionUser } = useSession()
const { currentGroupId } = useGroupContext()

const currentUser = getSessionUser()
const router = useRouter()
const route = useRoute()

// 系统名称：可随时调整
const appName = '课题组科研管理平台'

const collapsed = ref(false)
const showConfirm = ref(false)
const exiting = ref(false)

// ===== 侧边菜单：按当前角色动态过滤（动态权限渲染） =====
const visibleMenus = computed(() => visibleNavItems(currentUser?.role || ''))

// 菜单项路由路径：platform-xxx → /platform/xxx，其余 → /xxx
function menuPath(item) {
  return item.key.indexOf('platform-') === 0
    ? '/platform/' + item.key.replace('platform-', '')
    : '/' + item.key
}

// 当前路由高亮：精确匹配或前缀匹配
function isActive(item) {
  const p = menuPath(item)
  return route.path === p || route.path.startsWith(p + '/')
}

// 菜单角标（未读红点等）：当前仅课题组公告预留。
// 接入方式：后续公告接口就绪后，通过公告未读接口刷新，
// 返回值 > 0 时显示数字角标，未读数归零后自动隐藏。
function menuBadge(item) {
  if (item.key === 'notice') {
    return noticeUnread.value > 0 ? noticeUnread.value : null
  }
  return null
}

// 公告未读数（预留，默认 0；后续由公告未读接口驱动）
const noticeUnread = ref(0)

// ===== 菜单图标：Ant Design Vue 图标名（navConfig.icon）→ 当前占位渲染 =====
// 说明：icon 字段已按 @ant-design/icons-vue 的图标名配置；
// 安装依赖后，将下方 emoji 映射替换为图标组件解析（如 <component :is="AntdIcons[name]" />）。
const MENU_ICON_FALLBACK = {
  workbench: '🏠', notice: '📢', member: '👥', students: '🎓', degree: '🗓️',
  meeting: '📅', subject: '🔬', task: '✅', 'research-record': '📝', 'my-work': '📋',
  achievement: '🏆', literature: '📚', archive: '📂', knowledge: '📖', 'ai-assistant': '🤖',
  settings: '⚙️', 'platform-users': '👤', 'platform-groups': '🏢',
  'platform-config': '🔧', 'platform-logs': '🕐', 'platform-help': '❓'
}
function menuIcon(item) {
  return MENU_ICON_FALLBACK[item.key] || '📄'
}

// ===== 顶部：头像与下拉 =====
const userMenuRef = ref(null)
const userMenuOpen = ref(false)
const avatarText = computed(() => {
  const name = currentUser?.username || '?'
  return name.charAt(0).toUpperCase()
})

// 点击页面其他区域关闭下拉与消息面板
function onDocClick(e) {
  if (userMenuRef.value && !userMenuRef.value.contains(e.target)) {
    userMenuOpen.value = false
  }
  if (bellWrapRef.value && !bellWrapRef.value.contains(e.target)) {
    msgPanelOpen.value = false
  }
}

// ===== 顶部：消息铃铛 =====
const bellWrapRef = ref(null)
const msgPanelOpen = ref(false)
const msgUnread = ref(0)
const msgList = ref([])
const msgLoading = ref(false)
let msgTimer = null

async function fetchMsgUnread() {
  try {
    const res = await getMessageUnreadCount()
    if (res && res.success) msgUnread.value = (res.data && res.data.total) || 0
  } catch (e) {}
}

async function fetchNoticeUnread() {
  if (!currentGroupId.value) { noticeUnread.value = 0; return }
  try {
    const res = await getNoticeUnreadCount(currentGroupId.value)
    noticeUnread.value = (res && res.success && res.count) || 0
  } catch (e) { noticeUnread.value = 0 }
}

async function fetchMessages() {
  msgLoading.value = true
  try {
    const res = await listMyMessages({})
    msgList.value = (res && res.success && res.data) || []
  } catch (e) { msgList.value = [] } finally { msgLoading.value = false }
}

function toggleMsgPanel() {
  msgPanelOpen.value = !msgPanelOpen.value
  if (msgPanelOpen.value) fetchMessages()
}

async function onMarkAllRead() {
  try {
    await markAllMessagesRead()
    msgList.value = msgList.value.map((m) => ({ ...m, status: 'read' }))
    msgUnread.value = 0
  } catch (e) {}
}

const REF_ROUTE_MAP = { notice: '/notice', task: '/task', achievement: '/achievement' }

async function onMsgItemClick(m) {
  if (m.status === 'unread') {
    try { await markMessageRead(m.id) } catch (e) {}
    m.status = 'read'
    msgUnread.value = Math.max(0, msgUnread.value - 1)
  }
  msgPanelOpen.value = false
  const target = REF_ROUTE_MAP[m.ref_type]
  if (target) router.push(target)
}

function formatTime(t) {
  if (!t) return ''
  const d = new Date(t)
  if (isNaN(d.getTime())) return String(t)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ===== 顶部：全局搜索（骨架） =====
const searchKeyword = ref('')
const searchVisible = ref(false)
function onSearchBlur() {
  setTimeout(() => { searchVisible.value = false }, 150)
}

// ===== 退出登录 =====
function onLogout() {
  exiting.value = false
  showConfirm.value = true
}
function cancelLogout() {
  if (exiting.value) return
  showConfirm.value = false
}
async function confirmLogout() {
  if (exiting.value) return
  exiting.value = true
  await new Promise((resolve) => setTimeout(resolve, 600))
  showConfirm.value = false
  exiting.value = false
  try { await logout() } catch (e) {}
  clearSession()
  router.push('/login')
}

watch(currentGroupId, () => { fetchNoticeUnread() })
window.addEventListener('notice-unread-changed', fetchNoticeUnread)

onMounted(() => {
  document.addEventListener('click', onDocClick)
  fetchMsgUnread()
  fetchNoticeUnread()
  msgTimer = setInterval(() => {
    fetchMsgUnread()
    fetchNoticeUnread()
  }, 60000)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  window.removeEventListener('notice-unread-changed', fetchNoticeUnread)
  if (msgTimer) clearInterval(msgTimer)
})
</script>

<style scoped>
.home-layout { height: 100%; display: flex; flex-direction: column; }
/* ===== 顶部导航 ===== */
.home-header {
  height: 56px; flex: 0 0 56px;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 20px; background: #fff; border-bottom: 1px solid #eceff3;
  position: relative; z-index: 20;
}
.brand-wrap { display: flex; align-items: center; gap: 10px; }
.brand-logo { width: 26px; height: 26px; object-fit: contain; }
.brand { font-size: 15px; font-weight: 600; white-space: nowrap; }
.collapse-btn {
  width: 28px; height: 28px; border: 1px solid #dfe3e8; border-radius: 6px;
  background: #fff; cursor: pointer; font-size: 14px; color: #4e5969;
  display: inline-flex; align-items: center; justify-content: center; margin-left: 4px;
}
.collapse-btn:hover { border-color: #0d80e0; color: #0d80e0; }

.header-right { display: flex; align-items: center; gap: 18px; }

/* 全局搜索 */
.search-box { position: relative; display: flex; align-items: center; }
.search-input {
  width: 240px; height: 34px; padding: 0 12px; font-size: 13px;
  border: 1px solid #dfe3e8; border-radius: 8px; outline: none; background: #f5f7fa;
}
.search-input:focus { border-color: #0d80e0; background: #fff; }
.search-panel {
  position: absolute; top: 40px; right: 0; width: 300px;
  background: #fff; border: 1px solid #eceff3; border-radius: 10px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.14); z-index: 300; padding: 12px;
}
.search-state { text-align: center; font-size: 12px; color: #b8bec4; line-height: 1.7; padding: 8px 0; }

/* 消息铃铛 */
.bell-wrap { position: relative; cursor: pointer; display: inline-flex; align-items: center; }
.bell { font-size: 18px; user-select: none; }
.bell-badge {
  position: absolute; top: -6px; right: -10px; min-width: 16px; height: 16px;
  line-height: 16px; padding: 0 4px; border-radius: 999px;
  background: #ea4335; color: #fff; font-size: 10px; text-align: center;
  box-sizing: content-box;
}
.msg-panel {
  position: absolute; top: 40px; right: 0; width: 320px;
  background: #fff; border: 1px solid #eceff3; border-radius: 10px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.14); z-index: 400;
  display: flex; flex-direction: column; overflow: hidden;
}
.msg-panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; border-bottom: 1px solid #eceff3;
}
.msg-panel-title { font-size: 13px; font-weight: 600; color: #1f2329; }
.msg-read-all {
  border: none; background: transparent; color: #0d80e0;
  font-size: 12px; cursor: pointer; padding: 0;
}
.msg-read-all:hover { text-decoration: underline; }
.msg-list { max-height: 400px; overflow-y: auto; }
.msg-empty { padding: 28px 0; text-align: center; font-size: 12px; color: #b8bec4; }
.msg-item { padding: 10px 14px; cursor: pointer; border-bottom: 1px solid #f2f4f7; }
.msg-item:last-child { border-bottom: none; }
.msg-item:hover { background: #f7f9fc; }
.msg-item.unread { background: #eef6ff; }
.msg-item.unread:hover { background: #e3f0ff; }
.msg-item-title { font-size: 13px; color: #1f2329; font-weight: 500; margin-bottom: 3px; }
.msg-item.unread .msg-item-title::before {
  content: ''; display: inline-block; width: 6px; height: 6px;
  border-radius: 50%; background: #ea4335; margin-right: 6px;
  vertical-align: middle;
}
.msg-item-content {
  font-size: 12px; color: #4e5969; line-height: 1.5;
  overflow: hidden; text-overflow: ellipsis; display: -webkit-box;
  -webkit-line-clamp: 2; -webkit-box-orient: vertical; margin-bottom: 4px;
}
.msg-item-time { font-size: 11px; color: #8a9099; }

/* 头像下拉菜单 */
.user-menu {
  position: relative; display: inline-flex; align-items: center; gap: 8px;
  padding: 4px 10px 4px 4px; border-radius: 20px; cursor: pointer;
  transition: background 0.2s; user-select: none;
}
.user-menu:hover { background: #f5f7fa; }
.user-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  color: #fff; font-size: 14px; font-weight: 600;
  display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.user-name { font-size: 13px; color: #1f2329; font-weight: 500; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.user-caret { font-size: 11px; color: #8a9099; transition: transform 0.2s; }
.user-caret.open { transform: rotate(180deg); }
.user-dropdown {
  position: absolute; top: 42px; right: 0; min-width: 150px;
  background: #fff; border: 1px solid #eceff3; border-radius: 10px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.14); padding: 6px; z-index: 400;
}
.dropdown-item {
  display: block; width: 100%; text-align: left;
  padding: 9px 14px; border: none; border-radius: 8px;
  font-size: 13px; color: #1f2329; background: transparent;
  cursor: pointer; text-decoration: none; box-sizing: border-box;
}
.dropdown-item:hover { background: #f5f8ff; color: #0d80e0; }
.dropdown-item.danger:hover { background: #fff1f0; color: #ea4335; }
.dropdown-divider { height: 1px; background: #eceff3; margin: 5px 0; }
.menu-fade-enter-active, .menu-fade-leave-active { transition: opacity 0.15s, transform 0.15s; }
.menu-fade-enter-from, .menu-fade-leave-to { opacity: 0; transform: translateY(-4px); }

/* ===== 主体 ===== */
.home-body { flex: 1 1 auto; display: flex; min-height: 0; }
.home-nav {
  flex: 0 0 200px; width: 200px;
  background: #fff; border-right: 1px solid #eceff3;
  padding: 12px 0; display: flex; flex-direction: column; gap: 2px; overflow-y: auto;
  transition: width 0.2s, flex-basis 0.2s;
}
.home-nav.collapsed { flex: 0 0 60px; width: 60px; }
.nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 11px 20px; margin: 0 10px; border-radius: 8px;
  font-size: 14px; color: #4e5969; text-decoration: none;
  transition: all 0.15s;
}
.home-nav.collapsed .nav-item { padding: 11px 0; justify-content: center; margin: 0 6px; }
.nav-item:hover { background: #f5f7fa; }
.nav-item.router-link-active {
  color: #0d80e0; background: #eef6ff; font-weight: 600;
}
.nav-icon { font-size: 16px; flex-shrink: 0; width: 20px; text-align: center; }
.nav-item-title { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nav-badge {
  flex: 0 0 auto; min-width: 18px; height: 18px; line-height: 18px;
  padding: 0 5px; border-radius: 999px; text-align: center;
  background: #ea4335; color: #fff; font-size: 11px;
}

.home-content { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 20px; background: #f5f7fa; }
.home-footer {
  flex: 0 0 auto; text-align: center; padding: 8px 0;
  font-size: 13px; color: #8a9099; background: #fff; border-top: 1px solid #eceff3;
}

/* ===== 退出确认弹窗 ===== */
.modal-mask {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal-box {
  width: 300px; background: #fff; border-radius: 12px;
  padding: 24px; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18); text-align: center;
}
.modal-text { font-size: 15px; margin: 0 0 20px; color: #1f2329; }
.modal-actions { display: flex; gap: 12px; }
.modal-btn { flex: 1; height: 38px; border-radius: 8px; font-size: 14px; cursor: pointer; border: 1px solid #dfe3e8; }
.modal-btn.cancel { background: #fff; color: #4e5969; }
.modal-btn.ok { background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%); border: none; color: #fff; font-weight: 600; }
.modal-btn:disabled { opacity: 0.45; cursor: not-allowed; }
</style>
