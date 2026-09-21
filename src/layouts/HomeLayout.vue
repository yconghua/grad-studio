<template>
  <div class="home-layout">
    <!-- 顶部标题栏：左侧品牌 + 右侧（时钟 / 个人主页入口 / 退出登录） -->
    <header class="home-header">
      <div class="brand-wrap">
        <img class="brand-logo" :src="logoUrl" alt="研究生工作室管理平台" />
        <span class="brand">研究生工作室管理平台</span>
      </div>
      <div class="header-right">
        <span class="clock">{{ clock }}</span>
        <span class="bell" @click="goMessages" title="消息中心">🔔<span v-if="unread > 0" class="bell-badge">{{ unread > 99 ? "99+" : unread }}</span></span>
        <!-- 个人主页入口（右上角）：头像 + 用户名，点击进入个人主页 -->
        <RouterLink v-if="currentUser?.username" to="/profile" class="user-entry" title="进入个人主页">
          <span class="user-avatar">{{ avatarText }}</span>
          <span class="user-name">{{ currentUser?.username }}</span>
        </RouterLink>
        <button class="logout-btn" @click="onLogout">退出登录</button>
      </div>
    </header>

    <!-- 中间主体：左侧下拉式导航 + 右侧内容区 -->
    <div class="home-body">
      <nav class="home-nav">
        <div v-for="group in visibleGroups" :key="group.key" class="nav-group">
          <button
            class="nav-parent"
            :class="{ active: group.key === activeGroupKey }"
            @click="toggleGroup(group)"
          >
            <span class="nav-parent-title">{{ group.title }}</span>
            <span class="nav-caret" :class="{ open: isGroupOpen(group.key) }">▸</span>
          </button>
          <div v-show="isGroupOpen(group.key)" class="nav-children">
            <RouterLink
              v-for="child in visibleChildren(group)"
              :key="child.key"
              :to="`/${group.key}/${child.key}`"
              class="nav-item"
            >{{ child.title }}</RouterLink>
          </div>
        </div>
      </nav>

      <main class="home-content">
        <RouterView />
      </main>
    </div>

    <!-- 底部页脚（仅居中显示系统名） -->
    <footer class="home-footer">研究生工作室管理平台</footer>

    <!-- 退出登录确认弹窗 -->
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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { logout, system } from '../api'
import { navGroups, groupRoles, childRoles, isRoleAllowed, groupDefaultPath } from '../config/navConfig'
import { ROLE_STUDENT } from '../config/constants'
import { useSession } from '../composables/useSession'
import logoUrl from '../assets/logo.ico'

const { clearSession, getSessionUser } = useSession()
// 当前登录用户：布局仅在登录后渲染，username 必然存在；模板中用 ?. 兜底
const currentUser = getSessionUser()
const router = useRouter()
const route = useRoute()
const showConfirm = ref(false)
const unread = ref(0)
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

// 当前角色：登录用户角色缺失时按「学生」处理（最保守）
const role = computed(() => currentUser?.role || ROLE_STUDENT)

// 一级导航：按角色过滤可见模块
const visibleGroups = computed(() =>
  navGroups.filter((g) => isRoleAllowed(groupRoles(g), role.value))
)

// 当前激活的一级导航 key：由路由路径匹配（/groupKey 或 /groupKey/...）；
// 在个人主页等非一级导航页面时为 null
const activeGroupKey = computed(() => {
  const path = route.path
  const hit = visibleGroups.value.find(
    (g) => path === `/${g.key}` || path.startsWith(`/${g.key}/`)
  )
  return hit ? hit.key : null
})

// 手风琴：记录当前手动展开的分组 key（同一时间仅一个分组展开）
const openKey = ref(null)
// 某分组是否展开：手动展开的，或当前路由激活的分组
function isGroupOpen(key) {
  return openKey.value === key || activeGroupKey.value === key
}
// 某分组下按角色过滤后的可见子项
function visibleChildren(group) {
  return group.children.filter((c) => isRoleAllowed(childRoles(group, c), role.value))
}
// 点击分组：手风琴式展开当前分组，并跳转到该组当前角色可见的第一个子项
function toggleGroup(group) {
  openKey.value = group.key
  const visible = visibleChildren(group)
  const first = visible[0]
  if (first) router.push(`/${group.key}/${first.key}`)
}

// 头像文字：取用户名首字母大写
const avatarText = computed(() => {
  const name = currentUser?.username || '?'
  return name.charAt(0).toUpperCase()
})

// 实时时钟
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
})
onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  if (timer) clearInterval(timer)
})

// 退出登录：先弹确认框；确认后延迟 1 秒（弹窗保留）再退出
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
.home-layout {
  height: 100%;
  display: flex;
  flex-direction: column;
}
/* 顶部标题栏 */
.home-header {
  height: 56px;
  flex: 0 0 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: #fff;
  border-bottom: 1px solid #eceff3;
}
.brand-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}
.brand-logo {
  width: 26px;
  height: 26px;
  object-fit: contain;
}
.brand {
  font-size: 15px;
  font-weight: 600;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}
.clock {
  font-size: 13px;
  color: #8a9099;
  font-variant-numeric: tabular-nums;
}
.bell {
  position: relative;
  cursor: pointer;
  font-size: 18px;
  user-select: none;
}
.bell-badge {
  position: absolute;
  top: -4px;
  right: -8px;
  background: #ea4335;
  color: #fff;
  font-size: 10px;
  min-width: 16px;
  height: 16px;
  line-height: 16px;
  text-align: center;
  border-radius: 999px;
  padding: 0 4px;
}
/* 个人主页入口（右上角） */
.user-entry {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  padding: 4px 10px 4px 4px;
  border-radius: 20px;
  transition: background 0.2s;
}
.user-entry:hover {
  background: #f5f7fa;
}
.user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.user-name {
  font-size: 13px;
  color: #1f2329;
  font-weight: 500;
}
.logout-btn {
  height: 32px;
  padding: 0 14px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  background: #fff;
  color: #4e5969;
  font-size: 13px;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.logout-btn:hover {
  border-color: #0d80e0;
  color: #0d80e0;
}

/* 中间主体 */
.home-body {
  flex: 1 1 auto;
  display: flex;
  min-height: 0;
}
/* 左侧固定宽度导航（单栏下拉式） */
.home-nav {
  flex: 0 0 200px;
  width: 200px;
  background: #fff;
  border-right: 1px solid #eceff3;
  padding: 12px 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
}
/* 下拉分组：父项（可点击展开 / 收起） */
.nav-group {
  display: flex;
  flex-direction: column;
}
.nav-parent {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
  background: transparent;
  border: none;
  border-left: 3px solid transparent;
  cursor: pointer;
  text-align: left;
}
.nav-parent:hover {
  background: #f5f7fa;
}
.nav-parent.active {
  color: #0d80e0;
  border-left-color: #0d80e0;
}
.nav-caret {
  font-size: 12px;
  color: #8a9099;
  transition: transform 0.2s;
}
.nav-caret.open {
  transform: rotate(90deg);
}
.nav-children {
  display: flex;
  flex-direction: column;
}
/* 子项（缩进显示） */
.nav-item {
  padding: 9px 20px 9px 36px;
  font-size: 13px;
  color: #4e5969;
  text-decoration: none;
  border-left: 3px solid transparent;
}
.nav-item:hover {
  background: #f5f7fa;
}
.nav-item.router-link-active {
  color: #0d80e0;
  background: #eef6ff;
  border-left-color: #0d80e0;
  font-weight: 600;
}
/* 右侧内容区 */
.home-content {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 20px;
  background: #f5f7fa;
}

/* 底部页脚：仅居中系统名 */
.home-footer {
  flex: 0 0 auto;
  text-align: center;
  padding: 8px 0;
  font-size: 13px;
  color: #8a9099;
  background: #fff;
  border-top: 1px solid #eceff3;
}

/* 退出登录确认弹窗 */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal-box {
  width: 300px;
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
  text-align: center;
}
.modal-text {
  font-size: 15px;
  margin: 0 0 20px;
  color: #1f2329;
}
.modal-actions {
  display: flex;
  gap: 12px;
}
.modal-btn {
  flex: 1;
  height: 38px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  border: 1px solid #dfe3e8;
}
.modal-btn.cancel {
  background: #fff;
  color: #4e5969;
}
.modal-btn.ok {
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  border: none;
  color: #fff;
  font-weight: 600;
}
.modal-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
