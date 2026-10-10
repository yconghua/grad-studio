<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">工作台</h2>
        <p class="page-sub">导师工作台 · 我的学生与任务管理入口</p>
      </div>
    </div>

    <WelcomeInfoPanel :fields="welcomeFields" />

    <!-- 看板区：核心数据卡 -->
    <div class="stat-cards">
      <div class="stat-card clickable" @click="router.push('/mentor/report')">
        <div class="num danger">{{ toReviewTotal }}</div>
        <div class="label">待批阅周报</div>
      </div>
      <div class="stat-card">
        <div class="num">{{ statStudents }}</div>
        <div class="label">我的学生</div>
      </div>
      <div class="stat-card clickable" @click="router.push('/mentor/report')">
        <div class="num">{{ stats.submitRate == null ? '-' : stats.submitRate + '%' }}</div>
        <div class="label">本周提交率（{{ stats.submitted || 0 }}/{{ stats.expected || 0 }}）</div>
      </div>
      <div class="stat-card clickable" @click="router.push('/mentor/tasks?scope=my-students')">
        <div class="num danger">{{ taskSummary.studentOverdue || 0 }}</div>
        <div class="label">学生逾期任务</div>
      </div>
    </div>

    <!-- 行动区（左列）+ 动态区（右列） -->
    <div class="dash-grid">
      <div class="col">
        <!-- 待批阅周报 -->
        <div class="panel">
          <p class="panel-title">
            待批阅周报
            <span v-if="toReviewTotal > 0" class="list-badge">{{ toReviewTotal }}</span>
            <span class="tip">点击行进入批阅</span>
          </p>
          <div v-if="toReviewList.length" class="item-list">
            <div v-for="r in toReviewList" :key="r.id" class="item" @click="router.push('/mentor/report')">
              <div class="item-main">
                <div class="item-title">{{ r.student_name || r.student_username }}<span v-if="r.is_late" class="late">补交</span></div>
                <div class="item-sub">{{ weekShortLabel(r.week_key) }} · 提交于 {{ r.submitted_at }}</div>
              </div>
              <div class="item-actions">
                <button class="btn btn-sm btn-primary" @click="router.push('/mentor/report')">批阅</button>
              </div>
            </div>
          </div>
          <div v-else class="panel-empty">暂无待批阅周报</div>
        </div>

        <!-- 本周统计速览 -->
        <div class="panel">
          <p class="panel-title">本周统计速览 <span class="tip">{{ weekShortLabel(stats.weekKey) }}</span></p>
          <div class="desc-list">
            <div class="row"><span class="k">提交率</span><span class="v">{{ stats.submitRate == null ? '-' : stats.submitRate + '%' }}</span></div>
            <div class="row"><span class="k">按时率</span><span class="v">{{ stats.onTimeRate == null ? '-' : stats.onTimeRate + '%' }}</span></div>
            <div class="row"><span class="k">已批阅</span><span class="v">{{ stats.reviewed || 0 }} 篇</span></div>
            <div class="row"><span class="k">平均评分</span><span class="v">{{ stats.avgScore == null ? '-' : stats.avgScore + ' 分' }}</span></div>
          </div>
          <div v-if="missedList.length" class="item-list" style="margin-top: 6px">
            <div class="item" v-for="s in missedList" :key="s.id">
              <div class="item-main">
                <div class="item-title">{{ s.realName || s.username }}</div>
                <div class="item-sub">本周未提交周报</div>
              </div>
              <div class="item-actions"><span class="tag tag-orange">未交</span></div>
            </div>
          </div>
        </div>

        <!-- 任务跟进 -->
        <div class="panel">
          <p class="panel-title">任务跟进</p>
          <div v-if="taskSummary.mineCreatedPendingReview" class="item">
            <div class="item-main">
              <div class="item-title">有 {{ taskSummary.mineCreatedPendingReview }} 个任务待你验收</div>
              <div class="item-sub">学生已提交进展，可验收或驳回重开</div>
            </div>
            <div class="item-actions">
              <button class="btn btn-sm btn-primary" @click="router.push('/mentor/tasks?status=3')">去验收</button>
            </div>
          </div>
          <div v-else-if="taskSummary.mineCreatedTotal" class="item">
            <div class="item-main">
              <div class="item-title">我创建的任务 {{ taskSummary.mineCreatedTotal }} 个</div>
              <div class="item-sub">进行中的任务请跟进学生进展</div>
            </div>
            <div class="item-actions">
              <button class="btn btn-sm" @click="router.push('/mentor/tasks')">查看</button>
            </div>
          </div>
          <div v-else class="panel-empty">还没有创建任务，去发布第一个任务吧</div>
        </div>
      </div>

      <div class="col">
        <!-- 最新公告 -->
        <div class="panel">
          <p class="panel-title">
            最新公告
            <span v-if="noticeUnread > 0" class="list-badge">{{ noticeUnread }}</span>
            <span class="tip">可发布公告</span>
          </p>
          <div v-if="notices.length" class="item-list">
            <div v-for="n in notices" :key="n.id" class="item" @click="router.push('/mentor/notices')">
              <div class="item-main">
                <div class="item-title">{{ n.title }}</div>
                <div class="item-sub">{{ n.publisherName }} · {{ n.publishTime }}</div>
              </div>
            </div>
          </div>
          <div v-else class="panel-empty">暂无公告</div>
        </div>

        <RecentMeetingPanel :meeting="recentMeeting" meetings-path="/mentor/meetings" />

        <!-- 聊天 -->
        <div class="panel">
          <p class="panel-title">组内聊天</p>
          <div class="item">
            <div class="item-main">
              <div class="item-title">
                与学生、组员的聊天
                <span v-if="chatUnread > 0" class="list-badge warn">{{ chatUnread }}</span>
              </div>
              <div class="item-sub">{{ chatUnread > 0 ? `有 ${chatUnread} 条未读消息` : '暂无未读消息' }}</div>
            </div>
            <div class="item-actions">
              <button class="btn btn-sm" @click="router.push('/mentor/chat')">去聊天</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listMyStudents, getRecentMeeting, getTaskSummary } from '../../api'
import { reportListToReview, reportStats } from '../../api/report'
import { listNotices, getNoticeUnreadCount } from '../../api/notice'
import { getChatUnreadCount } from '../../api/chat'
import { useSession } from '../../composables/useSession'
import { useGlobalLoading } from '../../composables/useGlobalLoading'
import RecentMeetingPanel from '../../components/dashboard/RecentMeetingPanel.vue'
import WelcomeInfoPanel from '../../components/dashboard/WelcomeInfoPanel.vue'
import { weekShortLabel } from '../../utils/labels'
import { useAutoRefresh } from '../../composables/useAutoRefresh'

// 导师独立工作台（与其他角色工作台为独立文件）
const { getSessionUser } = useSession()
const { finish } = useGlobalLoading()
const user = getSessionUser()
const router = useRouter()

const statStudents = ref('-')
const recentMeeting = ref(null)
const taskSummary = ref({})
const toReviewTotal = ref(0)
const toReviewList = ref([])
const stats = ref({})
const missedList = ref([])
const notices = ref([])
const noticeUnread = ref(0)
const chatUnread = ref(0)

const welcomeFields = computed(() => [
  { label: '当前账号', value: user ? user.realName || user.username : '' },
  { label: '当前角色', value: '导师' },
  { label: '快捷入口', value: '左侧菜单可查看自己名下的学生与任务' }
])

// 加载工作台全部数据（挂载时与数据变动时共用）
async function refreshAll() {
  const [stu, tr, st, t, n, nu, cu] = await Promise.allSettled([
    listMyStudents({ page: 1 }),
    reportListToReview(1),
    reportStats({}),
    getTaskSummary(),
    listNotices({ page: 1 }),
    getNoticeUnreadCount(),
    getChatUnreadCount()
  ])
  if (stu.status === 'fulfilled' && stu.value && stu.value.success) statStudents.value = (stu.value.data && stu.value.data.total) || 0
  if (tr.status === 'fulfilled' && tr.value && tr.value.success) {
    toReviewTotal.value = (tr.value.data && tr.value.data.total) || 0
    toReviewList.value = ((tr.value.data && tr.value.data.list) || []).slice(0, 5)
  }
  if (st.status === 'fulfilled' && st.value && st.value.success) {
    stats.value = st.value.data || {}
    missedList.value = (st.value.data && st.value.data.missedList) || []
  }
  if (t.status === 'fulfilled' && t.value && t.value.success) taskSummary.value = t.value.data || {}
  if (n.status === 'fulfilled' && n.value && n.value.success) notices.value = ((n.value.data && n.value.data.list) || []).slice(0, 3)
  if (nu.status === 'fulfilled' && nu.value && nu.value.success) noticeUnread.value = (nu.value.data && nu.value.data.unreadCount) || 0
  if (cu.status === 'fulfilled' && cu.value && cu.value.success) chatUnread.value = (cu.value.data && cu.value.data.unreadCount) || 0
  const r = await getRecentMeeting()
  if (r && r.success) recentMeeting.value = r.data
}

onMounted(async () => {
  try {
    await refreshAll()
  } finally {
    // 切换账号等全局加载流程：本页数据就绪后解除遮罩（未 begin 时无害）
    finish()
  }
})
// 数据变动（本页写操作或外部改动）后后台静默重拉
useAutoRefresh(refreshAll)
</script>

<style scoped>
.late {
  margin-left: 6px;
  font-size: 11px;
  color: var(--warning);
}
</style>
