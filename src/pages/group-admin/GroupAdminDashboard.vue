<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">工作台</h2>
        <p class="page-sub">课题组管理员工作台（本课题组管理入口）</p>
      </div>
    </div>

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
        <div style="margin-top: 10px"><a class="btn btn-sm" href="#/group-admin/meetings">进入会议记录</a></div>
      </template>
      <div v-else class="empty">暂无已发布会议</div>
    </div>

    <div class="panel">
      <p class="panel-title">欢迎使用</p>
      <div class="desc-list">
        <div class="row"><span class="k">当前账号</span><span class="v">{{ user ? user.realName || user.username : '' }}</span></div>
        <div class="row"><span class="k">当前角色</span><span class="v">课题组管理员</span></div>
        <div class="row"><span class="k">课题组唯一标识号</span><span class="v" style="font-family: monospace">{{ group ? group.code : '-' }}</span></div>
        <div class="row"><span class="k">快捷入口</span><span class="v">左侧菜单可设置本课题组、管理成员与师生关系</span></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getOwnGroup, listMembers, getRecentMeeting } from '../../api'
import { useSession } from '../../composables/useSession'
import NotificationRecentCard from '../../components/notification/NotificationRecentCard.vue'

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
})
</script>
