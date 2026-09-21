<template>
  <div class="overview">
    <!-- 欢迎区 -->
    <div class="welcome card">
      <div>
        <h3 class="welcome-title">{{ greetings }}，{{ username }} 👋</h3>
        <p class="welcome-sub">{{ dateStr }} · 欢迎回到研究生工作室管理平台</p>
      </div>
      <RouterLink to="/workbench/todo" class="quick-link">+ 新建待办</RouterLink>
    </div>

    <!-- 统计卡片 -->
    <div class="stat-grid">
      <div class="stat card" @click="$router.push('/workbench/todo')">
        <div class="stat-num">{{ stats.todo }}</div>
        <div class="stat-label">我的待办</div>
      </div>
      <div class="stat card" @click="$router.push('/profile/message')">
        <div class="stat-num">{{ stats.unread }}</div>
        <div class="stat-label">未读消息</div>
      </div>
      <div class="stat card" @click="$router.push('/collaboration/task')">
        <div class="stat-num">{{ stats.task }}</div>
        <div class="stat-label">协作任务</div>
      </div>
      <div class="stat card" @click="$router.push('/research/project')">
        <div class="stat-num">{{ stats.project }}</div>
        <div class="stat-label">在研项目</div>
      </div>
      <div class="stat card" @click="$router.push('/research/paper')">
        <div class="stat-num">{{ stats.paper }}</div>
        <div class="stat-label">论文</div>
      </div>
      <div class="stat card" @click="$router.push('/collaboration/approval')">
        <div class="stat-num">{{ stats.approval }}</div>
        <div class="stat-label">待审批</div>
      </div>
    </div>

    <!-- 两栏：待办列表 + 最新消息 -->
    <div class="two-col">
      <!-- 最近待办 -->
      <div class="card section">
        <div class="section-head">
          <h4>最近待办</h4>
          <RouterLink to="/workbench/todo" class="more-link">查看全部 →</RouterLink>
        </div>
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

      <!-- 最新消息 -->
      <div class="card section">
        <div class="section-head">
          <h4>最新消息</h4>
          <RouterLink to="/profile/message" class="more-link">查看全部 →</RouterLink>
        </div>
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
        <RouterLink to="/system/user" class="quick-item">👥 成员管理</RouterLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { workbench, system, research, collab } from '../../api'
import { useSession } from '../../composables/useSession'

const router = useRouter()
const { getSessionUser } = useSession()
const user = getSessionUser()
const username = user ? (user.real_name || user.username) : ''

const loading = ref(true)
const stats = ref({ todo: 0, unread: 0, project: 0, task: 0, paper: 0, approval: 0 })
const recentTodos = ref([])
const recentMessages = ref([])

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

function fmtTime(v) {
  return v ? String(v).slice(5, 16) : ''
}

function goMessage(m) {
  router.push('/profile/message')
}

onMounted(async () => {
  try {
    const [todo, unread, project, task, paper, approval, msgs] = await Promise.allSettled([
      workbench.todo.list(),
      system.unreadCount(),
      research.project.list(),
      collab.task.list(),
      research.paper.list(),
      collab.approval.list(),
      system.myMessages()
    ])
    stats.value.todo = todo.status === 'fulfilled' && todo.value.success ? (todo.value.list || []).length : 0
    stats.value.unread = unread.status === 'fulfilled' && unread.value.success ? unread.value.count : 0
    stats.value.project = project.status === 'fulfilled' && project.value.success ? (project.value.list || []).length : 0
    stats.value.task = task.status === 'fulfilled' && task.value.success ? (task.value.list || []).length : 0
    stats.value.paper = paper.status === 'fulfilled' && paper.value.success ? (paper.value.list || []).length : 0
    stats.value.approval = approval.status === 'fulfilled' && approval.value.success
      ? (approval.value.list || []).filter((a) => a.status === 'pending').length : 0
    recentTodos.value = todo.status === 'fulfilled' && todo.value.success
      ? (todo.value.list || []).slice(0, 5) : []
    recentMessages.value = msgs.status === 'fulfilled' && msgs.value.success
      ? (msgs.value.list || []).slice(0, 5) : []
  } catch (e) {
    // 静默
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
.stat-label { margin-top: 4px; font-size: 12px; color: #8a9099; }

.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
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
.msg-title { flex: 1; color: #1f2329; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.msg-time { font-size: 12px; color: #8a9099; }

.quick-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.quick-item {
  padding: 14px; background: #f7f9fc; border-radius: 10px; text-align: center;
  font-size: 13px; color: #4e5969; text-decoration: none; transition: all 0.15s;
}
.quick-item:hover { background: #eef6ff; color: #0d80e0; }
</style>