<template>
  <div class="profile-page">
    <div class="profile-card">
      <div class="profile-avatar">{{ avatarText }}</div>
      <div class="profile-info">
        <h2 class="profile-name">{{ user?.username || '—' }}</h2>
        <p class="profile-sub">
          <span class="role-tag">{{ roleText }}</span>
          <span class="username">账号：{{ user?.username || '—' }}</span>
        </p>
        <dl class="profile-detail">
          <div class="detail-row">
            <dt>账号状态</dt>
            <dd>{{ statusText }}</dd>
          </div>
          <div class="detail-row">
            <dt>首次登录改密</dt>
            <dd>{{ user?.mustChangePassword ? '待修改' : '已完成' }}</dd>
          </div>
        </dl>
      </div>
    </div>
    <p class="profile-tip">当前仅展示登录会话基础信息；完整档案与个人资料维护功能将在后续迭代中提供。</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useSession } from '../../composables/useSession'
import {
  ROLE_SUPER_ADMIN,
  ROLE_GROUP_ADMIN,
  ROLE_MENTOR,
  ROLE_STUDENT,
  ACCOUNT_STATUS_ACTIVE,
  ACCOUNT_STATUS_DISABLED,
  ACCOUNT_STATUS_LEAVE
} from '../../config/constants'

const { getSessionUser } = useSession()
const user = getSessionUser()

const ROLE_TEXT = {
  [ROLE_SUPER_ADMIN]: '超级管理员',
  [ROLE_GROUP_ADMIN]: '课题组管理员',
  [ROLE_MENTOR]: '导师',
  [ROLE_STUDENT]: '学生'
}

const STATUS_TEXT = {
  [ACCOUNT_STATUS_ACTIVE]: '正常',
  [ACCOUNT_STATUS_DISABLED]: '已禁用',
  [ACCOUNT_STATUS_LEAVE]: '离组'
}

const roleText = computed(() => ROLE_TEXT[user?.role] || user?.role || '未知角色')
const statusText = computed(() => STATUS_TEXT[user?.status] || user?.status || '未知')
const avatarText = computed(() => {
  const name = user?.username || '?'
  return name.charAt(0).toUpperCase()
})
</script>

<style scoped>
.profile-page { max-width: 640px; margin: 0 auto; }
.profile-card {
  display: flex; gap: 24px; align-items: flex-start;
  background: #fff; border-radius: 14px; padding: 28px 32px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
}
.profile-avatar {
  flex: 0 0 72px; width: 72px; height: 72px; border-radius: 50%;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  color: #fff; font-size: 30px; font-weight: 700;
  display: inline-flex; align-items: center; justify-content: center;
}
.profile-info { flex: 1 1 auto; }
.profile-name { margin: 0 0 8px; font-size: 22px; color: #1f2329; }
.profile-sub { display: flex; align-items: center; gap: 10px; margin: 0 0 18px; }
.role-tag {
  padding: 3px 12px; border-radius: 999px; font-size: 12px; font-weight: 600;
  color: #0d80e0; background: #eef6ff;
}
.username { font-size: 13px; color: #8a9099; }
.profile-detail { margin: 0; }
.detail-row { display: flex; padding: 8px 0; border-bottom: 1px dashed #eceff3; }
.detail-row:last-child { border-bottom: none; }
.detail-row dt { flex: 0 0 120px; font-size: 13px; color: #8a9099; }
.detail-row dd { flex: 1 1 auto; margin: 0; font-size: 13px; color: #1f2329; }
.profile-tip { margin-top: 14px; font-size: 12px; color: #b8bec4; text-align: center; }
</style>
