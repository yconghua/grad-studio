<template>
  <div class="page">
    <div class="page-head">
      <div class="header-left">
        <h2 class="page-title">🏠 工作台</h2>
        <p class="page-desc">{{ greeting }}</p>
      </div>
      <GroupSelector v-if="!isSuperAdmin" />
    </div>

    <!-- ===== 超级管理员 ===== -->
    <template v-if="isSuperAdmin">
      <div class="stat-grid">
        <div class="stat-card grad-blue">
          <div class="stat-icon">👤</div>
          <div class="stat-num">{{ userCount }}</div>
          <div class="stat-label">平台用户总数</div>
        </div>
        <div class="stat-card grad-green">
          <div class="stat-icon">🏢</div>
          <div class="stat-num">{{ groupCount }}</div>
          <div class="stat-label">课题组总数</div>
        </div>
        <div class="stat-card grad-orange">
          <div class="stat-icon">🕐</div>
          <div class="stat-num">{{ logTotal }}</div>
          <div class="stat-label">操作日志总数</div>
        </div>
      </div>
      <div class="card">
        <h3 class="card-title">最近操作日志</h3>
        <div v-if="loadingAdmin" class="state">加载中…</div>
        <div v-else-if="!adminLogs.length" class="state">🗂️ 暂无日志</div>
        <ul v-else class="feed">
          <li v-for="l in adminLogs" :key="l.id" class="feed-item">
            <span class="feed-action">{{ l.action }}</span>
            <span class="feed-who">{{ l.operator_name || l.operator_id }}</span>
            <span class="feed-detail">{{ l.detail }}</span>
            <span class="feed-time">{{ l.created_at }}</span>
          </li>
        </ul>
      </div>
    </template>

    <!-- ===== 课题组管理员 ===== -->
    <template v-else-if="isGroupAdmin">
      <div v-if="!currentGroupId" class="card"><div class="state">请先在页头选择 / 输入课题组ID</div></div>
      <template v-else>
        <div class="stat-grid">
          <div class="stat-card grad-blue stat-link" @click="go('/member')"><div class="stat-icon">👥</div><div class="stat-num">{{ stats.members }}</div><div class="stat-label">本组成员数 →</div></div>
          <div class="stat-card grad-green stat-link" @click="go('/notice')"><div class="stat-icon">📢</div><div class="stat-num">{{ stats.notices }}</div><div class="stat-label">组内公告 →</div></div>
          <div class="stat-card grad-cyan stat-link" @click="go('/meeting-publish')"><div class="stat-icon">📅</div><div class="stat-num">{{ stats.meetings }}</div><div class="stat-label">组会数 →</div></div>
          <div class="stat-card grad-purple stat-link" @click="go('/subject')"><div class="stat-icon">🔬</div><div class="stat-num">{{ stats.subjects }}</div><div class="stat-label">课题数 →</div></div>
          <div class="stat-card grad-orange stat-link" @click="go('/knowledge')"><div class="stat-icon">📚</div><div class="stat-num">{{ stats.knowledge }}</div><div class="stat-label">知识库条目 →</div></div>
          <div class="stat-card grad-red stat-link" @click="go('/settings')"><div class="stat-icon">⚙️</div><div class="stat-num">—</div><div class="stat-label">课题组设置 →</div></div>
        </div>
        <div class="card">
          <h3 class="card-title">📢 最近公告</h3>
          <div v-if="loadingGroup" class="state">加载中…</div>
          <div v-else-if="!notices.length" class="state">📭 暂无公告</div>
          <ul v-else class="notice-list">
            <li v-for="n in notices" :key="n.id" class="notice-item" @click="go('/notice')">
              <span v-if="n.is_top" class="top-badge">顶</span>
              <span class="notice-title">{{ n.title }}</span>
              <span class="feed-time">{{ n.published_at }}</span>
            </li>
          </ul>
        </div>
      </template>
    </template>

    <!-- ===== 导师 ===== -->
    <template v-else-if="isMentor">
      <div class="stat-grid">
        <div class="stat-card grad-blue stat-link" @click="go('/students')"><div class="stat-icon">🎓</div><div class="stat-num">{{ mentorStats.students }}</div><div class="stat-label">名下学生 →</div></div>
        <div class="stat-card grad-orange stat-link" @click="go('/weekly-review')"><div class="stat-icon">📝</div><div class="stat-num">{{ mentorStats.pendingWeekly }}</div><div class="stat-label">待审周报 →</div></div>
        <div class="stat-card grad-green stat-link" @click="go('/achievement')"><div class="stat-icon">🏆</div><div class="stat-num">{{ mentorStats.pendingAch }}</div><div class="stat-label">待审成果 →</div></div>
        <div class="stat-card grad-red stat-link" @click="goMeetingReports()"><div class="stat-icon">🗣️</div><div class="stat-num">{{ mentorStats.pendingReports }}</div><div class="stat-label">待审汇报 →</div></div>
      </div>
      <div v-if="!currentGroupId" class="card"><div class="state">请先在页头输入本组课题组ID 以查看公告</div></div>
      <div v-else class="card">
        <h3 class="card-title">📢 最近公告</h3>
        <div v-if="loadingMentor" class="state">加载中…</div>
        <div v-else-if="!mentorNotices.length" class="state">📭 暂无公告</div>
        <ul v-else class="notice-list">
          <li v-for="n in mentorNotices" :key="n.id" class="notice-item" @click="go('/notice')">
            <span v-if="n.is_top" class="top-badge">顶</span>
            <span class="notice-title">{{ n.title }}</span>
            <span class="feed-time">{{ n.published_at }}</span>
          </li>
        </ul>
      </div>
    </template>

    <!-- ===== 学生 ===== -->
    <template v-else-if="isStudent">
      <div class="stat-grid">
        <div class="stat-card grad-blue stat-link" @click="goMyTasks()"><div class="stat-icon">✅</div><div class="stat-num">{{ studentStats.todoTasks }}</div><div class="stat-label">待办 / 进行中任务 →</div></div>
        <div class="stat-card grad-purple stat-link" @click="goMySubjects()"><div class="stat-icon">🔬</div><div class="stat-num">{{ studentStats.subjects }}</div><div class="stat-label">我的课题 →</div></div>
        <div class="stat-card grad-green stat-link" @click="goResearchWeekly()"><div class="stat-icon">📝</div><div class="stat-num">{{ studentStats.weeklies }}</div><div class="stat-label">我的周报 →</div></div>
        <div class="stat-card grad-cyan stat-link" @click="go('/degree-progress')"><div class="stat-icon">🎓</div><div class="stat-num">{{ degreeStat.done }} / {{ degreeStat.total }}</div><div class="stat-label">培养节点完成度 →</div></div>
      </div>
      <div v-if="!currentGroupId" class="card"><div class="state">请先在页头输入本组课题组ID 以查看公告</div></div>
      <template v-else>
        <!-- 待办清单（聚合任务 / 周报 / 组会汇报 / 成果 / 学位节点）+ 我的科研动态 -->
        <div class="two-col">
          <div class="card">
            <h3 class="card-title">🔔 待办清单</h3>
            <div v-if="loadingStudent" class="state">加载中…</div>
            <div v-else-if="!todoItems.length" class="state">🎉 暂无待办，保持节奏</div>
            <ul v-else class="notice-list">
              <li v-for="(it, i) in todoItems" :key="i" class="notice-item" @click="go(it.link)">
                <span class="todo-chip" :class="'tc-' + it.type">{{ it.typeText }}</span>
                <span class="notice-title">{{ it.title }}</span>
                <span class="todo-due" :class="'due-' + it.level">{{ it.dueText }}</span>
              </li>
            </ul>
          </div>
          <div class="card">
            <h3 class="card-title">📈 我的科研动态</h3>
            <div v-if="loadingStudent" class="state">加载中…</div>
            <div v-else-if="!dynItems.length" class="state">📭 暂无动态</div>
            <ul v-else class="notice-list">
              <li v-for="(d, i) in dynItems" :key="i" class="notice-item" @click="go(d.link)">
                <span class="notice-title">{{ d.title }}</span>
                <span class="dyn-val">{{ d.value }}</span>
              </li>
            </ul>
          </div>
        </div>
        <!-- 组会安排 -->
        <div class="card">
          <h3 class="card-title">📅 组会安排</h3>
          <div v-if="loadingStudent" class="state">加载中…</div>
          <div v-else-if="!studentMeetings.length" class="state">🗓️ 暂无组会安排</div>
          <ul v-else class="notice-list">
            <li v-for="m in studentMeetings" :key="m.id" class="notice-item" @click="go('/meeting')">
              <span class="notice-title">{{ m.title }}</span>
              <span class="meeting-loc">{{ m.location || '待定' }}</span>
              <span class="feed-time">{{ fmtDT(m.start_time) }}</span>
              <span class="status-chip" :class="'mt-' + m.status">{{ meetingStatusText(m.status) }}</span>
            </li>
          </ul>
        </div>
        <!-- 最近公告 -->
        <div class="card">
          <h3 class="card-title">📢 最近公告</h3>
          <div v-if="loadingStudent" class="state">加载中…</div>
          <div v-else-if="!studentNotices.length" class="state">📭 暂无公告</div>
          <ul v-else class="notice-list">
            <li v-for="n in studentNotices" :key="n.id" class="notice-item" @click="go('/notice')">
              <span v-if="n.is_top" class="top-badge">顶</span>
              <span class="notice-title">{{ n.title }}</span>
              <span class="feed-time">{{ n.published_at }}</span>
            </li>
          </ul>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useRole } from '../../composables/useRole'
import { useGroupContext } from '../../composables/useGroupContext'
import GroupSelector from '../../components/GroupSelector.vue'
import {
  listUsers, listGroups, listOperationLogs,
  listMembersByGroup, listMeetings, listNotices, listSubjects, listKnowledge,
  listStudents, listAllWeeklyReports, listMyTasks, listMyWeeklyReports,
  listAllAchievements, listMeetingReports,
  listMyAchievements, listMyLiterature, listMyResearchLogs,
  listDegreeNodes, listDegreeRecords, getMessageUnreadCount
} from '../../api'
const router = useRouter()
const { isSuperAdmin, isGroupAdmin, isMentor, isStudent } = useRole()
const { currentGroupId, loadGroups } = useGroupContext()

const greeting = computed(() => {
  if (isSuperAdmin) return '平台运行概览与最近操作动态'
  if (isGroupAdmin) return '课题组运营概览与待办'
  if (isMentor) return '我的学生与待批阅事项'
  return '我的待办、科研动态与课题组通知'
})

function go(path) { router.push(path) }
// 点击「待审汇报」：跳到组会管理页并自动定位到「组会汇报」页签
function goMeetingReports() {
  router.push({ path: '/meeting', query: { tab: 'reports' } })
}
// 点击「我的周报」：跳到科研记录页并自动定位到「周报」页签
function goResearchWeekly() {
  router.push({ path: '/research-record', query: { tab: 'weekly' } })
}
// 点击「待办 / 进行中任务」：跳到课题与任务页并定位到「我的任务」页签
function goMyTasks() {
  router.push({ path: '/my-work', query: { tab: 'task' } })
}
// 点击「我的课题」：跳到课题与任务页并定位到「我的课题」页签
function goMySubjects() {
  router.push({ path: '/my-work', query: { tab: 'subject' } })
}

// ===== 超管 =====
const userCount = ref(0)
const groupCount = ref(0)
const logTotal = ref(0)
const adminLogs = ref([])
const loadingAdmin = ref(false)
async function loadAdmin() {
  loadingAdmin.value = true
  try {
    const [u, g, logs] = await Promise.all([listUsers(), listGroups(), listOperationLogs({ page: 1, pageSize: 5 })])
    if (u && u.success) userCount.value = (u.users || []).length
    if (g && g.success) groupCount.value = (g.groups || []).length
    if (logs && logs.success) {
      adminLogs.value = (logs.data && logs.data.list) || []
      logTotal.value = (logs.data && logs.data.total) || 0
    }
  } finally {
    loadingAdmin.value = false
  }
}

// ===== 组管（按组管职责：成员 / 公告 / 组会 / 课题 / 知识库 / 设置） =====
const stats = ref({ members: 0, notices: 0, meetings: 0, subjects: 0, knowledge: 0 })
const notices = ref([])
const loadingGroup = ref(false)
async function loadGroup() {
  const gid = currentGroupId.value
  if (!gid) return
  loadingGroup.value = true
  try {
    const [m, n, mt, s, k] = await Promise.all([
      listMembersByGroup(gid),
      listNotices(gid),
      listMeetings(gid),
      listSubjects(gid),
      listKnowledge(gid)
    ])
    stats.value = {
      members: (m && m.success ? m.members : []).length,
      notices: (n && n.success ? n.notices : []).length,
      meetings: (mt && mt.success ? mt.data : []).length,
      subjects: (s && s.success ? s.data : []).length,
      knowledge: (k && k.success ? k.data : []).length
    }
    notices.value = (n && n.success ? n.notices : []).slice(0, 3)
  } finally {
    loadingGroup.value = false
  }
}

// ===== 导师 =====
const mentorStats = ref({ students: 0, pendingWeekly: 0, pendingAch: 0, pendingReports: 0 })
const mentorNotices = ref([])
const loadingMentor = ref(false)
async function loadMentor() {
  loadingMentor.value = true
  try {
    const gid = currentGroupId.value
    const [s, w, a, r] = await Promise.all([
      listStudents(),
      listAllWeeklyReports({}),
      gid ? listAllAchievements({ status: 'pending', group_id: gid }) : Promise.resolve({ success: false, data: [] }),
      gid ? listMeetingReports({ group_id: gid }) : Promise.resolve({ success: false, data: [] })
    ])
    const allWeekly = (w && w.success ? w.data : [])
    mentorStats.value = {
      students: (s && s.success ? s.students : []).length,
      pendingWeekly: allWeekly.filter((x) => x.status === 'submitted').length,
      pendingAch: (a && a.success ? a.data : []).length,
      pendingReports: (r && r.success ? r.data : []).filter((x) => x.status === 'pending').length
    }
    if (currentGroupId.value) {
      const n = await listNotices(currentGroupId.value)
      mentorNotices.value = (n && n.success ? n.notices : []).slice(0, 3)
    } else {
      mentorNotices.value = []
    }
  } finally {
    loadingMentor.value = false
  }
}

// ===== 学生 =====
// 工作台学生视图：在原有「任务 / 课题 / 周报 + 组会安排 + 最近公告」基础上，新增
//   1) 第 4 张统计卡「培养节点完成度」（degree_node + student_degree）；
//   2) 「待办清单」聚合卡：任务临期/逾期、本周周报未交、成果被打回、组会汇报被打回、必达节点未完成；
//   3) 「我的科研动态」卡：最近批阅意见、成果审核统计、未读消息、科研日志连续天数、文献在读/未读。
// 数据全部来自既有接口，不新增后端接口、不改数据库表结构。
const studentStats = ref({ todoTasks: 0, weeklies: 0, subjects: 0 })
const studentMeetings = ref([])
const studentNotices = ref([])
const loadingStudent = ref(false)
// 培养节点整体完成情况（统计卡 + 待办清单「必达节点」提示共用）
const degreeStat = ref({ done: 0, total: 0, percent: 0, nextNode: '' })
// 待办清单：跨模块聚合，按 紧急 > 提醒 > 常规 排序后取前 6 条
const todoItems = ref([])
// 我的科研动态
const dynItems = ref([])

const pad2 = (n) => String(n).padStart(2, '0')
// 本地日期 → YYYY-MM-DD（不用 toISOString，避免 UTC 偏移导致日期差一天）
function fmtDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
// 取某天所在自然周的周一，与 weekly_report.week_start 口径保持一致
function weekStartOf(d) {
  const t = new Date(d)
  t.setHours(0, 0, 0, 0)
  const wd = t.getDay()
  t.setDate(t.getDate() + (wd === 0 ? -6 : 1 - wd))
  return fmtDate(t)
}
// ISO 周序号（用于「第 N 周周报」文案）
function isoWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return ''
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = (t.getUTCDay() + 6) % 7
  t.setUTCDate(t.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4))
  const fDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fDayNum + 3)
  return 1 + Math.round((t - firstThursday) / 604800000)
}
// 任务截止时间解析（兼容 "YYYY-MM-DD HH:mm:ss" 与 ISO 串）
function dueInfo(deadline) {
  const d = new Date(String(deadline).replace(' ', 'T'))
  if (isNaN(d.getTime())) return null
  const diffMs = d.getTime() - Date.now()
  return { d, diffMs, days: Math.floor(diffMs / 86400000), hhmm: `${pad2(d.getHours())}:${pad2(d.getMinutes())}` }
}
// 科研日志连续记录天数（自今天或昨天起向前连续计数）
function calcStreak(logs) {
  const set = new Set((logs || []).map((x) => String(x.log_date || '').slice(0, 10)).filter(Boolean))
  if (!set.size) return 0
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  if (!set.has(fmtDate(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!set.has(fmtDate(cursor))) return 0
  }
  let n = 0
  while (set.has(fmtDate(cursor))) { n += 1; cursor.setDate(cursor.getDate() - 1) }
  return n
}
// 相对时间：一小时内「刚刚」、当天「N 小时前」、一周内「N 天前」，更早回落为日期
function relTime(v) {
  if (!v) return ''
  const d = new Date(String(v).replace(' ', 'T'))
  if (isNaN(d.getTime())) return String(v).slice(0, 10)
  const diff = Date.now() - d.getTime()
  if (diff < 3600000) return '刚刚'
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 7 * 86400000) return `${Math.floor(diff / 86400000)} 天前`
  return String(v).slice(0, 10)
}
// 长文本截断（待办 / 动态条目为单行省略展示，先截短避免挤掉右侧信息）
function clip(s, n) {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n) + '…' : t
}
// 按节点 id 取本人完成记录（学生侧接口仅返回本人记录）
function recordOfId(records, nodeId) {
  return (records || []).find((r) => Number(r.node_id) === Number(nodeId)) || {}
}

async function loadStudent() {
  loadingStudent.value = true
  try {
    const gid = currentGroupId.value
    const empty = { success: false, data: [] }
    const [t, w, s, mt, ach, lit, logs, reps, dn, dr, msg] = await Promise.all([
      listMyTasks(),
      listMyWeeklyReports(),
      gid ? listSubjects(gid) : Promise.resolve(empty),
      gid ? listMeetings(gid) : Promise.resolve(empty),
      listMyAchievements(),
      listMyLiterature({}),
      listMyResearchLogs(),
      gid ? listMeetingReports({ group_id: gid }) : Promise.resolve(empty),
      gid ? listDegreeNodes(gid) : Promise.resolve(empty),
      gid ? listDegreeRecords({ group_id: gid }) : Promise.resolve(empty),
      getMessageUnreadCount()
    ])
    const tasks = (t && t.success ? t.data : []) || []
    const weeklies = (w && w.success ? w.data : []) || []
    const subjects = (s && s.success ? s.data : []) || []
    const meetings = (mt && mt.success ? mt.data : []) || []
    const achievements = (ach && ach.success ? ach.data : []) || []
    const literature = (lit && lit.success ? lit.data : []) || []
    const researchLogs = (logs && logs.success ? logs.data : []) || []
    const reports = (reps && reps.success ? reps.data : []) || []
    const nodes = (dn && dn.success ? dn.data : []) || []
    const records = (dr && dr.success ? dr.data : []) || []
    const msgUnread = (msg && msg.success && msg.data && msg.data.total) || 0

    studentStats.value = {
      todoTasks: tasks.filter((x) => x.status !== 'completed' && x.status !== 'cancelled').length,
      weeklies: weeklies.length,
      subjects: subjects.length
    }

    // ---- 培养节点完成度 + 下一个未完成的必达节点 ----
    const doneCount = records.filter((r) => r.status === 'completed').length
    const totalNodes = nodes.length
    const nextRequired = nodes
      .filter((n) => n.is_required)
      .sort((a, b) => Number(a.node_order) - Number(b.node_order))
      .find((n) => (recordOfId(records, n.id).status || 'not_started') !== 'completed')
    degreeStat.value = {
      done: doneCount,
      total: totalNodes,
      percent: totalNodes ? Math.round((doneCount / totalNodes) * 100) : 0,
      nextNode: nextRequired ? nextRequired.name : ''
    }

    // ---- 待办清单：聚合 5 类来源 ----
    const todos = []
    const LV = { danger: 0, warn: 1, normal: 2 }
    const RECENT = Date.now()

    // 1) 任务：逾期 / 当天到期 / 三日内到期；已提交的单独提示待验收
    tasks.forEach((x) => {
      if (x.status === 'completed' || x.status === 'cancelled') return
      if (x.status === 'pending_review') {
        todos.push({ type: 'task', typeText: '待验收', title: `任务「${x.title}」已提交，等待验收`, dueText: `${x.progress_percent || 100}% 已交`, level: 'normal', link: '/my-work', ts: RECENT })
        return
      }
      if (!x.deadline) {
        if (x.priority === 'high') {
          todos.push({ type: 'task', typeText: '任务', title: `高优先级任务「${x.title}」尚未完成`, dueText: '未设截止', level: 'warn', link: '/my-work', ts: RECENT })
        }
        return
      }
      const info = dueInfo(x.deadline)
      if (!info) return
      if (info.diffMs < 0) {
        const over = Math.max(1, Math.ceil(-info.diffMs / 86400000))
        todos.push({ type: 'task', typeText: '任务', title: `任务「${x.title}」已逾期`, dueText: `逾期 ${over} 天`, level: 'danger', link: '/my-work', ts: info.d.getTime() })
      } else if (info.days === 0) {
        todos.push({ type: 'task', typeText: '任务', title: `任务「${x.title}」今天到期`, dueText: `今天 ${info.hhmm} 截止`, level: 'danger', link: '/my-work', ts: info.d.getTime() })
      } else if (info.days <= 3) {
        todos.push({ type: 'task', typeText: '任务', title: `任务「${x.title}」即将到期`, dueText: `${info.days} 天后截止`, level: 'warn', link: '/my-work', ts: info.d.getTime() })
      }
    })

    // 2) 周报：本周未填报或仍为草稿（越接近周末越紧急）
    const wkStart = weekStartOf(new Date())
    const thisWeek = weeklies.find((r) => String(r.week_start || '').slice(0, 10) === wkStart)
    if (!thisWeek || thisWeek.status === 'draft') {
      const wd = new Date().getDay()
      todos.push({
        type: 'weekly',
        typeText: '周报',
        title: thisWeek ? `第 ${isoWeek(wkStart)} 周周报仍为草稿` : `第 ${isoWeek(wkStart)} 周周报尚未提交`,
        dueText: '本周日截止',
        level: wd === 0 || wd === 6 ? 'danger' : (wd === 5 ? 'warn' : 'normal'),
        link: '/research-record',
        ts: new Date(wkStart + 'T23:59:59').getTime()
      })
    }

    // 3) 科研成果被打回，待修改重交
    achievements.filter((a) => a.status === 'rejected').forEach((a) => {
      todos.push({ type: 'ach', typeText: '成果', title: `成果《${clip(a.title, 18)}》已打回，待修改重交`, dueText: '待处理', level: 'warn', link: '/achievement', ts: RECENT })
    })

    // 4) 组会汇报被打回，待修改重交（组会未指定汇报人，故不推断「应提交而未提交」）
    reports.filter((r) => r.status === 'rejected').forEach((r) => {
      todos.push({ type: 'meeting', typeText: '组会', title: `组会汇报「${clip(r.topic || '未命名', 16)}」被打回，待修改重交`, dueText: '待处理', level: 'warn', link: '/meeting', ts: RECENT })
    })

    // 5) 培养计划中尚有必达节点未完成
    if (degreeStat.value.nextNode) {
      todos.push({ type: 'degree', typeText: '学位', title: `必达节点「${degreeStat.value.nextNode}」尚未完成`, dueText: `${degreeStat.value.done} / ${degreeStat.value.total} 已完成`, level: 'normal', link: '/degree-progress', ts: RECENT })
    }

    todoItems.value = todos
      .sort((a, b) => (LV[a.level] - LV[b.level]) || (a.ts - b.ts))
      .slice(0, 6)

    // ---- 我的科研动态 ----
    const dyns = []
    const reviewed = weeklies
      .filter((r) => r.status === 'reviewed' && r.reviewed_at)
      .sort((a, b) => String(b.reviewed_at).localeCompare(String(a.reviewed_at)))
    if (reviewed[0]) {
      const rwWeek = isoWeek(String(reviewed[0].week_start || '').slice(0, 10))
      dyns.push({
        title: `${rwWeek ? `第 ${rwWeek} 周周报` : '最近周报'}已批阅${reviewed[0].review_comment ? '：' + clip(reviewed[0].review_comment, 16) : ''}`,
        value: relTime(reviewed[0].reviewed_at),
        link: '/research-record'
      })
    }
    const achApproved = achievements.filter((a) => a.status === 'approved').length
    const achPending = achievements.filter((a) => a.status === 'pending').length
    const achRejected = achievements.filter((a) => a.status === 'rejected').length
    dyns.push({
      title: `科研成果：通过 ${achApproved} · 待审核 ${achPending}${achRejected ? ' · 打回 ' + achRejected : ''}`,
      value: `共 ${achievements.length} 项`,
      link: '/achievement'
    })
    dyns.push({
      title: msgUnread > 0 ? `有 ${msgUnread} 条未读站内消息` : '站内消息已全部读完',
      value: msgUnread > 0 ? '去查看' : '消息',
      link: '/my-messages'
    })
    const streak = calcStreak(researchLogs)
    dyns.push({
      title: streak > 0 ? `已连续记录科研日志 ${streak} 天` : '今天还没有写科研日志',
      value: streak > 0 ? '保持' : '去记录',
      link: '/research-record'
    })
    const litReading = literature.filter((l) => l.read_status === 'reading').length
    const litUnread = literature.filter((l) => l.read_status === 'unread').length
    dyns.push({
      title: `文献库：在读 ${litReading} 篇 · 未读 ${litUnread} 篇`,
      value: `共 ${literature.length} 篇`,
      link: '/literature'
    })
    dynItems.value = dyns

    // ---- 组会安排：最近 3 条（按开始时间倒序，最近 / 即将进行的排前）----
    studentMeetings.value = meetings
      .filter((x) => x.status === 'published' || x.status === 'finished')
      .sort((a, b) => String(b.start_time).localeCompare(String(a.start_time)))
      .slice(0, 3)

    if (gid) {
      const n = await listNotices(gid)
      studentNotices.value = (n && n.success ? n.notices : []).slice(0, 3)
    } else {
      studentNotices.value = []
    }
  } finally {
    loadingStudent.value = false
  }
}
function fmtDT(v) {
  if (!v) return '—'
  return String(v).replace('T', ' ').slice(0, 16)
}
function meetingStatusText(s) {
  return { draft: '草稿', published: '已发布', finished: '已结束', cancelled: '已取消' }[s] || s || '—'
}

function loadRoleData() {
  if (isSuperAdmin) loadAdmin()
  else if (isGroupAdmin) loadGroup()
  else if (isMentor) loadMentor()
  else if (isStudent) loadStudent()
}

watch(currentGroupId, () => {
  if (isGroupAdmin) loadGroup()
  else if (isMentor) loadMentor()
  else if (isStudent) loadStudent()
})

onMounted(() => {
  loadGroups()
  loadRoleData()
})
</script>

<style scoped>
.page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; justify-content: space-between; align-items: center; }
.header-left { display: flex; align-items: flex-end; gap: 14px; }
.page-title { margin: 0; font-size: 18px; color: #1f2329; }
.page-desc { margin: 0 0 3px; font-size: 13px; color: #8a9099; }
.card { background: #fff; border: 1px solid #eceff3; border-radius: 12px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04); padding: 18px 20px; }
.card-title { margin: 0 0 12px; font-size: 15px; color: #1f2329; }

.stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.stat-grid:has(.stat-card:nth-child(3)) { }
.stat-card { border-radius: 12px; padding: 18px; color: #fff; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06); }
.grad-blue { background: linear-gradient(135deg, #0d80e0, #4aa8f5); }
.grad-green { background: linear-gradient(135deg, #19a558, #4cc77f); }
.grad-orange { background: linear-gradient(135deg, #f5a623, #f7c948); }
.grad-purple { background: linear-gradient(135deg, #7c5cff, #a78bfa); }
.grad-cyan { background: linear-gradient(135deg, #0fb2b0, #4cd4d2); }
.grad-red { background: linear-gradient(135deg, #e36a5e, #f0938a); }
.stat-icon { font-size: 22px; }
.stat-num { font-size: 30px; font-weight: 700; line-height: 1.3; }
.stat-label { font-size: 13px; opacity: 0.92; }
.stat-link { cursor: pointer; transition: transform 0.15s, opacity 0.15s; }
.stat-link:hover { transform: translateY(-1px); opacity: 0.92; }

.state { padding: 30px 0; text-align: center; color: #8a9099; font-size: 13px; }
.feed { list-style: none; margin: 0; padding: 0; }
.feed-item { display: flex; align-items: center; gap: 12px; padding: 10px 4px; border-bottom: 1px solid #f0f2f5; font-size: 13px; }
.feed-item:last-child { border-bottom: none; }
.feed-action { color: #0d80e0; font-weight: 600; white-space: nowrap; }
.feed-who { color: #4e5969; white-space: nowrap; }
.feed-detail { flex: 1; color: #4e5969; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.feed-time { color: #8a9099; font-size: 12px; white-space: nowrap; }
.clickable { cursor: pointer; }
.clickable:hover { background: #eef6ff; }

.notice-list { list-style: none; margin: 0; padding: 0; }
.notice-item { display: flex; align-items: center; gap: 10px; padding: 10px 4px; border-bottom: 1px solid #f0f2f5; font-size: 13px; cursor: pointer; }
.notice-item:last-child { border-bottom: none; }
.notice-item:hover .notice-title { color: #0d80e0; }
.notice-title { flex: 1; color: #1f2329; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.top-badge { background: #ea4335; color: #fff; font-size: 11px; border-radius: 4px; padding: 1px 6px; }
.status-chip { font-size: 12px; padding: 2px 8px; border-radius: 999px; }
.st-todo { background: #f2f3f5; color: #4e5969; }
.st-in_progress { background: #e6f4ff; color: #0d80e0; }
.st-pending_review { background: #fff5e6; color: #e8890c; }
.st-completed { background: #e8f7ee; color: #19a558; }
.meeting-loc { color: #8a9099; font-size: 12px; white-space: nowrap; }
.mt-published { background: #e6f4ff; color: #0d80e0; }
.mt-finished { background: #f2f3f5; color: #4e5969; }

/* 学生工作台新增：待办清单 + 科研动态 两栏布局 */
.two-col { display: grid; grid-template-columns: 1.45fr 1fr; gap: 16px; align-items: start; }
@media (max-width: 1100px) { .two-col { grid-template-columns: 1fr; } }
/* 待办条目类型标签（复用 notice-list / notice-item 的排版） */
.todo-chip { font-size: 11px; padding: 1px 7px; border-radius: 4px; background: #eef1f5; color: #4e5969; white-space: nowrap; }
.tc-task { background: #e6f1fb; color: #185fa5; }
.tc-weekly { background: #eeedfe; color: #534ab7; }
.tc-meeting { background: #e1f5ee; color: #0f6e56; }
.tc-ach { background: #faeeda; color: #854f0b; }
.tc-degree { background: #fcebeb; color: #a32d2d; }
/* 待办紧急度：danger 逾期 / 当天到期，warn 三日内或待处理 */
.todo-due { font-size: 12px; color: #8a9099; white-space: nowrap; }
.due-danger { color: #e5433f; font-weight: 600; }
.due-warn { color: #e8890c; font-weight: 600; }
/* 科研动态右侧数值 */
.dyn-val { font-size: 12px; color: #8a9099; white-space: nowrap; }
</style>
