<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">工作台</h2>
        <p class="page-sub">学生工作台 · 我的任务与个人信息</p>
      </div>
    </div>

    <WelcomeInfoPanel :fields="welcomeFields" />

    <!-- 看板区：核心数据卡 -->
    <div class="stat-cards">
      <div class="stat-card clickable" @click="router.push('/student/report')">
        <div class="num">{{ myWeek ? reportStatusText(myWeek.status) : '未写' }}</div>
        <div class="label">本周周报 · {{ myWeek ? weekShortLabel(myWeek.week_key) : '待开始' }}</div>
      </div>
      <div class="stat-card clickable" @click="router.push('/student/tasks')">
        <div class="num">{{ taskSummary.total || 0 }}</div>
        <div class="label">我的任务</div>
      </div>
      <div class="stat-card clickable" @click="router.push('/student/tasks')">
        <div class="num">{{ taskSummary.dueSoon || 0 }}</div>
        <div class="label">即将到期</div>
      </div>
      <div class="stat-card clickable" @click="router.push('/student/tasks')">
        <div class="num danger">{{ taskSummary.overdue || 0 }}</div>
        <div class="label">逾期任务</div>
      </div>
      <div class="stat-card clickable" @click="router.push('/student/academic')">
        <div class="num">{{ academic ? progressPct + '%' : '—' }}</div>
        <div class="label">学业档案进度{{ academic ? ' · ' + academic.summary.done + '/' + academic.summary.total : '' }}</div>
      </div>
    </div>

    <!-- 行动区（左列）+ 动态区（右列） -->
    <div class="dash-grid">
      <div class="col">
        <!-- 周报待办 -->
        <div class="panel">
          <p class="panel-title">
            周报待办
            <span v-if="myWeek && myWeek.status === 'returned'" class="list-badge">打回</span>
          </p>
          <template v-if="!myWeek">
            <div class="item">
              <div class="item-main">
                <div class="item-title">本周还没有写周报</div>
                <div class="item-sub">四段式填写：本周工作 / 遇到的问题 / 下周计划 / 需要导师帮助</div>
              </div>
              <div class="item-actions">
                <button class="btn btn-sm btn-primary" @click="router.push('/student/report')">写周报</button>
              </div>
            </div>
          </template>
          <template v-else-if="myWeek.status === 'draft'">
            <div class="item">
              <div class="item-main">
                <div class="item-title">周报草稿已保存</div>
                <div class="item-sub">记得在截止前提交，提交后不可再编辑（可撤回）</div>
              </div>
              <div class="item-actions">
                <button class="btn btn-sm btn-primary" @click="router.push('/student/report')">继续编辑</button>
              </div>
            </div>
          </template>
          <template v-else-if="myWeek.status === 'returned'">
            <div class="item">
              <div class="item-main">
                <div class="item-title">周报被打回，请修改后重新提交</div>
                <div class="item-sub">导师评语：{{ myWeek.review_comment || '无' }}</div>
              </div>
              <div class="item-actions">
                <button class="btn btn-sm btn-primary" @click="router.push('/student/report')">修改并重新提交</button>
              </div>
            </div>
          </template>
          <template v-else-if="myWeek.status === 'submitted'">
            <div class="item">
              <div class="item-main">
                <div class="item-title">周报已提交，等待导师批阅</div>
                <div class="item-sub">批阅结果将通过通知中心提醒你</div>
              </div>
              <div class="item-actions">
                <button class="btn btn-sm" @click="router.push('/student/report')">查看</button>
              </div>
            </div>
          </template>
          <template v-else-if="myWeek.status === 'reviewed'">
            <div class="item">
              <div class="item-main">
                <div class="item-title">
                  本周周报已批阅
                  <span v-if="myWeek.review_score" class="score">评分 {{ myWeek.review_score }} 分</span>
                </div>
                <div class="item-sub">导师评语：{{ myWeek.review_comment || '无' }}</div>
              </div>
              <div class="item-actions">
                <button class="btn btn-sm" @click="router.push('/student/report')">查看</button>
              </div>
            </div>
          </template>
        </div>

        <!-- 我的周报 -->
        <div class="panel">
          <p class="panel-title">我的周报 <span class="tip">近 3 篇</span></p>
          <div v-if="myReports.length" class="item-list">
            <div v-for="r in myReports" :key="r.id" class="item" @click="router.push('/student/report')">
              <div class="item-main">
                <div class="item-title">{{ weekShortLabel(r.week_key) }}</div>
                <div class="item-sub">
                  {{ reportStatusText(r.status) }}<span v-if="r.review_score"> · {{ r.review_score }} 分</span>
                </div>
              </div>
              <div class="item-actions">
                <button class="btn btn-sm" @click="router.push('/student/report')">查看</button>
              </div>
            </div>
          </div>
          <div v-else class="panel-empty">暂无周报记录，去写第一篇吧</div>
        </div>

        <!-- 任务待办 -->
        <div class="panel">
          <p class="panel-title">任务待办 <span class="tip">点击卡片直达任务列表</span></p>
          <div v-if="taskSummary.overdue" class="item">
            <div class="item-main">
              <div class="item-title">有 {{ taskSummary.overdue }} 个任务已逾期</div>
              <div class="item-sub">逾期任务请尽快补充进展或联系负责人</div>
            </div>
            <div class="item-actions">
              <button class="btn btn-sm btn-danger" @click="router.push('/student/tasks')">去处理</button>
            </div>
          </div>
          <div v-else-if="taskSummary.dueSoon" class="item">
            <div class="item-main">
              <div class="item-title">有 {{ taskSummary.dueSoon }} 个任务即将到期</div>
              <div class="item-sub">请留意截止时间，及时提交进展</div>
            </div>
            <div class="item-actions">
              <button class="btn btn-sm" @click="router.push('/student/tasks')">查看</button>
            </div>
          </div>
          <div v-else class="panel-empty">暂无逾期或即将到期的任务</div>
        </div>
      </div>

      <div class="col">
        <!-- 学业档案进度 -->
        <div class="panel">
          <p class="panel-title">
            学业档案进度
            <span class="tip">点击进入时间线</span>
            <span v-if="academic && academic.summary.done === academic.summary.total" class="list-badge">已完成</span>
          </p>
          <template v-if="academic">
            <div class="item" @click="router.push('/student/academic')">
              <div class="item-main">
                <div class="item-title">{{ academic.stageTypeLabel || '培养中' }} · 完成率 {{ progressPct }}%</div>
                <div class="ac-progress">
                  <div class="ac-progress__bar" :style="{ width: progressPct + '%' }"></div>
                </div>
                <div class="item-sub">已完成 {{ academic.summary.done }} / {{ academic.summary.total }} 个节点</div>
              </div>
              <div class="item-actions">
                <button class="btn btn-sm" @click="router.push('/student/academic')">查看</button>
              </div>
            </div>
            <div v-for="n in remindNodes" :key="n.nodeKey" class="item" @click="router.push('/student/academic')">
              <div class="item-main">
                <div class="item-title">{{ n.nodeName }}</div>
                <div class="item-sub">{{ n.record && n.record.status === 'pending' ? '已填写，待提交确认' : '尚未填写' }}</div>
              </div>
              <div class="item-actions">
                <button class="btn btn-sm" @click="router.push('/student/academic')">{{ n.record && n.record.status === 'pending' ? '去提交' : '去填写' }}</button>
              </div>
            </div>
            <div v-if="!remindNodes.length" class="panel-empty">全部学业节点已完成，无需处理</div>
          </template>
          <div v-else class="panel-empty">学业档案加载中…</div>
        </div>

        <!-- 最新公告 -->
        <div class="panel">
          <p class="panel-title">
            最新公告
            <span v-if="noticeUnread > 0" class="list-badge">{{ noticeUnread }}</span>
            <span class="tip" style="float: right">点击查看全部</span>
          </p>
          <div v-if="notices.length" class="item-list">
            <div v-for="n in notices" :key="n.id" class="item" @click="router.push('/student/notices')">
              <div class="item-main">
                <div class="item-title">{{ n.title }}</div>
                <div class="item-sub">{{ n.publisherName }} · {{ n.publishTime }}</div>
              </div>
            </div>
          </div>
          <div v-else class="panel-empty">暂无公告</div>
        </div>

        <RecentMeetingPanel :meeting="recentMeeting" meetings-path="/student/meetings" />

        <!-- 聊天 · 笔记 -->
        <div class="panel">
          <p class="panel-title">聊天 · 笔记</p>
          <div class="item">
            <div class="item-main">
              <div class="item-title">
                组内聊天
                <span v-if="chatUnread > 0" class="list-badge warn">{{ chatUnread }}</span>
              </div>
              <div class="item-sub">{{ chatUnread > 0 ? `有 ${chatUnread} 条未读消息` : '暂无未读消息' }}</div>
            </div>
            <div class="item-actions">
              <button class="btn btn-sm" @click="router.push('/student/chat')">去聊天</button>
            </div>
          </div>
          <div v-if="notes.length" class="item" @click="router.push('/student/notes')">
            <div class="item-main">
              <div class="item-title">最近笔记：{{ notes[0].title }}</div>
              <div class="item-sub">共 {{ noteTotal }} 篇笔记，点击进入笔记列表</div>
            </div>
            <div class="item-actions">
              <button class="btn btn-sm" @click="router.push('/student/notes')">管理</button>
            </div>
          </div>
          <div v-else class="item">
            <div class="item-main">
              <div class="item-title">还没有笔记</div>
              <div class="item-sub">记录文献阅读、实验数据与灵感</div>
            </div>
            <div class="item-actions">
              <button class="btn btn-sm" @click="router.push('/student/notes')">新建</button>
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
import { getCurrentUser, getRecentMeeting, getTaskSummary, getAcademicRecords } from '../../api'
import { reportMyWeek, reportListMine } from '../../api/report'
import { listNotices, getNoticeUnreadCount } from '../../api/notice'
import { getChatUnreadCount } from '../../api/chat'
import { listNotes } from '../../api/note'
import { useSession } from '../../composables/useSession'
import NotificationRecentCard from '../../components/notification/NotificationRecentCard.vue'
import RecentMeetingPanel from '../../components/dashboard/RecentMeetingPanel.vue'
import WelcomeInfoPanel from '../../components/dashboard/WelcomeInfoPanel.vue'
import { reportStatusText, weekShortLabel } from '../../utils/labels'
import { useAutoRefresh } from '../../composables/useAutoRefresh'

// 学生独立工作台（与其他角色工作台为独立文件）
const { getSessionUser } = useSession()
const user = ref(getSessionUser())
const recentMeeting = ref(null)
const taskSummary = ref({})
const myWeek = ref(null)
const myReports = ref([])
const notices = ref([])
const noticeUnread = ref(0)
const chatUnread = ref(0)
const notes = ref([])
const noteTotal = ref(0)
const academic = ref(null)
const router = useRouter()

// 学业档案完成率（0-100 整数）
const progressPct = computed(() => {
  const s = academic.value && academic.value.summary
  if (!s || !s.total) return 0
  return Math.round((s.done / s.total) * 100)
})
// 待处理节点提醒：未填写 / 已填写待提交（按时间线顺序）
const remindNodes = computed(() => {
  const nodes = (academic.value && academic.value.nodes) || []
  return nodes.filter((n) => !n.record || n.record.status === 'pending')
})

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
// 加载工作台全部数据（挂载时与数据变动时共用）
async function refreshAll() {
  const [u, w, m, t, n, nu, cu, ns, ac] = await Promise.allSettled([
    getCurrentUser(),
    reportMyWeek(),
    reportListMine(1),
    getTaskSummary(),
    listNotices({ page: 1 }),
    getNoticeUnreadCount(),
    getChatUnreadCount(),
    listNotes({ page: 1 }),
    getAcademicRecords()
  ])
  if (u.status === 'fulfilled' && u.value && u.value.success) user.value = u.value.data
  if (w.status === 'fulfilled' && w.value && w.value.success) myWeek.value = w.value.data
  if (m.status === 'fulfilled' && m.value && m.value.success) myReports.value = (m.value.data && m.value.data.list) || []
  if (t.status === 'fulfilled' && t.value && t.value.success) taskSummary.value = t.value.data || {}
  if (n.status === 'fulfilled' && n.value && n.value.success) notices.value = ((n.value.data && n.value.data.list) || []).slice(0, 3)
  if (nu.status === 'fulfilled' && nu.value && nu.value.success) noticeUnread.value = (nu.value.data && nu.value.data.unreadCount) || 0
  if (cu.status === 'fulfilled' && cu.value && cu.value.success) chatUnread.value = (cu.value.data && cu.value.data.unreadCount) || 0
  if (ns.status === 'fulfilled' && ns.value && ns.value.success) {
    notes.value = (ns.value.data && ns.value.data.list) || []
    noteTotal.value = (ns.value.data && ns.value.data.total) || 0
  }
  if (ac.status === 'fulfilled' && ac.value && ac.value.success) academic.value = ac.value.data
  const r = await getRecentMeeting()
  if (r && r.success) recentMeeting.value = r.data
}

onMounted(refreshAll)
// 数据变动（本页写操作或外部改动）后后台静默重拉
useAutoRefresh(refreshAll)
</script>

<style scoped>
.score {
  margin-left: 8px;
  color: var(--primary);
  font-weight: 600;
}
.ac-progress {
  width: 100%;
  height: 8px;
  margin: 6px 0 4px;
  border-radius: 4px;
  background: var(--line, #e5e7eb);
  overflow: hidden;
}
.ac-progress__bar {
  height: 100%;
  border-radius: 4px;
  background: var(--primary, #2563eb);
  transition: width 0.3s ease;
}
</style>
