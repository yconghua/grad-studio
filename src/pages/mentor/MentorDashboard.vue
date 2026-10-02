<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">工作台</h2>
        <p class="page-sub">导师工作台（我的学生管理入口）</p>
      </div>
    </div>

    <div class="stat-cards">
      <div class="stat-card">
        <div class="num">{{ statStudents }}</div>
        <div class="label">我的学生</div>
      </div>
      <div class="stat-card" style="cursor: pointer" @click="router.push('/mentor/tasks')">
        <div class="num">{{ taskSummary.mineCreatedTotal || 0 }}</div>
        <div class="label">我创建的任务</div>
      </div>
      <div class="stat-card" style="cursor: pointer" @click="router.push('/mentor/tasks?scope=mine-participated')">
        <div class="num">{{ taskSummary.mineParticipatedTotal || 0 }}</div>
        <div class="label">我参与的任务</div>
      </div>
      <div class="stat-card" style="cursor: pointer" @click="router.push('/mentor/tasks?scope=my-students')">
        <div class="num">{{ taskSummary.studentOverdue || 0 }}</div>
        <div class="label">学生逾期任务</div>
      </div>
    </div>

    <div class="panel">
      <NotificationRecentCard @go="goNotifications" />
    </div>

    <div class="panel">
      <p class="panel-title">最近会议</p>
      <template v-if="recentMeeting">
        <div class="desc-list">
          <div class="row"><span class="k">主题</span><span class="v">{{ recentMeeting.title }}</span></div>
          <div class="row"><span class="k">会议时间</span><span class="v">{{ recentMeeting.meetingTime }}</span></div>
          <div class="row"><span class="k">地点</span><span class="v">{{ recentMeeting.location || '-' }}</span></div>
          <div class="row"><span class="k">参与人数</span><span class="v">{{ recentMeeting.participantCount }} 人</span></div>
        </div>
        <div style="margin-top: 10px"><a class="btn btn-sm" href="#/mentor/meetings">进入会议记录</a></div>
      </template>
      <div v-else class="empty">暂无已发布会议</div>
    </div>

    <div class="panel">
      <p class="panel-title">欢迎使用</p>
      <div class="desc-list">
        <div class="row"><span class="k">当前账号</span><span class="v">{{ user ? user.realName || user.username : '' }}</span></div>
        <div class="row"><span class="k">当前角色</span><span class="v">导师</span></div>
        <div class="row"><span class="k">快捷入口</span><span class="v">左侧菜单可查看自己名下的学生</span></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listMyStudents, getRecentMeeting, getTaskSummary } from '../../api'
import { useSession } from '../../composables/useSession'
import NotificationRecentCard from '../../components/notification/NotificationRecentCard.vue'

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

onMounted(async () => {
  const res = await listMyStudents({ page: 1 })
  if (res && res.success) statStudents.value = (res.data && res.data.total) || 0
  const r = await getRecentMeeting()
  if (r && r.success) recentMeeting.value = r.data
  const t = await getTaskSummary()
  if (t && t.success) taskSummary.value = t.data || {}
})
</script>
