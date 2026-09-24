<template>
  <div class="home-layout">
    <!-- 顶部标题栏 -->
    <header class="home-header">
      <div class="brand-wrap">
        <img class="brand-logo" :src="logoUrl" alt="logo" />
        <span class="brand">研究生工作室管理平台</span>
        <button class="collapse-btn" @click="collapsed = !collapsed" title="折叠/展开导航">☰</button>
        <!-- 面包屑：大导航 > 小导航，均可点击 -->
        <nav class="breadcrumb" v-if="breadcrumb.length">
          <template v-for="(bc, i) in breadcrumb" :key="i">
            <RouterLink v-if="bc.to !== route.path" class="crumb-link" :to="bc.to">
              <span class="crumb-icon">{{ bc.icon }}</span>{{ bc.title }}
            </RouterLink>
            <span v-else class="crumb-current">
              <span class="crumb-icon">{{ bc.icon }}</span>{{ bc.title }}
            </span>
            <span v-if="i < breadcrumb.length - 1" class="crumb-sep">›</span>
          </template>
        </nav>
      </div>
      <div class="header-right">
        <span class="clock">{{ clock }}</span>
        <span class="bell" @click="goMessages" title="消息中心">🔔<span v-if="unread > 0" class="bell-badge">{{ unread > 99 ? "99+" : unread }}</span></span>
        <RouterLink v-if="currentUser?.username" to="/profile" class="user-entry" title="进入个人主页">
          <span class="user-avatar">{{ avatarText }}</span>
          <span v-if="!collapsed" class="user-name">{{ currentUser?.username }}</span>
        </RouterLink>
        <button class="logout-btn" @click="onLogout">退出登录</button>
      </div>
    </header>

    <!-- 中间主体 -->
    <div class="home-body">
      <nav class="home-nav" :class="{ collapsed: collapsed }">

        <div v-for="group in visibleGroups" :key="group.key" class="nav-group">
          <button
            class="nav-parent"
            :class="{ active: group.key === activeGroupKey }"
            @click="toggleGroup(group)"
            :title="group.title"
          >
            <span class="nav-icon">{{ groupIcon(group.key) }}</span>
            <span v-if="!collapsed" class="nav-parent-title">{{ group.title }}</span>
            <span v-if="!collapsed" class="nav-caret" :class="{ open: isGroupOpen(group.key) }">▸</span>
          </button>
          <div v-show="isGroupOpen(group.key) && !collapsed" class="nav-children">
            <RouterLink
              v-for="child in visibleChildren(group)"
              :key="child.key"
              :to="`/${group.key}/${child.key}`"
              class="nav-item"
            >
              <span class="nav-icon">{{ childIcon(child.key) }}</span>
              <span class="nav-item-title">{{ child.title }}</span>
            </RouterLink>
          </div>
        </div>
      </nav>

      <main class="home-content">
        <RouterView />
      </main>
    </div>

    <footer class="home-footer">研究生工作室管理平台</footer>

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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { logout, system } from '../api'
import { navGroups, profileNavItems, groupRoles, childRoles, isRoleAllowed } from '../config/navConfig'
import { ROLE_STUDENT } from '../config/constants'
import { useSession } from '../composables/useSession'
import logoUrl from '../assets/logo.ico'

const { clearSession, getSessionUser } = useSession()
const currentUser = getSessionUser()
const router = useRouter()
const route = useRoute()
const showConfirm = ref(false)
const unread = ref(0)
const collapsed = ref(false)
let pollTimer = null

async function refreshUnread() {
  try {
    const r = await system.unreadCount()
    unread.value = (r && r.success) ? r.count : 0
  } catch (e) {}
}

function goMessages() {
  router.push('/profile/message')
}

const role = computed(() => currentUser?.role || ROLE_STUDENT)
const visibleGroups = computed(() =>
  navGroups.filter((g) => isRoleAllowed(groupRoles(g), role.value))
)

const activeGroupKey = computed(() => {
  const path = route.path
  const hit = visibleGroups.value.find(
    (g) => path === `/${g.key}` || path.startsWith(`/${g.key}/`)
  )
  return hit ? hit.key : null
})

// 面包屑：大导航 > 小导航（均可点击跳转）；个人主页单独处理
const breadcrumb = computed(() => {
  const path = route.path
  if (path === '/profile' || path.startsWith('/profile/')) {
    const tab = profileNavItems.find((t) => path === `/profile/${t.key}`)
    return [
      { title: '个人主页', icon: '👤', to: '/profile' },
      ...(tab ? [{ title: tab.title, icon: childIcon(tab.key), to: `/profile/${tab.key}` }] : [])
    ]
  }
  const group = navGroups.find((g) => path === `/${g.key}` || path.startsWith(`/${g.key}/`))
  if (!group) return []
  const child = group.children.find((c) => path === `/${group.key}/${c.key}`)
  return [
    { title: group.title, icon: groupIcon(group.key), to: `/${group.key}` },
    ...(child ? [{ title: child.title, icon: childIcon(child.key), to: `/${group.key}/${child.key}` }] : [])
  ]
})

const openKey = ref(null)
function isGroupOpen(key) {
  return openKey.value === key || activeGroupKey.value === key
}
// 路由切换时同步展开状态：
// - 切到其他模块（如工作台 → 协同办公）：收起旧模块、展开新模块；
// - 切到个人主页等不属于任何导航组的页面：全部收起（key 为 null）。
watch(activeGroupKey, (key) => {
  openKey.value = key || null
})
function visibleChildren(group) {
  return group.children.filter((c) => isRoleAllowed(childRoles(group, c), role.value))
}
function toggleGroup(group) {
  openKey.value = group.key
  router.push("/" + group.key)
}

// 一级导航图标
const groupIcons = {
  workbench: '🏠',
  research: '🔬',
  studio: '🏢',
  resource: '📚',
  collaboration: '👥',
  report: '📊',
  system: '⚙️'
}
function groupIcon(key) { return groupIcons[key] || '📄' }

// 二级导航图标
const childIcons = {
  overview: '🏠', todo: '✅', schedule: '📅', notice: '📢', shortcuts: '🔗',
  project: '📊', paper: '📄', patent: '💡', subject: '🔬', log: '📝',
  achievement: '🏆', graduation: '🎓', fund: '💰',
  member: '👥', seat: '🪑', device: '🖥️', attendance: '🕐', duty: '🧹',
  regulation: '📋', 'join-leave': '🚪', borrow: '📦',
  doc: '📚', dataset: '🗃️', code: '💻', tool: '🛠️', template: '📑', drive: '☁️', link: '🔗',
  'weekly-report': '📝', meeting: '👥', activity: '🎉', task: '📋', forum: '💬', approval: '✅',
  'achievement-stat': '📊', 'attendance-stat': '📈', 'task-stat': '📉',
  'device-stat': '🖥️', 'activity-stat': '🔥', export: '📤',
  user: '👤', audit: '🔍', backup: '💾', param: '⚙️', update: 'ℹ️',
  overview: '🏠', academic: '🎓', 'my-project': '📊', 'my-achievement': '🏆',
  'my-task': '📋', 'my-schedule': '📅', message: '💬', setting: '⚙️'
}
function childIcon(key) { return childIcons[key] || '📄' }

const avatarText = computed(() => {
  const name = currentUser?.username || '?'
  return name.charAt(0).toUpperCase()
})

const clock = ref('')
let timer = null
function tick() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  clock.value =
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
onMounted(() => {
  refreshUnread()
  pollTimer = setInterval(refreshUnread, 30000)
  tick()
  timer = setInterval(tick, 1000)
  // 消息页标记已读后广播 events，顶部数字立即刷新
  window.addEventListener('messages-read', refreshUnread)
  // 路由变化（如从消息页跳到任务页/返回）时同步刷新未读数
  watch(() => route.path, () => refreshUnread())
})
onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  if (timer) clearInterval(timer)
  window.removeEventListener('messages-read', refreshUnread)
})

const exiting = ref(false)
function onLogout() {
  exiting.value = false
  showConfirm.value = true
}
async function confirmLogout() {
  if (exiting.value) return
  exiting.value = true
  await new Promise((resolve) => setTimeout(resolve, 1000))
  showConfirm.value = false
  exiting.value = false
  await logout()
  clearSession()
  router.push('/login')
}
function cancelLogout() {
  if (exiting.value) return
  showConfirm.value = false
}
</script>

<style scoped>
.home-layout { height: 100%; display: flex; flex-direction: column; }
.home-header {
  height: 56px; flex: 0 0 56px;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 20px; background: #fff; border-bottom: 1px solid #eceff3;
}
.brand-wrap { display: flex; align-items: center; gap: 10px; }
.collapse-btn {
  width: 28px; height: 28px; border: 1px solid #dfe3e8; border-radius: 6px;
  background: #fff; cursor: pointer; font-size: 14px; color: #4e5969;
  display: inline-flex; align-items: center; justify-content: center;
  margin-left: 4px;
}
.collapse-btn:hover { border-color: #0d80e0; color: #0d80e0; }
.collapse-btn:hover { border-color: #0d80e0; color: #0d80e0; }
.breadcrumb {
  display: flex; align-items: center; gap: 4px;
  margin-left: 12px; padding: 4px 6px;
  background: #f5f7fa; border: 1px solid #eceff3; border-radius: 10px;
  font-size: 13px;
}
.crumb-link {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 12px; border-radius: 7px;
  color: #4e5969; text-decoration: none;
  transition: all 0.15s;
}
.crumb-link:hover { background: #e8f2fc; color: #0d80e0; }
.crumb-current {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 12px; border-radius: 7px;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  color: #fff; font-weight: 600;
  box-shadow: 0 2px 6px rgba(13, 128, 224, 0.25);
}
.crumb-icon { font-size: 14px; }
.crumb-sep { color: #c0c4cc; margin: 0 3px; user-select: none; font-size: 12px; }
.brand-logo { width: 26px; height: 26px; object-fit: contain; }
.brand { font-size: 15px; font-weight: 600; }
.header-right { display: flex; align-items: center; gap: 16px; }
.clock { font-size: 13px; color: #8a9099; font-variant-numeric: tabular-nums; }
.bell { position: relative; cursor: pointer; font-size: 18px; user-select: none; }
.bell-badge {
  position: absolute; top: -4px; right: -8px;
  background: #ea4335; color: #fff; font-size: 10px;
  min-width: 16px; height: 16px; line-height: 16px;
  text-align: center; border-radius: 999px; padding: 0 4px;
}
.user-entry {
  display: inline-flex; align-items: center; gap: 8px;
  text-decoration: none; padding: 4px 10px 4px 4px; border-radius: 20px; transition: background 0.2s;
}
.user-entry:hover { background: #f5f7fa; }
.user-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  color: #fff; font-size: 14px; font-weight: 600;
  display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.user-name { font-size: 13px; color: #1f2329; font-weight: 500; }
.logout-btn {
  height: 32px; padding: 0 14px; border: 1px solid #dfe3e8; border-radius: 8px;
  background: #fff; color: #4e5969; font-size: 13px; cursor: pointer; transition: all 0.2s;
}
.logout-btn:hover { border-color: #0d80e0; color: #0d80e0; }

.home-body { flex: 1 1 auto; display: flex; min-height: 0; }
.home-nav {
  flex: 0 0 200px; width: 200px;
  background: #fff; border-right: 1px solid #eceff3;
  padding: 12px 0; display: flex; flex-direction: column; gap: 2px; overflow-y: auto;
  transition: width 0.2s, flex-basis 0.2s;
}
.home-nav.collapsed {
  flex: 0 0 60px; width: 60px;
}
.nav-group { display: flex; flex-direction: column; }
.nav-parent {
  display: flex; align-items: center; gap: 10px;
  width: 100%; padding: 10px 20px;
  font-size: 14px; font-weight: 600; color: #1f2329;
  background: transparent; border: none; border-left: 3px solid transparent;
  cursor: pointer; text-align: left;
}
.home-nav.collapsed .nav-parent {
  padding: 10px 0; justify-content: center; gap: 0;
}
.nav-parent:hover { background: #f5f7fa; }
.nav-parent.active { color: #0d80e0; border-left-color: #0d80e0; }
.nav-icon { font-size: 16px; flex-shrink: 0; width: 20px; text-align: center; }
.nav-parent-title { flex: 1; }
.nav-caret { font-size: 12px; color: #8a9099; transition: transform 0.2s; }
.nav-caret.open { transform: rotate(90deg); }
.nav-children { display: flex; flex-direction: column; }
.nav-item {
  display: flex; align-items: center; gap: 8px;
  padding: 9px 20px 9px 36px;
  font-size: 13px; color: #4e5969;
  text-decoration: none; border-left: 3px solid transparent;
}
.nav-item:hover { background: #f5f7fa; }
.nav-item.router-link-active {
  color: #0d80e0; background: #eef6ff;
  border-left-color: #0d80e0; font-weight: 600;
}
.nav-item-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.home-content {
  flex: 1 1 auto; min-height: 0; overflow-y: auto;
  padding: 20px; background: #f5f7fa;
}
.home-footer {
  flex: 0 0 auto; text-align: center; padding: 8px 0;
  font-size: 13px; color: #8a9099; background: #fff; border-top: 1px solid #eceff3;
}

.modal-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal-box {
  width: 300px; background: #fff; border-radius: 12px;
  padding: 24px; box-shadow: 0 12px 40px rgba(0,0,0,0.18); text-align: center;
}
.modal-text { font-size: 15px; margin: 0 0 20px; color: #1f2329; }
.modal-actions { display: flex; gap: 12px; }
.modal-btn { flex: 1; height: 38px; border-radius: 8px; font-size: 14px; cursor: pointer; border: 1px solid #dfe3e8; }
.modal-btn.cancel { background: #fff; color: #4e5969; }
.modal-btn.ok { background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%); border: none; color: #fff; font-weight: 600; }
.modal-btn:disabled { opacity: 0.45; cursor: not-allowed; }
</style>
