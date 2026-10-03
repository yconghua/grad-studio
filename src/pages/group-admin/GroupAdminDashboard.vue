<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">工作台</h2>
        <p class="page-sub">课题组管理员工作台 · 本课题组管理入口</p>
      </div>
    </div>

    <!-- 统计卡：统一 stat-cards 骨架，点击卡跳转对应页面 -->
    <div class="stat-cards">
      <div class="stat-card">
        <div class="num">{{ group ? group.name : '-' }}</div>
        <div class="label">当前课题组</div>
      </div>
      <div class="stat-card">
        <div class="num">{{ statMentors }}</div>
        <div class="label">本组导师</div>
      </div>
      <div class="stat-card">
        <div class="num">{{ statStudents }}</div>
        <div class="label">本组学生</div>
      </div>
      <div class="stat-card clickable" @click="router.push('/group-admin/tasks?status=3')">
        <div class="num">{{ taskSummary.mineCreatedPendingReview || 0 }}</div>
        <div class="label">我创建的待验收</div>
      </div>
      <div class="stat-card clickable" @click="router.push('/group-admin/tasks')">
        <div class="num">{{ taskSummary.groupTotal || 0 }}</div>
        <div class="label">本组任务 / 逾期 {{ taskSummary.groupOverdue || 0 }}</div>
      </div>
      <div class="stat-card clickable" @click="router.push('/group-admin/tasks')">
        <div class="num">{{ taskSummary.groupCompletionRate || 0 }}%</div>
        <div class="label">本组完成率</div>
      </div>
    </div>

    <!-- 内容区：左列内容流 + 右列信息栏 -->
    <div class="dash-grid">
      <div class="col">
        <div class="panel"><NotificationRecentCard @go="goNotifications" /></div>
        <RecentMeetingPanel :meeting="recentMeeting" meetings-path="/group-admin/meetings" />
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
import { getOwnGroup, listMembers, getRecentMeeting, getTaskSummary } from '../../api'
import { useSession } from '../../composables/useSession'
import NotificationRecentCard from '../../components/notification/NotificationRecentCard.vue'
import RecentMeetingPanel from '../../components/dashboard/RecentMeetingPanel.vue'
import WelcomeInfoPanel from '../../components/dashboard/WelcomeInfoPanel.vue'

// 课题组管理员独立工作台（与其他角色工作台为独立文件）
const { getSessionUser } = useSession()
const user = getSessionUser()
const router = useRouter()

function goNotifications() {
  router.push('/group-admin/notifications')
}

const group = ref(null)
const statMentors = ref('-')
const statStudents = ref('-')
const recentMeeting = ref(null)
const taskSummary = ref({})

const welcomeFields = computed(() => [
  { label: '当前账号', value: user ? user.realName || user.username : '' },
  { label: '当前角色', value: '课题组管理员' },
  { label: '所属课题组', value: group.value ? group.value.name : '-' },
  { label: '课题组编号', value: group.value ? group.value.code : '-' },
  { label: '快捷入口', value: '左侧菜单可设置本课题组、管理成员与师生关系' }
])

onMounted(async () => {
  const [g, m, s] = await Promise.allSettled([
    getOwnGroup(),
    listMembers({ page: 1, role: 'mentor' }),
    listMembers({ page: 1, role: 'student' })
  ])
  if (g.status === 'fulfilled' && g.value && g.value.success) group.value = g.value.data
  if (m.status === 'fulfilled' && m.value && m.value.success) statMentors.value = (m.value.data && m.value.data.total) || 0
  if (s.status === 'fulfilled' && s.value && s.value.success) statStudents.value = (s.value.data && s.value.data.total) || 0
  const r = await getRecentMeeting()
  if (r && r.success) recentMeeting.value = r.data
  const t = await getTaskSummary()
  if (t && t.success) taskSummary.value = t.data || {}
})
</script>
