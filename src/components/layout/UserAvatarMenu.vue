<template>
  <div class="avatar-menu" ref="rootRef">
    <button type="button" class="trigger" @click.stop="open = !open">
      <img v-if="user && user.avatar" :src="avatarUrl(user.avatar)" class="avatar" alt="头像" />
      <span v-else class="avatar avatar-empty">{{ avatarChar }}</span>
      <span class="uname">{{ user ? user.realName || user.username : '' }}</span>
      <span class="caret">▾</span>
    </button>

    <transition name="pop">
      <div v-if="open" class="menu" @click.stop>
        <div class="menu-user">
          <div class="mu-name">{{ user ? user.realName || user.username : '' }}</div>
          <div class="mu-role">{{ roleText }}</div>
        </div>
        <button type="button" class="menu-item" @click="go(profilePath)">个人资料</button>
        <button v-if="!minimal" type="button" class="menu-item" @click="go(introductionPath)">系统简介</button>
        <button v-if="!minimal" type="button" class="menu-item" @click="go(settingsPath)">设置</button>
        <button v-if="!minimal" type="button" class="menu-item" @click="showUpdate">检查更新</button>
        <div class="menu-divider"></div>
        <button type="button" class="menu-item" @click="openSwitch">切换账号</button>
        <button type="button" class="menu-item danger" @click="doLogout">退出登录</button>
      </div>
    </transition>

    <!-- 切换账号弹窗：打开不退出当前账号；选账号后才由主进程执行「先退后登」 -->
    <AccountSwitchDialog
      :visible="showSwitch"
      :current-user="user"
      @close="showSwitch = false"
      @switch="onSwitchAccount"
      @add-new="onAddNewAccount"
    />
    <!-- 检查更新弹窗：打开即检查，跟随主进程推送推进状态 -->
    <UpdateDialog :visible="showUpdateDialog" @close="showUpdateDialog = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useSession } from '../../composables/useSession'
import { useAutoRefresh } from '../../composables/useAutoRefresh'
import { dialogConfirm } from '../../composables/useDialog'
import { logout, switchAccount } from '../../api'
import { avatarUrl } from '../../utils/avatar'
import { ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN, ROLE_MENTOR, ROLE_STUDENT } from '../../config/constants'
import { ROLE_HOME } from '../../router'
import { useTabs } from '../../composables/useTabs'
import AccountSwitchDialog from '../dialogs/AccountSwitchDialog.vue'
import UpdateDialog from '../dialogs/UpdateDialog.vue'

// 头像下拉公共组件：菜单项顺序固定
// 1 个人资料 / 2 系统简介 / 3 设置 / 4 检查更新 / 5 切换账号 / 6 退出登录
// 个人资料、系统简介、设置的跳转地址由各角色布局传入（按角色路由不同）；
// minimal=true 时只保留「个人资料 + 切换账号 + 退出登录」（引导页等无完整布局场景使用）。
const props = defineProps({
  profilePath: { type: String, required: true },
  introductionPath: { type: String, required: false, default: '' },
  settingsPath: { type: String, required: false, default: '' },
  minimal: { type: Boolean, default: false }
})

const router = useRouter()
const { getSessionUser, clearSession, setSession } = useSession()
const { clearTabs } = useTabs()

// 用户信息：响应式 ref（非 sessionStorage 快照），写操作后由全局刷新广播触发重读
const user = ref(getSessionUser())
const open = ref(false)
const rootRef = ref(null)

const ROLE_TEXT = {
  [ROLE_SUPER_ADMIN]: '超级管理员',
  [ROLE_GROUP_ADMIN]: '课题组管理员',
  [ROLE_MENTOR]: '导师',
  [ROLE_STUDENT]: '学生'
}
const roleText = computed(() => (user.value ? ROLE_TEXT[user.value.role] || user.value.role : ''))
const avatarChar = computed(() => {
  const name = (user.value && (user.value.realName || user.value.username)) || '?'
  return name.slice(0, 1).toUpperCase()
})

// 关闭菜单：点击空白处 / 按 Esc
function onClickOutside(e) {
  if (rootRef.value && !rootRef.value.contains(e.target)) open.value = false
}
function onKeydown(e) {
  if (e.key === 'Escape') open.value = false
}
onMounted(() => {
  document.addEventListener('click', onClickOutside)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
  document.removeEventListener('keydown', onKeydown)
})

// 资料保存等写操作后（data:changed / db:changed）重读会话用户，头像/姓名即时更新
useAutoRefresh(() => {
  user.value = getSessionUser()
})

// 跳转本角色个人资料 / 设置页
function go(path) {
  open.value = false
  router.push(path)
}

// 检查更新：打开更新弹窗（弹窗内完成检查/下载/安装交互）
const showUpdateDialog = ref(false)
function showUpdate() {
  open.value = false
  showUpdateDialog.value = true
}

// 切换账号弹窗状态
const showSwitch = ref(false)

// 打开切换账号弹窗：不退出当前账号
function openSwitch() {
  open.value = false
  showSwitch.value = true
}

/**
 * 切换账号：主进程已强制「先完整退出旧账号，再登录新账号」。
 * - 免密成功 → 用新用户覆盖前端会话，进入新账号角色首页
 * - 需要输密码（票据无效/过期）→ 旧账号已退出，清会话跳登录页预填该账号
 * - 任何异常 → 清会话回登录页，保证不留半登录态
 */
async function onSwitchAccount(username) {
  showSwitch.value = false
  try {
    const res = await switchAccount(username)
    const d = res && res.data
    if (res && res.success && d && d.ok && d.user) {
      setSession(d.user)
      user.value = d.user
      // 换账号：清空上个账号的标签，防止恢复出不属于新账号的页面
      clearTabs()
      router.replace(ROLE_HOME[d.user.role] || '/login')
      return
    }
    clearSession()
    router.replace('/login?pre=' + encodeURIComponent(username))
  } catch (e) {
    clearSession()
    router.replace('/login')
  }
}

// 新增账号：先完整退出当前账号，再跳登录页（账号框清空）输新账号
async function onAddNewAccount() {
  showSwitch.value = false
  try {
    await logout()
  } catch (e) {
    // 退出接口异常不阻断本地登出
  }
  clearSession()
  router.replace('/login?new=1')
}

// 退出登录：确认后调用退出接口、清除本地登录态、跳转登录页
async function doLogout() {
  open.value = false
  const ok = await dialogConfirm('确定退出登录吗？')
  if (!ok) return
  try {
    await logout()
  } catch (e) {
    // 退出接口异常不阻断本地登出
  }
  clearSession()
  router.replace('/login')
}
</script>

<style scoped>
.avatar-menu {
  position: relative;
}
.trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: none;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 8px;
}
.trigger:hover {
  background: var(--bg-hover);
}
.uname {
  font-size: 13px;
  color: var(--text);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.caret {
  color: var(--muted);
  font-size: 12px;
}
.menu {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  width: 190px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow-lg);
  z-index: 300;
  overflow: hidden;
}
.menu-user {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-hover-soft);
}
.mu-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.mu-role {
  font-size: 12px;
  color: var(--muted);
  margin-top: 2px;
}
.menu-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 10px 14px;
  border: none;
  background: none;
  font-size: 13px;
  color: var(--text-2-strong);
  cursor: pointer;
}
.menu-item:hover {
  background: var(--bg-hover);
}
.menu-item.danger {
  color: var(--danger);
}
.menu-divider {
  height: 1px;
  background: var(--border-light);
}
.pop-enter-active,
.pop-leave-active {
  transition: opacity 0.12s, transform 0.12s;
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
