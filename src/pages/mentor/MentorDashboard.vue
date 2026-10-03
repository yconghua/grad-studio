<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">工作台</h2>
        <p class="page-sub">导师工作台 · 我的学生与任务管理入口</p>
      </div>
    </div>

    <!-- 统计卡：统一 stat-cards 骨架，点击卡跳转对应页面 -->
    <div class="stat-cards">
      <div class="stat-card">
        <div class="num">{{ statStudents }}</div>
        <div class="label">我的学生</div>
      </div>
      <div class="stat-card clickable" @click="router.push('/mentor/tasks')">
        <div class="num">{{ taskSummary.mineCreatedTotal || 0 }}</div>
        <div class="label">我创建的任务</div>
      </div>
      <div class="stat-card clickable" @click="router.push('/mentor/tasks?scope=mine-participated')">
        <div class="num">{{ taskSummary.mineParticipatedTotal || 0 }}</div>
        <div class="label">我参与的任务</div>
      </div>
      <div class="stat-card clickable" @click="router.push('/mentor/tasks?scope=my-students')">
        <div class="num">{{ taskSummary.studentOverdue || 0 }}</div>
        <div class="label">学生逾期任务</div>
      </div>
    </div>

    <!-- 内容区：左列内容流 + 右列信息栏 -->
    <div class="dash-grid">
      <div class="col">
        <div class="panel"><NotificationRecentCard @go="goNotifications" /></div>
        <RecentMeetingPanel :meeting="recentMeeting" meetings-path="/mentor/meetings" />
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
import { listMyStudents, getRecentMeeting, getTaskSummary } from '../../api'
import { useSession } from '../../composables/useSession'
import NotificationRecentCard from '../../components/notification/NotificationRecentCard.vue'
import RecentMeetingPanel from '../../components/dashboard/RecentMeetingPanel.vue'
import WelcomeInfoPanel from '../../components/dashboard/WelcomeInfoPanel.vue'

// 导师独立工作台（与其他角色工作台为独立文件）
const { getSessionUser } = useSession()
const user = getSessionUser()
const router = useRouter()

function goNotifications() {
  router.push('/mentor/notifications')
}

const statStudents = ref('-')
const recentMeeting = ref(null)
const taskSummary = ref({})

const welcomeFields = computed(() => [
  { label: '当前账号', value: user ? user.realName || user.username : '' },
  { label: '当前角色', value: '导师' },
  { label: '快捷入口', value: '左侧菜单可查看自己名下的学生与任务' }
])

onMounted(async () => {
  const res = await listMyStudents({ page: 1 })
  if (res && res.success) statStudents.value = (res.data && res.data.total) || 0
  const r = await getRecentMeeting()
  if (r && r.success) recentMeeting.value = r.data
  const t = await getTaskSummary()
  if (t && t.success) taskSummary.value = t.data || {}
})
</script>
