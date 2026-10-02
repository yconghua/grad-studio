<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">工作台</h2>
        <p class="page-sub">学生工作台（仅显示当前学生自己的信息）</p>
      </div>
    </div>

    <div class="stat-cards" style="max-width: 640px">
      <div class="stat-card" style="cursor: pointer" @click="router.push('/student/tasks')">
        <div class="num">{{ taskSummary.total || 0 }}</div>
        <div class="label">我的任务</div>
      </div>
      <div class="stat-card" style="cursor: pointer" @click="router.push('/student/tasks')">
        <div class="num">{{ taskSummary.dueSoon || 0 }}</div>
        <div class="label">即将到期</div>
      </div>
      <div class="stat-card" style="cursor: pointer" @click="router.push('/student/tasks')">
        <div class="num">{{ taskSummary.overdue || 0 }}</div>
        <div class="label">逾期任务</div>
      </div>
      <div class="stat-card" style="cursor: pointer" @click="router.push('/student/tasks')">
        <div class="num">{{ taskSummary.done || 0 }}</div>
        <div class="label">已完成</div>
      </div>
    </div>

    <div class="panel" style="max-width: 640px">
      <NotificationRecentCard @go="goNotifications" />
    </div>

    <div class="panel" style="max-width: 640px">
      <p class="panel-title">最近会议</p>
      <template v-if="recentMeeting">
        <div class="desc-list">
          <div class="row"><span class="k">主题</span><span class="v">{{ recentMeeting.title }}</span></div>
          <div class="row"><span class="k">会议时间</span><span class="v">{{ recentMeeting.meetingTime }}</span></div>
          <div class="row"><span class="k">地点</span><span class="v">{{ recentMeeting.location || '-' }}</span></div>
          <div class="row"><span class="k">参与人数</span><span class="v">{{ recentMeeting.participantCount }} 人</span></div>
        </div>
        <div style="margin-top: 10px"><a class="btn btn-sm" href="#/student/meetings">进入会议记录</a></div>
      </template>
      <div v-else class="empty">暂无已发布会议</div>
    </div>

    <div class="panel" style="max-width: 640px">
      <p class="panel-title">欢迎使用</p>
      <div class="desc-list">
        <div class="row"><span class="k">用户名</span><span class="v">{{ user ? user.username : '' }}</span></div>
        <div class="row"><span class="k">真实姓名</span><span class="v">{{ user ? user.realName || '-' : '' }}</span></div>
        <div class="row"><span class="k">当前角色</span><span class="v">学生</span></div>
        <div class="row"><span class="k">所属课题组</span><span class="v">{{ user && user.groupId ? '已加入课题组（ID：' + user.groupId + '）' : '未加入课题组' }}</span></div>
        <div class="row"><span class="k">我的导师</span><span class="v">{{ user && user.mentorId ? '已指定导师（ID：' + user.mentorId + '）' : '暂未指定导师' }}</span></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getCurrentUser, getRecentMeeting, getTaskSummary } from '../../api'
import { useSession } from '../../composables/useSession'
import NotificationRecentCard from '../../components/notification/NotificationRecentCard.vue'

// 学生独立工作台（与其他角色工作台为独立文件）
const { getSessionUser } = useSession()
const user = ref(getSessionUser())
const recentMeeting = ref(null)
const taskSummary = ref({})
const router = useRouter()

function goNotifications() {
  router.push('/student/notifications')
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
