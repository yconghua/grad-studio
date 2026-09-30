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
              <RouterLink class="dropdown-item msg-entry" :class="{ 'msg-has-badge': msgUnread > 0 }" to="/my-messages" @click="userMenuOpen = false">
                <span class="msg-label">我的消息</span>
                <span v-if="msgUnread > 0" class="dropdown-msg-badge">{{ msgUnread > 99 ? '99+' : msgUnread }}</span>
              </RouterLink>
              <RouterLink class="dropdown-item" to="/help" @click="userMenuOpen = false">使用帮助</RouterLink>
              <RouterLink class="dropdown-item" to="/app-settings" @click="userMenuOpen = false">设置</RouterLink>
              <div class="dropdown-item update-item" @click="onCheckUpdate">
                <span v-if="updateStatus === 'downloading'">更新下载中 {{ updateProgress }}%</span>
                <span v-else-if="updateStatus === 'downloaded'">立即重启安装新版本</span>
                <span v-else>检查更新</span>
                <span v-if="updateAvailable" class="update-dot" :title="updateDotTitle"></span>
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
  QuestionCircleOutlined, BulbOutlined, MessageOutlined
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
  installUpdate,
  onUpdateState,
  getChatUnreadTotal,
  onChatPush
} from '../api'
import { dialogAlert, dialogConfirm } from '../composables/useDialog'
import { visibleNavItems } from '../config/navConfig'
import { useSession } from '../composables/useSession'
import { useGroupContext } from '../composables/useGroupContext'
import { useAppName } from '../composables/useAppName'
import logoUrl from '../assets/logo.ico'

const { clearSession, getSessionUser } = useSession()
const { currentGroupId, groups, groupsLoaded } = useGroupContext()
const { appName } = useAppName()

const currentUser = getSessionUser()
const router = useRouter()
const route = useRoute()

const collapsed = ref(false)
const showConfirm = ref(false)
const exiting = ref(false)

// ===== 侧边菜单：按当前角色 + 课题组归属动态过滤 =====
// 导师/学生未加入课题组时仅保留 noGroupOnly 菜单项（测试内容页）；
// 组列表加载完成前按「已入组」处理，避免加载期间菜单闪烁；加载失败同样兜底为已入组。
const visibleMenus = computed(() => {
  const inGroup = groupsLoaded.value ? groups.value.length > 0 : true
  return visibleNavItems(currentUser?.role || '', inGroup)
})

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
// 聊天未读数由聊天独立角标接口驱动（chatUnread），与铃铛（业务通知）分开统计；
// 返回值 > 0 时显示数字角标，未读数归零后自动隐藏。
function menuBadge(item) {
  if (item.key === 'notice') {
    return noticeUnread.value > 0 ? noticeUnread.value : null
  }
  if (item.key === 'chat') {
    return chatUnread.value > 0 ? chatUnread.value : null
  }
  return null
}

// 公告未读数（公告未读接口驱动，登录后与组切换时刷新）
const noticeUnread = ref(0)
// 聊天未读数（chat:unread-total 驱动，聊天页已读/新消息推送时变化）
const chatUnread = ref(0)

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
  QuestionCircleOutlined, BulbOutlined, MessageOutlined
}
const MENU_ICON_FALLBACK = {
  workbench: '🏠', chat: '💬', notice: '📢', member: '👥', students: '🎓', degree: '🗓️',
  meeting: '📅', subject: '🔬', task: '✅', 'research-record': '📝', 'my-work': '📋',
  achievement: '🏆', literature: '📚', archive: '📂', knowledge: '📖', 'ai-assistant': '🤖',
  settings: '⚙️', 'weekly-review': '📄', 'test-content': '💡', 'platform-users': '👤',
  'platform-groups': '🏢', 'platform-config': '🔧', 'platform-logs': '🕐', 'platform-help': '❓'
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
    // 「全部已读」会联动清空公告未读，同步刷新侧边公告角标
    fetchNoticeUnread()
  } catch (e) {}
}

const REF_ROUTE_MAP = { notice: '/notice', task: '/task', achievement: '/achievement', weekly: '/research-record' }

// 消息跳转目标：按消息类型与当前角色分流。
// - task 消息：学生跳「课题与任务」（带 focus 定位任务），导师跳「任务管理」（组管无任务页，不跳转）；
// - weekly 消息：跳「科研记录」并带 tab=weekly + focus，直达被批阅的周报；
// - chat 消息：跳「聊天」并带 conv=会话id，聊天页自动打开对应会话。
function msgTarget(m) {
  if (m.ref_type === 'task') {
    const role = currentUser?.role || ''
    if (role === 'student') {
      return { path: '/my-work', query: m.ref_id ? { focus: m.ref_id } : {} }
    }
    if (role === 'mentor') return '/task'
    return null
  }
  if (m.ref_type === 'weekly') {
    return { path: '/research-record', query: { tab: 'weekly', ...(m.ref_id ? { focus: m.ref_id } : {}) } }
  }
  if (m.ref_type === 'chat') {
    return { path: '/chat', query: m.ref_id ? { conv: m.ref_id } : {} }
  }
  const target = REF_ROUTE_MAP[m.ref_type]
  return target || null
}

async function onMsgItemClick(m) {
  if (m.status === 'unread') {
    try { await markMessageRead(m.id) } catch (e) {}
    m.status = 'read'
    msgUnread.value = Math.max(0, msgUnread.value - 1)
    // 公告类消息已读会联动公告已读，同步刷新侧边公告角标
    if (m.ref_type === 'notice') fetchNoticeUnread()
  }
  msgPanelOpen.value = false
  const target = msgTarget(m)
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

// ===== 顶部：检查更新（应用内自动下载/安装）=====
// 主进程 electron-updater 驱动：发现新版本自动后台下载，状态经 onUpdateState 推送；
// 下载完成后弹确认，用户确认后静默安装到首次安装目录并自动重启。
const updateAvailable = ref(false)
const updateStatus = ref('idle') // idle | checking | available | downloading | downloaded | installing | error
const updateProgress = ref(0)
const updateLatest = ref('')
let updateChecking = false
let updateReadyAsked = false // 防止 downloaded 事件与 checkUpdate 返回并发触发两次确认弹窗
let updateErrorNotified = false // 下载中途出错只提示一次，避免事件重复触发弹窗
let offUpdateState = null

// 红点提示文案：下载中 / 已就绪 / 发现新版本
const updateDotTitle = computed(() => {
  if (updateStatus.value === 'downloading') return `更新下载中 ${updateProgress.value}%`
  if (updateStatus.value === 'downloaded') return '新版本已就绪，点击安装'
  return '发现新版本'
})

// 下载完成后的确认安装（用户取消后可再次触发）
async function askInstallNow() {
  if (updateReadyAsked) return
  updateReadyAsked = true
  const go = await dialogConfirm(
    `新版本 v${updateLatest.value || ''} 已下载完成，是否立即重启并安装？`,
    '更新就绪'
  )
  if (go) {
    const r = await installUpdate()
    if (!r || !r.success) dialogAlert((r && r.message) || '启动安装失败')
  } else {
    updateReadyAsked = false
  }
}

// 订阅主进程更新状态：下载进度实时展示，下载完成/出错弹窗反馈
function handleUpdateState(payload) {
  if (!payload) return
  updateStatus.value = payload.status || 'idle'
  updateProgress.value = payload.progress || 0
  if (payload.latest) updateLatest.value = payload.latest
  if (payload.status === 'available' || payload.status === 'downloading') {
    updateAvailable.value = true
  } else if (payload.status === 'error') {
    updateAvailable.value = false
    if (!updateErrorNotified) {
      updateErrorNotified = true
      dialogAlert(`更新失败：${payload.message || '未知错误'}`)
    }
  } else if (payload.status === 'downloaded') {
    updateAvailable.value = true
    askInstallNow()
  }
}

// 检查更新：silent=true 为启动静默检查（失败不打扰），手动点击时给完整反馈
async function checkUpdate(silent = false) {
  if (updateChecking) return
  updateChecking = true
  updateErrorNotified = false
  try {
    const res = await checkForUpdates()
    if (!res || !res.success) {
      updateAvailable.value = false
      if (!silent) dialogAlert((res && res.message) || '检查更新失败')
      return
    }
    if (res.hasUpdate) {
      updateAvailable.value = true
      if (res.latest) updateLatest.value = res.latest
      // 下载完成提示统一由 update:state 的 downloaded 分支处理；
      // 若订阅尚未建立（下载瞬间完成），这里兜底询问一次
      if (!updateReadyAsked) askInstallNow()
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
  if (updateStatus.value === 'downloaded') {
    askInstallNow()
    return
  }
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

// 公告未读变化时，消息未读（铃铛）可能随之变化（公告已读联动消息已读），一并刷新
function onNoticeUnreadChanged() {
  fetchNoticeUnread()
  fetchMsgUnread()
}

// 「我的消息」页已读操作（全部已读/单条已读）后刷新铃铛与公告角标
function onMessagesReadChanged() {
  fetchMsgUnread()
  fetchNoticeUnread()
}

// ===== 聊天：独立未读角标 + 实时推送 =====
// 聊天未读与铃铛（业务通知）分开统计：聊天页已读 / 收到新消息推送时通过
// chat-unread-changed 事件同步侧栏角标；推送不可达时由 60s 轮询兜底。
async function fetchChatUnread() {
  try {
    const res = await getChatUnreadTotal()
    chatUnread.value = (res && res.success && res.data && res.data.total) || 0
  } catch (e) {}
}

function onChatUnreadChanged(e) {
  chatUnread.value = (e && e.detail && e.detail.total) || 0
}

// 聊天推送：对方发来新消息时立即刷新聊天角标（「对方发送立即弹出」由聊天页负责插入气泡）
let offChatPush = null
function onChatPushPayload(payload) {
  const list = (payload && payload.messages) || []
  if (!list.length) return
  fetchChatUnread()
  // 聊天新消息已双写 message 表（未读），铃铛计数同步刷新
  fetchMsgUnread()
}

watch(currentGroupId, () => { fetchNoticeUnread() })
window.addEventListener('notice-unread-changed', onNoticeUnreadChanged)
window.addEventListener('messages-read-changed', onMessagesReadChanged)
window.addEventListener('chat-unread-changed', onChatUnreadChanged)

onMounted(() => {
  document.addEventListener('click', onDocClick)
  fetchMsgUnread()
  fetchNoticeUnread()
  fetchChatUnread()
  msgTimer = setInterval(() => {
    fetchMsgUnread()
    fetchNoticeUnread()
    fetchChatUnread()
  }, 60000)
  // 订阅聊天实时推送（仅导师/学生角色有 chat 菜单；其他角色推送体为空，忽略即可）
  offChatPush = onChatPush(onChatPushPayload)
  // 订阅更新状态推送（下载进度 / 下载完成 / 出错）
  offUpdateState = onUpdateState(handleUpdateState)
  // 启动后延迟静默检查一次更新，避免与登录后的数据加载抢网络
  setTimeout(() => { checkUpdate(true) }, 2000)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  window.removeEventListener('notice-unread-changed', onNoticeUnreadChanged)
  window.removeEventListener('messages-read-changed', onMessagesReadChanged)
  window.removeEventListener('chat-unread-changed', onChatUnreadChanged)
  if (offChatPush) offChatPush()
  if (offUpdateState) offUpdateState()
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
  /* 同时设定 left/right 使下拉框宽度与头像+账号芯片一致，min-width 防止短用户名时菜单过窄 */
  position: absolute; top: 42px; left: 0; right: 0; min-width: 160px;
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
.dropdown-item.msg-entry { display: flex; align-items: center; justify-content: space-between; }
.dropdown-item.msg-entry .msg-label { white-space: nowrap; flex-shrink: 0; }
/* 有未读徽章时给该行最小宽度，保证「我的消息」文字与数字完整显示不被挤压 */
.dropdown-item.msg-entry.msg-has-badge { min-width: 120px; }
.dropdown-msg-badge {
  min-width: 16px; height: 16px; line-height: 16px; padding: 0 4px;
  border-radius: 999px; background: #ea4335; color: #fff;
  font-size: 10px; text-align: center; flex-shrink: 0; box-sizing: content-box;
}
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
