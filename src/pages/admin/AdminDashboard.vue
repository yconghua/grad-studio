<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">工作台</h2>
        <p class="page-sub">超级管理员工作台（平台全局管理入口）</p>
      </div>
    </div>

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
        <div style="margin-top: 10px"><a class="btn btn-sm" href="#/admin/meetings">进入会议记录</a></div>
      </template>
      <div v-else class="empty">暂无已发布会议</div>
    </div>

    <div class="panel">
      <p class="panel-title">欢迎使用</p>
      <div class="desc-list">
        <div class="row"><span class="k">当前账号</span><span class="v">{{ user ? user.realName || user.username : '' }}</span></div>
        <div class="row"><span class="k">当前角色</span><span class="v">超级管理员</span></div>
        <div class="row"><span class="k">快捷入口</span><span class="v">左侧菜单可进入用户管理、课题组设置与系统配置</span></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listUsers, listGroups, listParams, getRecentMeeting } from '../../api'
import { useSession } from '../../composables/useSession'
import NotificationRecentCard from '../../components/notification/NotificationRecentCard.vue'

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
})
</script>
