<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">工作台</h2>
        <p class="page-sub">超级管理员工作台 · 平台全局管理入口</p>
      </div>
    </div>

    <!-- 统计卡：统一 stat-cards 骨架，点击卡跳转对应页面 -->
    <div class="stat-cards">
      <div class="stat-card">
        <div class="num">{{ statUsers }}</div>
        <div class="label">用户总数</div>
      </div>
      <div class="stat-card">
        <div class="num">{{ statGroups }}</div>
        <div class="label">课题组数量</div>
      </div>
      <div class="stat-card">
        <div class="num">{{ statParams }}</div>
        <div class="label">系统参数</div>
      </div>
      <div class="stat-card clickable" @click="router.push('/admin/task-overview')">
        <div class="num">{{ taskSummary.total || 0 }}</div>
        <div class="label">任务总数（总览）</div>
      </div>
    </div>

    <!-- 内容区：左列内容流 + 右列信息栏 -->
    <div class="dash-grid">
      <div class="col">
        <div class="panel"><NotificationRecentCard @go="goNotifications" /></div>
        <RecentMeetingPanel :meeting="recentMeeting" meetings-path="/admin/meetings" />
      </div>
      <div class="col">
        <WelcomeInfoPanel :fields="welcomeFields" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listUsers, listGroups, listParams, getRecentMeeting, getTaskSummary } from '../../api'
import { useSession } from '../../composables/useSession'
import NotificationRecentCard from '../../components/notification/NotificationRecentCard.vue'
import RecentMeetingPanel from '../../components/dashboard/RecentMeetingPanel.vue'
import WelcomeInfoPanel from '../../components/dashboard/WelcomeInfoPanel.vue'

// 超级管理员独立工作台（与课题组管理员 / 导师 / 学生的工作台为独立文件）
const { getSessionUser } = useSession()
const user = getSessionUser()
const router = useRouter()

function goNotifications() {
  router.push('/admin/notifications')
}

const statUsers = ref('-')
const statGroups = ref('-')
const statParams = ref('-')
const recentMeeting = ref(null)
const taskSummary = ref({})

const welcomeFields = computed(() => [
  { label: '当前账号', value: user ? user.realName || user.username : '' },
  { label: '当前角色', value: '超级管理员' },
  { label: '快捷入口', value: '左侧菜单可进入用户管理、课题组设置与系统配置' }
])

onMounted(async () => {
  const [u, g, p] = await Promise.allSettled([
    listUsers({ page: 1 }),
    listGroups({ page: 1 }),
    listParams({ page: 1 })
  ])
  if (u.status === 'fulfilled' && u.value && u.value.success) statUsers.value = (u.value.data && u.value.data.total) || 0
  if (g.status === 'fulfilled' && g.value && g.value.success) statGroups.value = (g.value.data && g.value.data.total) || 0
  if (p.status === 'fulfilled' && p.value && p.value.success) statParams.value = (p.value.data && p.value.data.total) || 0
  const r = await getRecentMeeting()
  if (r && r.success) recentMeeting.value = r.data
  const s = await getTaskSummary()
  if (s && s.success) taskSummary.value = s.data || {}
})
</script>
