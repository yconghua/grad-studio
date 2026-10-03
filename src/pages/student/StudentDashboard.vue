<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">工作台</h2>
        <p class="page-sub">学生工作台 · 我的任务与个人信息</p>
      </div>
    </div>

    <!-- 统计卡：统一 stat-cards 骨架，点击卡跳转对应页面 -->
    <div class="stat-cards">
      <div class="stat-card clickable" @click="router.push('/student/tasks')">
        <div class="num">{{ taskSummary.total || 0 }}</div>
        <div class="label">我的任务</div>
      </div>
      <div class="stat-card clickable" @click="router.push('/student/tasks')">
        <div class="num">{{ taskSummary.dueSoon || 0 }}</div>
        <div class="label">即将到期</div>
      </div>
      <div class="stat-card clickable" @click="router.push('/student/tasks')">
        <div class="num">{{ taskSummary.overdue || 0 }}</div>
        <div class="label">逾期任务</div>
      </div>
      <div class="stat-card clickable" @click="router.push('/student/tasks')">
        <div class="num">{{ taskSummary.done || 0 }}</div>
        <div class="label">已完成</div>
      </div>
    </div>

    <!-- 内容区：左列内容流 + 右列信息栏 -->
    <div class="dash-grid">
      <div class="col">
        <div class="panel"><NotificationRecentCard @go="goNotifications" /></div>
        <RecentMeetingPanel :meeting="recentMeeting" meetings-path="/student/meetings" />
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
import { getCurrentUser, getRecentMeeting, getTaskSummary } from '../../api'
import { useSession } from '../../composables/useSession'
import NotificationRecentCard from '../../components/notification/NotificationRecentCard.vue'
import RecentMeetingPanel from '../../components/dashboard/RecentMeetingPanel.vue'
import WelcomeInfoPanel from '../../components/dashboard/WelcomeInfoPanel.vue'

// 学生独立工作台（与其他角色工作台为独立文件）
const { getSessionUser } = useSession()
const user = ref(getSessionUser())
const recentMeeting = ref(null)
const taskSummary = ref({})
const router = useRouter()

function goNotifications() {
  router.push('/student/notifications')
}

const welcomeFields = computed(() => {
  const u = user.value || {}
  return [
    { label: '当前账号', value: u.username || '' },
    { label: '真实姓名', value: u.realName || '-' },
    { label: '当前角色', value: '学生' },
    { label: '所属课题组', value: u.groupId ? (u.groupName ? `已加入课题组（${u.groupName}）` : `已加入课题组（ID：${u.groupId}）`) : '未加入课题组' },
    { label: '我的导师', value: mentorText(u) },
    { label: '快捷入口', value: '左侧菜单可查看我的任务、周报与组会' }
  ]
})

// 导师显示「姓名（账号）」，未填真实姓名时只显示账号
function mentorText(u) {
  if (!u.mentorId) return '暂未指定导师'
  if (u.mentorRealName) return `${u.mentorRealName}（${u.mentorUsername || ''}）`
  return u.mentorUsername || '暂未指定导师'
}

// 回库刷新，保证课题组 / 导师信息最新
onMounted(async () => {
  const res = await getCurrentUser()
  if (res && res.success) user.value = res.data
  const r = await getRecentMeeting()
  if (r && r.success) recentMeeting.value = r.data
  const t = await getTaskSummary()
  if (t && t.success) taskSummary.value = t.data || {}
})
</script>
