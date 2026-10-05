<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">工作台</h2>
        <p class="page-sub">课题组管理员工作台 · 本课题组管理入口</p>
      </div>
    </div>

    <WelcomeInfoPanel :fields="welcomeFields" />

    <!-- 看板区：核心数据卡 -->
    <div class="stat-cards">
      <div class="stat-card clickable" @click="router.push('/group-admin/members')">
        <div class="num">{{ group ? group.name : '-' }}</div>
        <div class="label">课题组 · 导师 {{ statMentors }} / 学生 {{ statStudents }}</div>
      </div>
      <div class="stat-card clickable" @click="router.push('/group-admin/report')">
        <div class="num">{{ stats.submitRate == null ? '-' : stats.submitRate + '%' }}</div>
        <div class="label">本周周报提交率（{{ stats.submitted || 0 }}/{{ stats.expected || 0 }}）</div>
      </div>
      <div class="stat-card clickable" @click="router.push('/group-admin/tasks')">
        <div class="num danger">{{ taskSummary.groupOverdue || 0 }}</div>
        <div class="label">本组逾期任务 / 共 {{ taskSummary.groupTotal || 0 }}</div>
      </div>
      <div class="stat-card clickable" @click="router.push('/group-admin/meetings')">
        <div class="num">{{ meetingStats.monthTotal || 0 }}</div>
        <div class="label">本月会议 / 完成率 {{ taskSummary.groupCompletionRate || 0 }}%</div>
      </div>
    </div>

    <!-- 行动区（左列）+ 动态区（右列） -->
    <div class="dash-grid">
      <div class="col">
        <!-- 一键催办 -->
        <div class="panel">
          <p class="panel-title">
            本周催办
            <span v-if="missedList.length" class="list-badge">{{ missedList.length }}</span>
            <span class="tip">{{ weekShortLabel(stats.weekKey) }}</span>
          </p>
          <div v-if="missedList.length" class="item-list">
            <div v-for="s in missedList" :key="s.id" class="item">
              <div class="item-main">
                <div class="item-title">{{ s.realName || s.username }}</div>
                <div class="item-sub">本周未提交周报</div>
              </div>
              <div class="item-actions"><span class="tag tag-orange">未交</span></div>
            </div>
            <div class="item" style="border-bottom: none">
              <div class="item-main">
                <div class="item-title" style="color: var(--muted)">一键提醒全部未交学生</div>
              </div>
              <div class="item-actions">
                <button class="btn btn-sm btn-primary" :disabled="reminding" @click="remindAll">
                  {{ reminding ? '催办中…' : '全部催交' }}
                </button>
              </div>
            </div>
          </div>
          <div v-else class="panel-empty">本周周报已全部提交，无需催办</div>
        </div>

        <!-- 待验收 -->
        <div class="panel">
          <p class="panel-title">待验收任务</p>
          <div v-if="taskSummary.mineCreatedPendingReview" class="item">
            <div class="item-main">
              <div class="item-title">有 {{ taskSummary.mineCreatedPendingReview }} 个任务待你验收</div>
              <div class="item-sub">学生已提交进展，可【通过】或【驳回】</div>
            </div>
            <div class="item-actions">
              <button class="btn btn-sm btn-primary" @click="router.push('/group-admin/tasks?status=3')">去验收</button>
            </div>
          </div>
          <div v-else class="panel-empty">暂无待验收任务</div>
        </div>

        <!-- 本周周报速览 -->
        <div class="panel">
          <p class="panel-title">周报合规速览 <span class="tip">{{ weekShortLabel(stats.weekKey) }}</span></p>
          <div class="desc-list">
            <div class="row"><span class="k">提交率</span><span class="v">{{ stats.submitRate == null ? '-' : stats.submitRate + '%' }}</span></div>
            <div class="row"><span class="k">按时率</span><span class="v">{{ stats.onTimeRate == null ? '-' : stats.onTimeRate + '%' }}</span></div>
            <div class="row"><span class="k">待批阅</span><span class="v">{{ (stats.submitted || 0) - (stats.reviewed || 0) > 0 ? (stats.submitted || 0) - (stats.reviewed || 0) : 0 }} 篇</span></div>
            <div class="row"><span class="k">平均评分</span><span class="v">{{ stats.avgScore == null ? '-' : stats.avgScore + ' 分' }}</span></div>
          </div>
        </div>
      </div>

      <div class="col">
        <!-- 快捷操作 -->
        <div class="panel">
          <p class="panel-title">快捷操作</p>
          <div class="dash-quick">
            <button class="btn btn-sm btn-primary" @click="router.push('/group-admin/notices')">发布公告</button>
            <button class="btn btn-sm" @click="router.push('/group-admin/meetings')">发起会议</button>
            <button class="btn btn-sm" @click="createVisible = true">分配任务</button>
            <button class="btn btn-sm" @click="router.push('/group-admin/members')">添加成员</button>
          </div>
        </div>

        <!-- 最新公告 -->
        <div class="panel">
          <p class="panel-title">最新公告</p>
          <div v-if="notices.length" class="item-list">
            <div v-for="n in notices" :key="n.id" class="item" @click="router.push('/group-admin/notices')">
              <div class="item-main">
                <div class="item-title">{{ n.title }}</div>
                <div class="item-sub">{{ n.publisherName }} · {{ n.publishTime }}</div>
              </div>
            </div>
          </div>
          <div v-else class="panel-empty">暂无公告</div>
        </div>

        <RecentMeetingPanel :meeting="recentMeeting" meetings-path="/group-admin/meetings" />
      </div>
    </div>

    <!-- 新建任务弹窗：创建成功后跳任务列表并打开新任务详情 -->
    <TaskCreateDialog
      v-if="createVisible"
      @close="createVisible = false"
      @created="onTaskCreated"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getOwnGroup, listMembers, getRecentMeeting, getTaskSummary } from '../../api'
import { reportStats, reportRemind } from '../../api/report'
import { getMeetingStats } from '../../api/meeting'
import { listNotices } from '../../api/notice'
import { useSession } from '../../composables/useSession'
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'
import RecentMeetingPanel from '../../components/dashboard/RecentMeetingPanel.vue'
import WelcomeInfoPanel from '../../components/dashboard/WelcomeInfoPanel.vue'
import TaskCreateDialog from '../../components/task/TaskCreateDialog.vue'
import { weekShortLabel } from '../../utils/labels'
import { useAutoRefresh } from '../../composables/useAutoRefresh'

// 课题组管理员独立工作台（与其他角色工作台为独立文件）
const { getSessionUser } = useSession()
const user = getSessionUser()
const router = useRouter()

const group = ref(null)
const statMentors = ref('-')
const statStudents = ref('-')
const recentMeeting = ref(null)
const taskSummary = ref({})
const stats = ref({})
const missedList = ref([])
const meetingStats = ref({})
const notices = ref([])
const reminding = ref(false)
// 新建任务弹窗
const createVisible = ref(false)

// 创建成功：跳任务列表并携带 open 参数，列表页加载后自动打开新任务详情
function onTaskCreated(id) {
  createVisible.value = false
  if (id != null) router.push({ name: 'group_admin-tasks', query: { open: id } })
}

const welcomeFields = computed(() => [
  { label: '当前账号', value: user ? user.realName || user.username : '' },
  { label: '当前角色', value: '课题组管理员' },
  { label: '所属课题组', value: group.value ? group.value.name : '-' },
  { label: '课题组编号', value: group.value ? group.value.code : '-' },
  { label: '快捷入口', value: '左侧菜单可设置本课题组、管理成员与师生关系' }
])

// 催交：向全部未交学生发送提醒（接口面向全体未交，先二次确认）
async function remindAll() {
  if (reminding.value) return
  const ok = await dialogConfirm(`将向 ${missedList.value.length} 名未交周报的学生发送催交通知，确认继续？`)
  if (!ok) return
  reminding.value = true
  try {
    const res = await reportRemind({})
    if (res && res.success) {
      dialogAlert(`已向 ${res.data.reminded || 0} 名未交学生发送催交通知`)
      loadStats()
    } else {
      dialogAlert((res && res.message) || '催交失败')
    }
  } finally {
    reminding.value = false
  }
}

async function loadStats() {
  const res = await reportStats({})
  if (res && res.success) {
    stats.value = res.data || {}
    missedList.value = (res.data && res.data.missedList) || []
  }
}

// 加载工作台全部数据（挂载时与数据变动时共用）
async function refreshAll() {
  const [g, m, s, t, ms, n] = await Promise.allSettled([
    getOwnGroup(),
    listMembers({ page: 1, role: 'mentor' }),
    listMembers({ page: 1, role: 'student' }),
    getTaskSummary(),
    getMeetingStats(''),
    listNotices({ page: 1 })
  ])
  if (g.status === 'fulfilled' && g.value && g.value.success) group.value = g.value.data
  if (m.status === 'fulfilled' && m.value && m.value.success) statMentors.value = (m.value.data && m.value.data.total) || 0
  if (s.status === 'fulfilled' && s.value && s.value.success) statStudents.value = (s.value.data && s.value.data.total) || 0
  if (t.status === 'fulfilled' && t.value && t.value.success) taskSummary.value = t.value.data || {}
  if (ms.status === 'fulfilled' && ms.value && ms.value.success) meetingStats.value = ms.value.data || {}
  if (n.status === 'fulfilled' && n.value && n.value.success) notices.value = ((n.value.data && n.value.data.list) || []).slice(0, 3)
  await loadStats()
  const r = await getRecentMeeting()
  if (r && r.success) recentMeeting.value = r.data
}

onMounted(refreshAll)
// 数据变动（本页写操作或外部改动）后后台静默重拉
useAutoRefresh(refreshAll)
</script>
