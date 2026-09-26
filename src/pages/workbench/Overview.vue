<template>
  <div class="overview">
    <!-- 欢迎区 -->
    <div class="welcome card">
      <div>
        <h3 class="welcome-title">{{ greetings }}，{{ username }} 👋</h3>
        <p class="welcome-sub">{{ dateStr }} · {{ roleLabel }}工作台</p>
      </div>
      <RouterLink to="/workbench/todo" class="quick-link">+ 新建待办</RouterLink>
    </div>

    <!-- 通知公告横向滚动 -->
    <div v-if="notices.length" class="notice-bar" @click="$router.push('/workbench/notice')">
      <span class="notice-label">📢 公告</span>
      <div class="notice-scroll">
        <div class="notice-track">
          <span v-for="(n, i) in notices" :key="i" class="notice-item"><b>{{ n.title }}</b>：{{ n.content }}</span>
          <span v-for="(n, i) in notices" :key="'b' + i" class="notice-item"><b>{{ n.title }}</b>：{{ n.content }}</span>
        </div>
      </div>
    </div>

    <!-- 统计卡片：管理员 / 导师 / 学生 各不同 -->
    <div class="stat-grid">
      <!-- 管理员：全系统统计 -->
      <template v-if="isAdmin">
        <div class="stat card" @click="$router.push('/studio/member')"><div class="stat-num">{{ ovData.memberTotal }}</div><div class="stat-label">成员总数</div></div>
        <div class="stat card" @click="$router.push('/studio/member')"><div class="stat-num">{{ ovData.studentTotal }}</div><div class="stat-label">学生</div></div>
        <div class="stat card" @click="$router.push('/studio/member')"><div class="stat-num">{{ ovData.mentorTotal }}</div><div class="stat-label">导师</div></div>
        <div class="stat card" @click="$router.push('/workbench/todo')"><div class="stat-num">{{ ovData.todoTotal }}</div><div class="stat-label">待办总量</div></div>
        <div class="stat card" @click="$router.push('/collaboration/task')"><div class="stat-num">{{ ovData.taskTotal }}</div><div class="stat-label">任务总量</div></div>
        <div class="stat card" @click="$router.push('/collaboration/approval')"><div class="stat-num">{{ ovData.pendingApproval }}</div><div class="stat-label">待审批</div></div>
      </template>

      <!-- 导师：名下学生 + 待办事项 -->
      <template v-else-if="isManager">
        <div class="stat card" @click="$router.push('/studio/member')"><div class="stat-num">{{ ovData.myStudentCount }}</div><div class="stat-label">名下学生</div></div>
        <div class="stat card" @click="$router.push('/collaboration/approval')"><div class="stat-num">{{ ovData.pendingApproval }}</div><div class="stat-label">待审批</div></div>
        <div class="stat card" @click="$router.push('/studio/join-leave')"><div class="stat-num">{{ ovData.pendingJoinLeave }}</div><div class="stat-label">入组待审</div></div>
        <div class="stat card" @click="$router.push('/collaboration/weekly-report')">
          <div class="stat-num" :class="{ 'num-warn': Number(ovData.missingWeeklyCount) > 0 }">{{ ovData.missingWeeklyCount }}</div>
          <div class="stat-label">本周未交周报</div>
        </div>
        <div class="stat card" @click="$router.push('/collaboration/task')"><div class="stat-num">{{ ovData.myTaskCount }}</div><div class="stat-label">名下任务</div></div>
        <div class="stat card" @click="$router.push('/profile/message')"><div class="stat-num">{{ stats.unread }}</div><div class="stat-label">未读消息</div></div>
      </template>

      <!-- 学生：个人进度 -->
      <template v-else>
        <div class="stat card" @click="$router.push('/workbench/todo')"><div class="stat-num">{{ ovData.todoTotal }}</div><div class="stat-label">我的待办</div></div>
        <div class="stat card" @click="$router.push('/profile/message')"><div class="stat-num">{{ stats.unread }}</div><div class="stat-label">未读消息</div></div>
        <div class="stat card" @click="$router.push('/collaboration/task')"><div class="stat-num">{{ ovData.taskTotal }}</div><div class="stat-label">协作任务</div></div>
        <div class="stat card" @click="$router.push('/research/paper')"><div class="stat-num">{{ ovData.paperTotal }}</div><div class="stat-label">论文</div></div>
        <div class="stat card" @click="$router.push('/research/graduation')"><div class="stat-num">{{ ovData.msDone }}/{{ ovData.msTotal }}</div><div class="stat-label">毕业进度</div></div>
      </template>
    </div>

    <!-- 三栏列表：按角色展示 -->
    <!-- 管理员：最近公告 / 待审批 / 最近任务 -->
    <div v-if="isAdmin" class="three-col">
      <div class="card section">
        <div class="section-head"><h4>最近公告</h4><RouterLink to="/workbench/notice" class="more-link">查看全部 →</RouterLink></div>
        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="!recentNotices.length" class="empty">暂无公告</div>
        <div v-else class="msg-list">
          <div v-for="n in recentNotices" :key="n.id" class="msg-item" @click="$router.push('/workbench/notice')">
            <span class="msg-dot" v-if="n.status === 'draft'"></span>
            <span class="msg-title">{{ n.title }}</span>
            <span class="msg-time">{{ fmtTime(n.created_at) }}</span>
          </div>
        </div>
      </div>
      <div class="card section">
        <div class="section-head"><h4>待审批</h4><RouterLink to="/collaboration/approval" class="more-link">查看全部 →</RouterLink></div>
        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="!recentApprovals.length" class="empty">暂无待审批</div>
        <div v-else class="msg-list">
          <div v-for="a in recentApprovals" :key="a.id" class="msg-item" @click="$router.push('/collaboration/approval')">
            <span class="meet-dot"></span>
            <span class="msg-title">{{ a.title }}</span>
            <span class="msg-time">{{ fmtTime(a.created_at) }}</span>
          </div>
        </div>
      </div>
      <div class="card section">
        <div class="section-head"><h4>最近任务</h4><RouterLink to="/collaboration/task" class="more-link">查看全部 →</RouterLink></div>
        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="!recentTasks.length" class="empty">暂无任务</div>
        <div v-else class="msg-list">
          <div v-for="t in recentTasks" :key="t.id" class="msg-item" @click="$router.push('/collaboration/task')">
            <span class="meet-dot"></span>
            <span class="msg-title">{{ t.title }}</span>
            <span class="msg-time">{{ statusText(t.status) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 导师：未交周报 / 待审批 / 最近组会 -->
    <div v-else-if="isManager" class="three-col">
      <div class="card section">
        <div class="section-head"><h4>本周未交周报</h4><RouterLink to="/collaboration/weekly-report" class="more-link">查看全部 →</RouterLink></div>
        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="!missingStudents.length" class="empty">本周学生都已提交 ✓</div>
        <div v-else class="msg-list">
          <div v-for="s in missingStudents" :key="s.id" class="msg-item">
            <span class="msg-dot"></span>
            <span class="msg-title">{{ s.real_name || s.username }}</span>
            <span class="msg-time">未交</span>
          </div>
        </div>
      </div>
      <div class="card section">
        <div class="section-head"><h4>待审批</h4><RouterLink to="/collaboration/approval" class="more-link">查看全部 →</RouterLink></div>
        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="!recentApprovals.length" class="empty">暂无待审批</div>
        <div v-else class="msg-list">
          <div v-for="a in recentApprovals" :key="a.id" class="msg-item" @click="$router.push('/collaboration/approval')">
            <span class="meet-dot"></span>
            <span class="msg-title">{{ a.title }}</span>
            <span class="msg-time">{{ fmtTime(a.created_at) }}</span>
          </div>
        </div>
      </div>
      <div class="card section">
        <div class="section-head"><h4>最近组会</h4><RouterLink to="/collaboration/meeting" class="more-link">查看全部 →</RouterLink></div>
        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="!recentMeetings.length" class="empty">暂无组会安排</div>
        <div v-else class="msg-list">
          <div v-for="mt in recentMeetings" :key="mt.id" class="msg-item" @click="$router.push('/collaboration/meeting')">
            <span class="meet-dot"></span>
            <span class="msg-title">{{ mt.title }}</span>
            <span class="msg-time">{{ fmtTime(mt.meeting_date) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 学生：最近待办 / 最新消息 / 最近组会 -->
    <div v-else class="three-col">
      <div class="card section">
        <div class="section-head"><h4>最近待办</h4><RouterLink to="/workbench/todo" class="more-link">查看全部 →</RouterLink></div>
        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="!recentTodos.length" class="empty">暂无待办，轻松一下</div>
        <div v-else class="todo-list">
          <div v-for="t in recentTodos" :key="t.id" class="todo-item">
            <span class="todo-dot" :class="t.status"></span>
            <span class="todo-title">{{ t.title }}</span>
            <span v-if="t.due_date" class="todo-due">{{ t.due_date }}</span>
          </div>
        </div>
      </div>
      <div class="card section">
        <div class="section-head"><h4>最新消息</h4><RouterLink to="/profile/message" class="more-link">查看全部 →</RouterLink></div>
        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="!recentMessages.length" class="empty">暂无消息</div>
        <div v-else class="msg-list">
          <div v-for="m in recentMessages" :key="m.id" class="msg-item" @click="goMessage(m)">
            <span class="msg-dot" v-if="m.status === 'unread'"></span>
            <span class="msg-title">{{ m.title || '（无标题）' }}</span>
            <span class="msg-time">{{ fmtTime(m.created_at) }}</span>
          </div>
        </div>
      </div>
      <div class="card section">
        <div class="section-head"><h4>最近组会</h4><RouterLink to="/collaboration/meeting" class="more-link">查看全部 →</RouterLink></div>
        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="!recentMeetings.length" class="empty">暂无组会安排</div>
        <div v-else class="msg-list">
          <div v-for="mt in recentMeetings" :key="mt.id" class="msg-item" @click="$router.push('/collaboration/meeting')">
            <span class="meet-dot"></span>
            <span class="msg-title">{{ mt.title }}</span>
            <span class="msg-time">{{ fmtTime(mt.meeting_date) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 快捷入口 -->
    <div class="card section">
      <div class="section-head"><h4>快捷入口</h4></div>
      <div class="quick-grid">
        <RouterLink to="/collaboration/task" class="quick-item">📋 任务协作</RouterLink>
        <RouterLink to="/collaboration/weekly-report" class="quick-item">📝 周报提交</RouterLink>
        <RouterLink to="/collaboration/meeting" class="quick-item">📅 组会安排</RouterLink>
        <RouterLink to="/research/paper" class="quick-item">📄 论文管理</RouterLink>
        <RouterLink to="/research/graduation" class="quick-item">🎓 毕业进度</RouterLink>
        <RouterLink to="/collaboration/forum" class="quick-item">💬 讨论区</RouterLink>
        <RouterLink to="/workbench/schedule" class="quick-item">🗓 日程安排</RouterLink>
        <RouterLink v-if="role === 'admin' || role === 'mentor'" to="/studio/member" class="quick-item">👥 成员管理</RouterLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { workbench, system, collab } from '../../api'
import { useSession } from '../../composables/useSession'
import { useRole } from '../../composables/useRole'

const router = useRouter()
const { getSessionUser } = useSession()
const { isAdmin, isManager } = useRole()
const user = getSessionUser()
const username = user ? (user.real_name || user.username) : ''
const role = user ? user.role : ''

const loading = ref(true)
const ovData = ref({})
const stats = ref({ unread: 0 })
const recentTodos = ref([])
const recentMessages = ref([])
const recentMeetings = ref([])
const recentNotices = ref([])
const recentApprovals = ref([])
const recentTasks = ref([])
const notices = ref([])

const missingStudents = computed(() => (ovData.value.missingWeeklyStudents || []))

const roleLabel = computed(() => {
  if (isAdmin) return '管理员'
  if (isManager) return '导师'
  return '学生'
})

const greetings = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 12) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
})

const dateStr = computed(() => {
  const d = new Date()
  const days = ['日', '一', '二', '三', '四', '五', '六']
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${days[d.getDay()]}`
})

const TASK_STATUS_TEXT = { todo: '待办', doing: '进行中', done: '已完成', delayed: '延期' }
function statusText(v) {
  return TASK_STATUS_TEXT[v] || v || '-'
}

function fmtTime(v) {
  return v ? String(v).slice(5, 16) : ''
}

function goMessage() {
  router.push('/profile/message')
}

onMounted(async () => {
  loading.value = true
  try {
    // 1. 角色化聚合统计（后端按角色返回）
    const ov = await workbench.overview()
    if (ov && ov.success) ovData.value = ov

    // 2. 列表区数据（按需加载）
    const needApproval = isAdmin || isManager
    const [unread, msgs, todoList, taskList, meetingList, noticeList, approvalList] = await Promise.allSettled([
      system.unreadCount(),
      system.myMessages(),
      workbench.todo.list(),
      collab.task.list(),
      collab.meeting.list(),
      workbench.notice.list(),
      needApproval ? collab.approval.list() : Promise.resolve({ success: true, list: [] })
    ])
    stats.value.unread = unread.status === 'fulfilled' && unread.value.success ? unread.value.count : 0
    recentMessages.value = msgs.status === 'fulfilled' && msgs.value.success ? (msgs.value.list || []).slice(0, 5) : []
    recentTodos.value = todoList.status === 'fulfilled' && todoList.value.success ? (todoList.value.list || []).slice(0, 5) : []
    recentTasks.value = taskList.status === 'fulfilled' && taskList.value.success ? (taskList.value.list || []).slice(0, 5) : []
    recentMeetings.value = meetingList.status === 'fulfilled' && meetingList.value.success ? (meetingList.value.list || []).slice(0, 5) : []
    recentNotices.value = noticeList.status === 'fulfilled' && noticeList.value.success ? (noticeList.value.list || []).slice(0, 5) : []
    notices.value = recentNotices.value.filter((n) => n.status === 'published').slice(0, 5)
    recentApprovals.value = approvalList.status === 'fulfilled' && approvalList.value.success
      ? (approvalList.value.list || []).filter((a) => a.status === 'pending').slice(0, 5) : []
  } catch (e) {
    console.error('[workbench.overview] 前端加载异常:', e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.overview { display: flex; flex-direction: column; gap: 16px; }
.card { background: #fff; border: 1px solid #eceff3; border-radius: 12px; padding: 20px 22px; }

.welcome { display: flex; align-items: center; justify-content: space-between; }
.welcome-title { margin: 0; font-size: 20px; font-weight: 600; color: #1f2329; }
.welcome-sub { margin: 6px 0 0; font-size: 13px; color: #8a9099; }
.quick-link {
  padding: 8px 16px; background: #0d80e0; color: #fff; border-radius: 8px;
  text-decoration: none; font-size: 13px; font-weight: 500;
}

.stat-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; }
.stat { text-align: center; cursor: pointer; transition: transform 0.15s; }
.stat:hover { transform: translateY(-2px); }
.stat-num { font-size: 28px; font-weight: 600; color: #0d80e0; }
.stat-num.num-warn { color: #fa8c16; }
.stat-label { margin-top: 4px; font-size: 12px; color: #8a9099; }

.three-col { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.section { display: flex; flex-direction: column; }
.section-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.section-head h4 { margin: 0; font-size: 15px; font-weight: 600; }
.more-link { font-size: 12px; color: #0d80e0; text-decoration: none; }
.empty { color: #8a9099; font-size: 13px; text-align: center; padding: 20px 0; }

.todo-list { display: flex; flex-direction: column; gap: 8px; }
.todo-item { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 6px 0; border-bottom: 1px solid #f5f7fa; }
.todo-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.todo-dot.todo { background: #faad14; }
.todo-dot.done { background: #19a558; }
.todo-title { flex: 1; color: #1f2329; }
.todo-due { font-size: 12px; color: #8a9099; }

.msg-list { display: flex; flex-direction: column; gap: 4px; }
.msg-item { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 8px 0; border-bottom: 1px solid #f5f7fa; cursor: pointer; }
.msg-item:hover { background: #f9fafb; }
.msg-dot { width: 8px; height: 8px; border-radius: 50%; background: #ea4335; flex-shrink: 0; }
.meet-dot { width: 8px; height: 8px; border-radius: 50%; background: #1890ff; flex-shrink: 0; }
.msg-title { flex: 1; color: #1f2329; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.msg-time { font-size: 12px; color: #8a9099; }

.quick-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.quick-item {
  padding: 14px; background: #f7f9fc; border-radius: 10px; text-align: center;
  font-size: 13px; color: #4e5969; text-decoration: none; transition: all 0.15s;
}
.notice-bar {
  display: flex; align-items: center; gap: 10px;
  background: #fffbe6; border: 1px solid #ffe58f; border-radius: 10px;
  padding: 8px 14px; cursor: pointer; overflow: hidden;
}
.notice-bar:hover { background: #fff7cc; }
.notice-label { font-size: 13px; font-weight: 600; color: #d48806; flex-shrink: 0; }
.notice-scroll { flex: 1; overflow: hidden; }
.notice-track { display: flex; gap: 40px; white-space: nowrap; animation: scroll-left 30s linear infinite; }
.notice-item { font-size: 13px; color: #614700; }
@keyframes scroll-left {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.quick-item:hover { background: #eef6ff; color: #0d80e0; }
</style>
