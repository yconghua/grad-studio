<template>
  <div class="page">
    <div class="page-head">
      <div>
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
          <div class="stat-card grad-blue"><div class="stat-icon">👥</div><div class="stat-num">{{ stats.members }}</div><div class="stat-label">本组成员数</div></div>
          <div class="stat-card grad-green"><div class="stat-icon">📅</div><div class="stat-num">{{ stats.meetings }}</div><div class="stat-label">组会数</div></div>
          <div class="stat-card grad-purple"><div class="stat-icon">✅</div><div class="stat-num">{{ stats.tasks }}</div><div class="stat-label">任务总数</div></div>
          <div class="stat-card grad-orange"><div class="stat-icon">🏆</div><div class="stat-num">{{ stats.pendingAch }}</div><div class="stat-label">待审成果</div></div>
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
        <div class="stat-card grad-blue"><div class="stat-icon">🎓</div><div class="stat-num">{{ mentorStats.students }}</div><div class="stat-label">名下学生</div></div>
        <div class="stat-card grad-orange"><div class="stat-icon">📝</div><div class="stat-num">{{ mentorStats.pendingWeekly }}</div><div class="stat-label">待审周报</div></div>
        <div class="stat-card grad-green"><div class="stat-icon">🏆</div><div class="stat-num">{{ mentorStats.pendingAch }}</div><div class="stat-label">待审成果</div></div>
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
        <div class="stat-card grad-blue"><div class="stat-icon">✅</div><div class="stat-num">{{ studentStats.todoTasks }}</div><div class="stat-label">待办 / 进行中任务</div></div>
        <div class="stat-card grad-green"><div class="stat-icon">📝</div><div class="stat-num">{{ studentStats.weeklies }}</div><div class="stat-label">我的周报</div></div>
      </div>
      <div class="card">
        <h3 class="card-title">✅ 我的任务</h3>
        <div v-if="loadingStudent" class="state">加载中…</div>
        <div v-else-if="!myTasks.length" class="state">🗂️ 暂无任务</div>
        <ul v-else class="feed">
          <li v-for="t in myTasks" :key="t.id" class="feed-item clickable" @click="go('/task')">
            <span class="feed-action">{{ t.title }}</span>
            <span class="status-chip" :class="'st-' + t.status">{{ statusText(t.status) }}</span>
            <span class="feed-detail">{{ t.progress_percent || 0 }}%</span>
          </li>
        </ul>
      </div>
      <div v-if="!currentGroupId" class="card"><div class="state">请先在页头输入本组课题组ID 以查看公告</div></div>
      <div v-else class="card">
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
  listMembersByGroup, listMeetings, listTasks, listAllAchievements, listNotices,
  listStudents, listAllWeeklyReports, listMyTasks, listMyWeeklyReports
} from '../../api'

const router = useRouter()
const { isSuperAdmin, isGroupAdmin, isMentor, isStudent } = useRole()
const { currentGroupId, loadGroups } = useGroupContext()

const greeting = computed(() => {
  if (isSuperAdmin) return '平台运行概览与最近操作动态'
  if (isGroupAdmin) return '课题组运营概览与待办'
  if (isMentor) return '我的学生与待批阅事项'
  return '我的任务、周报与课题组动态'
})

function go(path) { router.push(path) }
function statusText(s) {
  return { todo: '待办', in_progress: '进行中', completed: '已完成' }[s] || s
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

// ===== 组管 =====
const stats = ref({ members: 0, meetings: 0, tasks: 0, pendingAch: 0 })
const notices = ref([])
const loadingGroup = ref(false)
async function loadGroup() {
  const gid = currentGroupId.value
  if (!gid) return
  loadingGroup.value = true
  try {
    const [m, mt, t, a, n] = await Promise.all([
      listMembersByGroup(gid),
      listMeetings(gid),
      listTasks({ group_id: gid }),
      listAllAchievements({ status: 'pending' }),
      listNotices(gid)
    ])
    stats.value = {
      members: (m && m.success ? m.members : []).length,
      meetings: (mt && mt.success ? mt.data : []).length,
      tasks: (t && t.success ? t.data : []).length,
      pendingAch: (a && a.success ? a.data : []).length
    }
    notices.value = (n && n.success ? n.notices : []).slice(0, 3)
  } finally {
    loadingGroup.value = false
  }
}

// ===== 导师 =====
const mentorStats = ref({ students: 0, pendingWeekly: 0, pendingAch: 0 })
const mentorNotices = ref([])
const loadingMentor = ref(false)
async function loadMentor() {
  loadingMentor.value = true
  try {
    const [s, w, a] = await Promise.all([listStudents(), listAllWeeklyReports({}), listAllAchievements({ status: 'pending' })])
    const allWeekly = (w && w.success ? w.data : [])
    mentorStats.value = {
      students: (s && s.success ? s.students : []).length,
      pendingWeekly: allWeekly.filter((x) => x.status === 'submitted').length,
      pendingAch: (a && a.success ? a.data : []).length
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
const studentStats = ref({ todoTasks: 0, weeklies: 0 })
const myTasks = ref([])
const studentNotices = ref([])
const loadingStudent = ref(false)
async function loadStudent() {
  loadingStudent.value = true
  try {
    const [t, w] = await Promise.all([listMyTasks(), listMyWeeklyReports()])
    const tasks = (t && t.success ? t.data : [])
    myTasks.value = tasks.filter((x) => x.status !== 'completed').slice(0, 8)
    studentStats.value = {
      todoTasks: tasks.filter((x) => x.status !== 'completed').length,
      weeklies: (w && w.success ? w.data : []).length
    }
    if (currentGroupId.value) {
      const n = await listNotices(currentGroupId.value)
      studentNotices.value = (n && n.success ? n.notices : []).slice(0, 3)
    } else {
      studentNotices.value = []
    }
  } finally {
    loadingStudent.value = false
  }
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
.page-head { display: flex; justify-content: space-between; align-items: flex-start; }
.page-title { margin: 0; font-size: 18px; color: #1f2329; }
.page-desc { margin: 4px 0 0; font-size: 13px; color: #8a9099; }
.card { background: #fff; border: 1px solid #eceff3; border-radius: 12px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04); padding: 18px 20px; }
.card-title { margin: 0 0 12px; font-size: 15px; color: #1f2329; }

.stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.stat-grid:has(.stat-card:nth-child(3)) { }
.stat-card { border-radius: 12px; padding: 18px; color: #fff; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06); }
.grad-blue { background: linear-gradient(135deg, #0d80e0, #4aa8f5); }
.grad-green { background: linear-gradient(135deg, #19a558, #4cc77f); }
.grad-orange { background: linear-gradient(135deg, #f5a623, #f7c948); }
.grad-purple { background: linear-gradient(135deg, #7c5cff, #a78bfa); }
.stat-icon { font-size: 22px; }
.stat-num { font-size: 30px; font-weight: 700; line-height: 1.3; }
.stat-label { font-size: 13px; opacity: 0.92; }

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
.st-completed { background: #e8f7ee; color: #19a558; }
</style>
