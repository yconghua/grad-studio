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
        <!-- 全局搜索：成员 / 论文 / 任务 / 公告 -->
        <div class="search-box">
          <input
            v-model="searchKeyword"
            class="search-input"
            placeholder="搜索成员、论文、任务、公告"
            @focus="searchVisible = true"
            @input="onSearchInput"
            @keyup.enter="goFirstResult"
            @blur="onSearchBlur"
          />
          <div v-if="searchVisible" class="search-panel">
            <div v-if="searching" class="search-state">搜索中…</div>
            <template v-else>
              <div v-if="searchResults.members.length" class="search-group">
                <div class="search-group-title">👥 成员</div>
                <div v-for="m in searchResults.members" :key="'m' + m.id" class="search-row" @mousedown.prevent="goResult('member', m)">
                  {{ m.real_name || m.username }}<span class="search-sub">{{ roleText(m.role) }}</span>
                </div>
              </div>
              <div v-if="searchResults.papers.length" class="search-group">
                <div class="search-group-title">📄 论文</div>
                <div v-for="p in searchResults.papers" :key="'p' + p.id" class="search-row" @mousedown.prevent="goResult('paper', p)">{{ p.title }}</div>
              </div>
              <div v-if="searchResults.tasks.length" class="search-group">
                <div class="search-group-title">📋 任务</div>
                <div v-for="t in searchResults.tasks" :key="'t' + t.id" class="search-row" @mousedown.prevent="goResult('task', t)">{{ t.title }}</div>
              </div>
              <div v-if="searchResults.notices.length" class="search-group">
                <div class="search-group-title">📢 公告</div>
                <div v-for="n in searchResults.notices" :key="'n' + n.id" class="search-row" @mousedown.prevent="goResult('notice', n)">{{ n.title }}</div>
              </div>
              <div v-if="searchKeyword.trim() && !hasResults" class="search-state">无匹配结果</div>
              <div v-if="!searchKeyword.trim() && !searching" class="search-state">输入关键词搜索成员、论文、任务、公告</div>
            </template>
          </div>
        </div>
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

    <!-- 登录引导（管理员可在系统参数中开关） -->
    <GuideDialog
      :visible="guideVisible"
      :role="role"
      :user-id="currentUser ? currentUser.id : ''"
      :version="guideVersion"
      @close="closeGuide"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { logout, system, search as searchApi } from '../api'
import { navGroups, profileNavItems, groupRoles, childRoles, isRoleAllowed } from '../config/navConfig'
import { ROLE_STUDENT } from '../config/constants'
import { useSession } from '../composables/useSession'
import logoUrl from '../assets/logo.ico'
import GuideDialog from '../components/GuideDialog.vue'

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

onMounted(() => {
  refreshUnread()
  pollTimer = setInterval(refreshUnread, 30000)
  maybeShowGuide()
  // 消息页标记已读后广播 events，顶部数字立即刷新
  window.addEventListener('messages-read', refreshUnread)
  // 路由变化（如从消息页跳到任务页/返回）时同步刷新未读数
  watch(() => route.path, () => refreshUnread())
})
onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  window.removeEventListener('messages-read', refreshUnread)
})

const exiting = ref(false)
function onLogout() {
  exiting.value = false
  showConfirm.value = true
}

// ===== 全局搜索 =====
const searchKeyword = ref('')
const searchResults = ref({ members: [], papers: [], tasks: [], notices: [] })
const searchVisible = ref(false)
const searching = ref(false)
let searchTimer = null

const hasResults = computed(() =>
  searchResults.value.members.length || searchResults.value.papers.length ||
  searchResults.value.tasks.length || searchResults.value.notices.length
)

const ROLE_TEXT = { admin: '管理员', mentor: '导师', student: '学生', user: '普通用户' }
function roleText(v) {
  return ROLE_TEXT[v] || v || ''
}

function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  const kw = searchKeyword.value.trim()
  if (!kw) {
    searchResults.value = { members: [], papers: [], tasks: [], notices: [] }
    return
  }
  searchTimer = setTimeout(async () => {
    searching.value = true
    try {
      const r = await searchApi.globalSearch(kw)
      searchResults.value = r && r.success
        ? { members: r.members || [], papers: r.papers || [], tasks: r.tasks || [], notices: r.notices || [] }
        : { members: [], papers: [], tasks: [], notices: [] }
    } catch (e) {
      console.error('[search.global] 前端异常:', e)
      searchResults.value = { members: [], papers: [], tasks: [], notices: [] }
    } finally {
      searching.value = false
    }
  }, 300)
}

function goResult(type) {
  searchVisible.value = false
  searchKeyword.value = ''
  searchResults.value = { members: [], papers: [], tasks: [], notices: [] }
  if (type === 'member') router.push('/system/user')
  else if (type === 'paper') router.push('/research/paper')
  else if (type === 'task') router.push('/collaboration/task')
  else if (type === 'notice') router.push('/workbench/notice')
}

function goFirstResult() {
  const types = ['members', 'papers', 'tasks', 'notices']
  const typeMap = { members: 'member', papers: 'paper', tasks: 'task', notices: 'notice' }
  for (const k of types) {
    if (searchResults.value[k].length) {
      goResult(typeMap[k])
      return
    }
  }
}

function onSearchBlur() {
  setTimeout(() => { searchVisible.value = false }, 150)
}

// ===== 登录引导 =====
const guideVisible = ref(false)
const guideVersion = ref('1')

async function maybeShowGuide() {
  try {
    // 1. 读取管理员开关（guide_enabled）；未配置默认开启，显式 '0' 才关闭
    const enabledRes = await system.getParam('guide_enabled')
    if (enabledRes && enabledRes.success && enabledRes.value === '0') return
    // 2. 读取引导版本号（升级内容后 +1，让已看过的人再看一次）
    const verRes = await system.getParam('guide_version')
    const version = (verRes && verRes.success && verRes.value) ? String(verRes.value) : '1'
    guideVersion.value = version
    // 3. 本机该用户是否已看过当前版本
    const uid = currentUser ? currentUser.id : null
    if (uid === null || uid === undefined) return
    try {
      if (localStorage.getItem(`guide_seen_${uid}_${version}`)) return
    } catch (e) {}
    guideVisible.value = true
  } catch (e) {
    console.error('[guide.check] 异常:', e)
  }
}

function closeGuide() {
  guideVisible.value = false
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

/* 全局搜索 */
.search-box {
  position: relative;
  display: flex;
  align-items: center;
}
.search-input {
  width: 240px;
  height: 34px;
  padding: 0 12px;
  font-size: 13px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  outline: none;
  background: #f5f7fa;
}
.search-input:focus {
  border-color: #0d80e0;
  background: #fff;
}
.search-panel {
  position: absolute;
  top: 40px;
  right: 0;
  width: 340px;
  max-height: 420px;
  overflow-y: auto;
  background: #fff;
  border: 1px solid #eceff3;
  border-radius: 10px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.14);
  z-index: 300;
  padding: 8px 10px;
}
.search-group {
  margin-bottom: 6px;
}
.search-group-title {
  font-size: 12px;
  font-weight: 600;
  color: #8a9099;
  padding: 6px 8px 4px;
}
.search-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 13px;
  color: #1f2329;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.search-row:hover {
  background: #f5f8ff;
  color: #0d80e0;
}
.search-sub {
  font-size: 11px;
  color: #8a9099;
  flex-shrink: 0;
  background: #f2f3f5;
  border-radius: 8px;
  padding: 1px 8px;
}
.search-state {
  text-align: center;
  font-size: 12px;
  color: #b8bec4;
  padding: 18px 0;
}
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
