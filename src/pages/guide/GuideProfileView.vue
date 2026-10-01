<template>
  <div class="guide-layout">
    <!-- 顶栏：品牌 + 极简头像下拉（与引导页一致，无左侧导航） -->
    <header class="topbar">
      <div class="brand">
        <img :src="logoUrl" class="brand-logo" alt="平台标识" />
        <span class="brand-name">{{ appName }}</span>
      </div>
      <UserAvatarMenu :profile-path="profilePath" minimal />
    </header>

    <!-- 内容区：返回引导页 + 公共个人资料表单 -->
    <main class="guide-content">
      <button type="button" class="back-btn" @click="goBack">← 返回引导页</button>
      <ProfileForm title="个人资料" :subtitle="subtitle" />
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import ProfileForm from '../../components/profile/ProfileForm.vue'
import UserAvatarMenu from '../../components/layout/UserAvatarMenu.vue'
import { useAppName } from '../../composables/useAppName'
import { useSession } from '../../composables/useSession'
import { ROLE_MENTOR, ROLE_STUDENT, ROLE_GROUP_ADMIN } from '../../config/constants'
import logoUrl from '../../assets/logo.ico'

// 引导页风格的个人资料页：未入组 / 未指定导师 / 组管未绑定等引导状态用户
// 在引导页点「个人资料」时进入，布局与引导页一致（顶栏 + 极简下拉，无侧栏），
// 内容复用公共 ProfileForm（自加载当前用户，不依赖角色布局）。
const router = useRouter()
const { appName } = useAppName()
const { getSessionUser } = useSession()
const user = getSessionUser()

const SUBTITLES = {
  [ROLE_MENTOR]: '导师个人资料',
  [ROLE_STUDENT]: '学生个人资料',
  [ROLE_GROUP_ADMIN]: '课题组管理员个人资料'
}
const subtitle = computed(() => (user ? SUBTITLES[user.role] || '' : ''))

// 引导页下拉的「个人资料」入口就是本页（守卫放行路径之一）
const profilePath = '/guide/profile'

// 返回引导页（用 replace 避免叠历史；引导状态下守卫保证 /guide 放行）
function goBack() {
  router.replace('/guide')
}
</script>

<style scoped>
.guide-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f5f7fa;
}
.topbar {
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
  overflow: hidden;
  text-overflow: ellipsis;
}
.guide-content {
  flex: 1;
  overflow: auto;
  padding: 20px 24px;
}
.back-btn {
  display: inline-block;
  margin-bottom: 16px;
  padding: 6px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
}
.back-btn:hover {
  background: #f5f7fa;
}
</style>
