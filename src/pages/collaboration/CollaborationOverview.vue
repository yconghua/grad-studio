<template>
  <div class="module-overview">
    <div class="welcome card">
      <h3 class="welcome-title">👥 协同办公</h3>
      <p class="welcome-sub">周报、组会、任务、讨论、审批一站式协作</p>
    </div>

    <div class="stat-grid">
      <div class="stat card"><div class="stat-num">{{ stats.task }}</div><div class="stat-label">协作任务</div></div>
      <div class="stat card"><div class="stat-num">{{ stats.report }}</div><div class="stat-label">周报</div></div>
      <div class="stat card"><div class="stat-num">{{ stats.meeting }}</div><div class="stat-label">组会</div></div>
      <div class="stat card"><div class="stat-num">{{ stats.approval }}</div><div class="stat-label">待审批</div></div>
    </div>

    <div class="two-col">
      <!-- 最新任务 -->
      <div class="card section">
        <div class="section-head">
          <h4>📋 最新任务</h4>
          <RouterLink to="/collaboration/task" class="more">查看全部 →</RouterLink>
        </div>
        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="!recentTasks.length" class="empty">暂无任务</div>
        <div v-else class="list">
          <div v-for="t in recentTasks" :key="t.id" class="list-item">
            <span class="badge" :class="t.status">{{ taskStatusText(t.status) }}</span>
            <span class="item-title">{{ t.title }}</span>
          </div>
        </div>
      </div>

      <!-- 待审批 -->
      <div class="card section">
        <div class="section-head">
          <h4>✅ 待审批事项</h4>
          <RouterLink to="/collaboration/approval" class="more">查看全部 →</RouterLink>
        </div>
        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="!recentApprovals.length" class="empty">暂无待审批</div>
        <div v-else class="list">
          <div v-for="a in recentApprovals" :key="a.id" class="list-item">
            <span class="badge pending">待审批</span>
            <span class="item-title">{{ a.title || a.type }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="child-grid">
        <RouterLink v-for="c in visibleChildren" :key="c.key" :to="`/collaboration/${c.key}`" class="child-card">
          <div class="child-icon">{{ iconMap[c.key] || '📄' }}</div>
          <div class="child-title">{{ c.title }}</div>
        </RouterLink>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, onMounted } from 'vue'
import { navGroups, childRoles, isRoleAllowed } from '../../config/navConfig'
import { useSession } from '../../composables/useSession'
import { collab } from '../../api'

const { getSessionUser } = useSession()
const u = getSessionUser()
const role = (u && u.role) || 'student'
const group = navGroups.find((g) => g.key === 'collaboration')
const visibleChildren = computed(() => group.children.filter((c) => isRoleAllowed(childRoles(group, c), role)))

const loading = ref(true)
const stats = ref({ task: 0, report: 0, meeting: 0, approval: 0 })
const recentTasks = ref([])
const recentApprovals = ref([])

function taskStatusText(s) {
  return { todo: '待办', doing: '进行中', done: '已完成', delayed: '延期' }[s] || s
}

onMounted(async () => {
  try {
    const [t, r, m, a] = await Promise.allSettled([
      collab.task.list(), collab.weeklyReport.list(),
      collab.meeting.list(), collab.approval.list()
    ])
    stats.value.task = t.status === 'fulfilled' && t.value.success ? (t.value.list || []).length : 0
    stats.value.report = r.status === 'fulfilled' && r.value.success ? (r.value.list || []).length : 0
    stats.value.meeting = m.status === 'fulfilled' && m.value.success ? (m.value.list || []).length : 0
    const allApprovals = a.status === 'fulfilled' && a.value.success ? (a.value.list || []) : []
    stats.value.approval = allApprovals.filter((x) => x.status === 'pending').length
    recentTasks.value = t.status === 'fulfilled' && t.value.success ? (t.value.list || []).slice(0, 5) : []
    recentApprovals.value = allApprovals.filter((x) => x.status === 'pending').slice(0, 5)
  } catch (e) {} finally { loading.value = false }
})

const iconMap = {
  'weekly-report': '📝', meeting: '👥', activity: '🎉', task: '📋', forum: '💬', approval: '✅'
}
</script>
<style scoped>
.module-overview { display: flex; flex-direction: column; gap: 16px; }
.card { background: #fff; border: 1px solid #eceff3; border-radius: 12px; padding: 20px 22px; }
.welcome-title { margin: 0; font-size: 20px; font-weight: 600; color: #1f2329; }
.welcome-sub { margin: 6px 0 0; font-size: 13px; color: #8a9099; }
.stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.stat { text-align: center; }
.stat-num { font-size: 28px; font-weight: 600; color: #0d80e0; }
.stat-label { margin-top: 4px; font-size: 12px; color: #8a9099; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.section { display: flex; flex-direction: column; }
.section-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.section-head h4 { margin: 0; font-size: 15px; font-weight: 600; }
.more { font-size: 12px; color: #0d80e0; text-decoration: none; }
.empty { color: #8a9099; font-size: 13px; text-align: center; padding: 20px 0; }
.list { display: flex; flex-direction: column; gap: 8px; }
.list-item { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 6px 0; border-bottom: 1px solid #f5f7fa; }
.item-title { flex: 1; color: #1f2329; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; flex-shrink: 0; }
.badge.todo { background: #fff7e6; color: #fa8c16; }
.badge.doing { background: #e6f7ff; color: #1890ff; }
.badge.done { background: #f6ffed; color: #52c41a; }
.badge.delayed { background: #fff1f0; color: #f5222d; }
.badge.pending { background: #fff7e6; color: #fa8c16; }
.child-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.child-card { background: #fff; border: 1px solid #eceff3; border-radius: 12px; padding: 18px 14px; text-decoration: none; text-align: center; transition: all 0.15s; }
.child-card:hover { border-color: #0d80e0; box-shadow: 0 4px 12px rgba(13,128,224,0.1); transform: translateY(-2px); }
.child-icon { font-size: 28px; margin-bottom: 6px; }
.child-title { font-size: 13px; font-weight: 600; color: #1f2329; }
</style>
