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
        <!-- 全局搜索：输入防抖检索，结果分组展示，点击跳转对应菜单页 -->
        <div class="search-box">
          <input
            v-model="searchKeyword"
            class="search-input"
            placeholder="全局搜索"
            @focus="searchVisible = true"
            @blur="onSearchBlur"
            @keydown.esc="searchVisible = false"
          />
          <div v-if="searchVisible" class="search-panel">
            <template v-if="!searchKeyword.trim()">
              <div class="search-state">输入关键词进行全局搜索，支持课题组、成员、公告、组会、课题、任务等。</div>
            </template>
            <template v-else-if="searchLoading">
              <div class="search-state">搜索中…</div>
            </template>
            <template v-else-if="searchError">
              <div class="search-state">{{ searchError }}</div>
            </template>
            <template v-else-if="!searchResultGroups.length">
              <div class="search-state">未找到与「{{ searchKeyword.trim() }}」相关的内容</div>
            </template>
            <template v-else>
              <div class="search-groups">
                <div v-for="g in searchResultGroups" :key="g.key" class="search-group">
                  <div class="search-group-title">{{ g.icon }} {{ g.label }}</div>
                  <div
                    v-for="r in searchResults[g.key]"
                    :key="g.key + '-' + r.id"
                    class="search-result-item"
                    @mousedown.prevent="goSearchResult(r)"
                  >
                    <span class="search-result-main">{{ resultMain(g.key, r) }}</span>
                    <span v-if="resultSub(g.key, r)" class="search-result-sub">{{ resultSub(g.key, r) }}</span>
                  </div>
                </div>
              </div>
            </template>
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
              <div class="dropdown-item update-item" @click="onCheckUpdate">
                <span>检查更新</span>
                <span v-if="updateAvailable" class="update-dot" title="发现新版本"></span>
              </div>
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
          <span class="nav-icon">
            <component :is="menuIcon(item)" v-if="menuIcon(item)" />
            <span v-else>{{ menuIconFallback(item) }}</span>
          </span>
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
import { ref, computed, markRaw, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  DashboardOutlined, NotificationOutlined, TeamOutlined, SettingOutlined,
  UserSwitchOutlined, ScheduleOutlined, ExperimentOutlined, CheckSquareOutlined,
  FileTextOutlined, EditOutlined, ProjectOutlined, ReadOutlined, FolderOpenOutlined,
  RobotOutlined, CalendarOutlined, TrophyOutlined, BookOutlined, UserOutlined,
  ApartmentOutlined, DatabaseOutlined, ControlOutlined, FileSearchOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons-vue'
import {
  logout,
  getMessageUnreadCount,
  listMyMessages,
  markMessageRead,
  markAllMessagesRead,
  getNoticeUnreadCount,
  globalSearch,
  checkForUpdates,
  openExternal
} from '../api'
import { dialogAlert, dialogConfirm } from '../composables/useDialog'
import { visibleNavItems } from '../config/navConfig'
import { useSession } from '../composables/useSession'
import { useGroupContext } from '../composables/useGroupContext'
import { useAppName } from '../composables/useAppName'
import logoUrl from '../assets/logo.ico'

const { clearSession, getSessionUser } = useSession()
const { currentGroupId } = useGroupContext()
const { appName } = useAppName()

const currentUser = getSessionUser()
const router = useRouter()
const route = useRoute()

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

// 菜单角标（未读红点等）：课题组公告未读数由公告未读接口驱动，
// 返回值 > 0 时显示数字角标，未读数归零后自动隐藏。
function menuBadge(item) {
  if (item.key === 'notice') {
    return noticeUnread.value > 0 ? noticeUnread.value : null
  }
  return null
}

// 公告未读数（公告未读接口驱动，登录后与组切换时刷新）
const noticeUnread = ref(0)

// ===== 菜单图标：按 navConfig.icon 的 Ant Design Vue 图标名解析组件 =====
// 说明：icon 字段为 @ant-design/icons-vue 的组件名，渲染层按名解析为图标组件；
// 显式导入当前菜单用到的图标（避免全量打包），新增菜单图标时在此补充导入与映射；
// 未知图标名回退到 emoji 占位（MENU_ICON_FALLBACK），保证菜单不因图标缺失而异常。
const MENU_ICONS = {
  DashboardOutlined, NotificationOutlined, TeamOutlined, SettingOutlined,
  UserSwitchOutlined, ScheduleOutlined, ExperimentOutlined, CheckSquareOutlined,
  FileTextOutlined, EditOutlined, ProjectOutlined, ReadOutlined, FolderOpenOutlined,
  RobotOutlined, CalendarOutlined, TrophyOutlined, BookOutlined, UserOutlined,
  ApartmentOutlined, DatabaseOutlined, ControlOutlined, FileSearchOutlined,
  QuestionCircleOutlined
}
const MENU_ICON_FALLBACK = {
  workbench: '🏠', notice: '📢', member: '👥', students: '🎓', degree: '🗓️',
  meeting: '📅', subject: '🔬', task: '✅', 'research-record': '📝', 'my-work': '📋',
  achievement: '🏆', literature: '📚', archive: '📂', knowledge: '📖', 'ai-assistant': '🤖',
  settings: '⚙️', 'weekly-review': '📄', 'platform-users': '👤', 'platform-groups': '🏢',
  'platform-config': '🔧', 'platform-logs': '🕐', 'platform-help': '❓'
}
function menuIcon(item) {
  const C = item.icon && MENU_ICONS[item.icon]
  return C ? markRaw(C) : null
}
function menuIconFallback(item) {
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

const REF_ROUTE_MAP = { notice: '/notice', task: '/task', achievement: '/achievement', weekly: '/research-record' }

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

// ===== 顶部：全局搜索 =====
const searchKeyword = ref('')
const searchVisible = ref(false)
const searchLoading = ref(false)
const searchResults = ref({})
const searchError = ref('')
let searchTimer = null

// 结果分组展示配置（顺序即面板展示顺序）
const SEARCH_GROUPS = [
  { key: 'groups', label: '课题组', icon: '🏢' },
  { key: 'members', label: '成员', icon: '👥' },
  { key: 'notices', label: '课题组公告', icon: '📢' },
  { key: 'meetings', label: '组会', icon: '📅' },
  { key: 'subjects', label: '课题', icon: '🔬' },
  { key: 'tasks', label: '任务', icon: '✅' },
  { key: 'degreeNodes', label: '学位节点', icon: '🗓️' },
  { key: 'degreeRecords', label: '学生学位记录', icon: '🎓' },
  { key: 'achievements', label: '科研成果', icon: '🏆' },
  { key: 'knowledge', label: '课题组知识库', icon: '📖' },
  { key: 'literatures', label: '文献', icon: '📚' },
  { key: 'researchLogs', label: '科研日志', icon: '📝' },
  { key: 'weeklyReports', label: '周报', icon: '📋' },
  { key: 'archives', label: '科研档案', icon: '📂' }
]

// 只展示有结果的分组
const searchResultGroups = computed(() =>
  SEARCH_GROUPS.filter((g) => searchResults.value[g.key] && searchResults.value[g.key].length)
)

const ROLE_GROUP_LABEL = { group_admin: '课题组管理员', mentor: '导师', student: '学生' }

function truncate(s, n) {
  if (!s) return ''
  s = String(s)
  return s.length > n ? s.slice(0, n) + '…' : s
}

function fmtDate(d) {
  if (!d) return ''
  return String(d).slice(0, 10)
}

// 结果主文本（按模块取有意义的标题字段）
function resultMain(key, r) {
  switch (key) {
    case 'groups': return `${r.name}（${r.code}）`
    case 'members': return r.real_name ? `${r.real_name}（${r.username}）` : r.username
    case 'notices': return r.title
    case 'meetings': return r.title
    case 'subjects': return r.name
    case 'tasks': return r.title
    case 'degreeNodes': return r.name
    case 'degreeRecords': return r.node_name || ''
    case 'achievements': return r.title
    case 'knowledge': return r.name
    case 'literatures': return r.title
    case 'researchLogs': return truncate(r.content, 40)
    case 'weeklyReports': return truncate(r.work_content, 40)
    case 'archives': return r.title || truncate(r.record_type, 20)
    default: return ''
  }
}

// 结果副文本（模块归属 / 人名 / 时间）
function resultSub(key, r) {
  switch (key) {
    case 'groups': return r.status === 'active' ? '正常' : '停用'
    case 'members': return [r.group_name, ROLE_GROUP_LABEL[r.role_in_group] || r.role_in_group].filter(Boolean).join(' · ')
    case 'notices': return r.group_name || ''
    case 'meetings': return r.group_name || ''
    case 'subjects': return [r.group_name, r.status].filter(Boolean).join(' · ')
    case 'tasks': return [r.group_name, r.status].filter(Boolean).join(' · ')
    case 'degreeNodes': return r.group_name || ''
    case 'degreeRecords': return [r.group_name, r.student_real_name || r.student_username].filter(Boolean).join(' · ')
    case 'achievements': return [r.group_name, r.real_name || r.username].filter(Boolean).join(' · ')
    case 'knowledge': return r.group_name || ''
    case 'literatures': return r.authors || r.real_name || r.username || ''
    case 'researchLogs': return [r.real_name || r.username, fmtDate(r.log_date)].filter(Boolean).join(' · ')
    case 'weeklyReports': return [r.real_name || r.username, fmtDate(r.week_start)].filter(Boolean).join(' · ')
    case 'archives': return [r.real_name || r.username, fmtDate(r.record_date)].filter(Boolean).join(' · ')
    default: return ''
  }
}

// 点击结果：跳转到对应菜单页并关闭面板
function goSearchResult(r) {
  searchVisible.value = false
  if (r.route) router.push(r.route)
}

function onSearchBlur() {
  setTimeout(() => { searchVisible.value = false }, 150)
}

// 输入防抖检索：停顿 300ms 后请求
watch(searchKeyword, (kw) => {
  if (searchTimer) clearTimeout(searchTimer)
  const k = kw.trim()
  if (!k) {
    searchLoading.value = false
    searchResults.value = {}
    searchError.value = ''
    return
  }
  searchLoading.value = true
  searchError.value = ''
  searchTimer = setTimeout(async () => {
    try {
      const res = await globalSearch(k)
      if (res && res.success) {
        searchResults.value = res.results || {}
      } else {
        searchResults.value = {}
        searchError.value = (res && res.message) || '搜索失败'
      }
    } catch (e) {
      searchResults.value = {}
      searchError.value = '网络异常'
    } finally {
      searchLoading.value = false
    }
  }, 300)
})

// ===== 顶部：检查更新（GitHub Releases）=====
const updateAvailable = ref(false)
let updateChecking = false

// 检查更新：silent=true 为启动静默检查（失败不打扰），手动点击时给完整反馈
async function checkUpdate(silent = false) {
  if (updateChecking) return
  updateChecking = true
  try {
    const res = await checkForUpdates()
    if (!res || !res.success) {
      updateAvailable.value = false
      if (!silent) dialogAlert((res && res.message) || '检查更新失败')
      return
    }
    if (res.hasUpdate) {
      updateAvailable.value = true
      const go = await dialogConfirm(
        `发现新版本 v${res.latest}（当前 v${res.current}），是否前往 GitHub 下载更新？`,
        '发现新版本'
      )
      if (go) {
        try {
          const opened = await openExternal(res.url || `https://github.com/yconghua/grad-studio/releases/latest`)
          if (!opened || !opened.success) dialogAlert((opened && opened.message) || '打开下载页失败')
        } catch (e) {
          dialogAlert('打开下载页失败')
        }
      }
    } else {
      updateAvailable.value = false
      if (!silent) dialogAlert(`当前已是最新版本 v${res.current}`)
    }
  } catch (e) {
    updateAvailable.value = false
    if (!silent) dialogAlert('检查更新失败，请检查网络后重试')
  } finally {
    updateChecking = false
  }
}

function onCheckUpdate() {
  userMenuOpen.value = false
  checkUpdate(false)
}

// ===== 退出登录 =====
function onLogout() {
  exiting.value = false
  showConfirm.value = true
}function cancelLogout() {
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
  // 启动后延迟静默检查一次更新，避免与登录后的数据加载抢网络
  setTimeout(() => { checkUpdate(true) }, 2000)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  window.removeEventListener('notice-unread-changed', fetchNoticeUnread)
  if (msgTimer) clearInterval(msgTimer)
  if (searchTimer) clearTimeout(searchTimer)
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
  position: absolute; top: 40px; right: 0; width: 320px;
  background: #fff; border: 1px solid #eceff3; border-radius: 10px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.14); z-index: 300; padding: 12px;
}
.search-state { text-align: center; font-size: 12px; color: #b8bec4; line-height: 1.7; padding: 8px 0; }
.search-groups { max-height: 420px; overflow-y: auto; }
.search-group { margin-bottom: 6px; }
.search-group-title { font-size: 12px; color: #8a9099; margin: 6px 0 4px; font-weight: 600; }
.search-result-item { padding: 8px 10px; border-radius: 8px; cursor: pointer; }
.search-result-item:hover { background: #eef6ff; }
.search-result-main {
  display: block; font-size: 13px; color: #1f2329; font-weight: 500;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.search-result-sub {
  display: block; font-size: 11px; color: #8a9099; margin-top: 2px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

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
.dropdown-item.update-item { display: flex; align-items: center; justify-content: space-between; }
.update-dot { width: 8px; height: 8px; border-radius: 50%; background: #ea4335; flex-shrink: 0; }
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
