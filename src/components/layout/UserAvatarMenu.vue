<template>
  <div class="avatar-menu" ref="rootRef">
    <button type="button" class="trigger" @click.stop="open = !open">
      <img v-if="user && user.avatar" :src="user.avatar" class="avatar" alt="头像" />
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
        <button type="button" class="menu-item" @click="showIntroduction">系统简介</button>
        <button type="button" class="menu-item" @click="go(settingsPath)">设置</button>
        <button type="button" class="menu-item" @click="showUpdate">检查更新</button>
        <div class="menu-divider"></div>
        <button type="button" class="menu-item danger" @click="doLogout">退出登录</button>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useSession } from '../../composables/useSession'
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'
import { getIntroduction, checkUpdate, logout } from '../../api'
import { ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN, ROLE_MENTOR, ROLE_STUDENT } from '../../config/constants'

// 头像下拉公共组件：菜单项顺序固定
// 1 个人资料 / 2 系统简介 / 3 设置 / 4 检查更新 / 5 退出登录
// 个人资料与设置的跳转地址由各角色布局传入（按角色路由不同）
const props = defineProps({
  profilePath: { type: String, required: true },
  settingsPath: { type: String, required: true }
})

const router = useRouter()
const { getSessionUser, clearSession } = useSession()

const user = getSessionUser()
const open = ref(false)
const rootRef = ref(null)

const ROLE_TEXT = {
  [ROLE_SUPER_ADMIN]: '超级管理员',
  [ROLE_GROUP_ADMIN]: '课题组管理员',
  [ROLE_MENTOR]: '导师',
  [ROLE_STUDENT]: '学生'
}
const roleText = computed(() => (user ? ROLE_TEXT[user.role] || user.role : ''))
const avatarChar = computed(() => {
  const name = (user && (user.realName || user.username)) || '?'
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

// 跳转本角色个人资料 / 设置页
function go(path) {
  open.value = false
  router.push(path)
}

// 系统简介：读取公共接口并弹窗展示
async function showIntroduction() {
  open.value = false
  try {
    const res = await getIntroduction()
    if (res && res.success) {
      const d = res.data || {}
      dialogAlert(`${d.name || '课题组科研管理平台'} v${d.version || ''}\n\n${d.introduction || '暂无简介'}`)
    } else {
      dialogAlert((res && res.message) || '读取系统简介失败')
    }
  } catch (e) {
    dialogAlert('读取系统简介失败')
  }
}

// 检查更新：暂时返回当前版本 + 已是最新版本
async function showUpdate() {
  open.value = false
  try {
    const res = await checkUpdate()
    if (res && res.success) {
      const d = res.data || {}
      dialogAlert(`当前版本：v${d.currentVersion || ''}\n${d.message || '当前已是最新版本'}`)
    } else {
      dialogAlert((res && res.message) || '检查更新失败')
    }
  } catch (e) {
    dialogAlert('检查更新失败')
  }
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
  background: #f5f7fa;
}
.uname {
  font-size: 13px;
  color: #1f2329;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.caret {
  color: #8a919f;
  font-size: 12px;
}
.menu {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  width: 190px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  z-index: 300;
  overflow: hidden;
}
.menu-user {
  padding: 12px 14px;
  border-bottom: 1px solid #f0f1f3;
  background: #fafbfc;
}
.mu-name {
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}
.mu-role {
  font-size: 12px;
  color: #8a919f;
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
  color: #374151;
  cursor: pointer;
}
.menu-item:hover {
  background: #f5f7fa;
}
.menu-item.danger {
  color: #e5484d;
}
.menu-divider {
  height: 1px;
  background: #f0f1f3;
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
