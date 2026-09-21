<template>
  <div class="module-overview">
    <div class="welcome card">
      <div>
        <h3 class="welcome-title">🔬 科研管理</h3>
        <p class="welcome-sub">项目、论文、专利、成果、毕业进度一站式管理</p>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat card"><div class="stat-num">{{ stats.project }}</div><div class="stat-label">在研项目</div></div>
      <div class="stat card"><div class="stat-num">{{ stats.paper }}</div><div class="stat-label">论文著作</div></div>
      <div class="stat card"><div class="stat-num">{{ stats.patent }}</div><div class="stat-label">专利软著</div></div>
      <div class="stat card"><div class="stat-num">{{ stats.achievement }}</div><div class="stat-label">成果登记</div></div>
    </div>

    <div class="two-col">
      <!-- 最近论文 -->
      <div class="card section">
        <div class="section-head">
          <h4>📄 最新论文</h4>
          <RouterLink to="/research/paper" class="more">查看全部 →</RouterLink>
        </div>
        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="!recentPapers.length" class="empty">暂无论文</div>
        <div v-else class="list">
          <div v-for="p in recentPapers" :key="p.id" class="list-item">
            <span class="badge" :class="p.status">{{ paperStatusText(p.status) }}</span>
            <span class="item-title">{{ p.title }}</span>
          </div>
        </div>
      </div>

      <!-- 最新项目 -->
      <div class="card section">
        <div class="section-head">
          <h4>📊 在研项目</h4>
          <RouterLink to="/research/project" class="more">查看全部 →</RouterLink>
        </div>
        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="!recentProjects.length" class="empty">暂无项目</div>
        <div v-else class="list">
          <div v-for="p in recentProjects" :key="p.id" class="list-item">
            <span class="item-title">{{ p.name || p.title }}</span>
            <span v-if="p.status" class="badge" :class="p.status">{{ p.status }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 子页面入口 -->
    <div class="section">
      <div class="child-grid">
        <RouterLink v-for="c in visibleChildren" :key="c.key" :to="`/research/${c.key}`" class="child-card">
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
import { research } from '../../api'

const { getSessionUser } = useSession()
const u = getSessionUser()
const role = (u && u.role) || 'student'
const group = navGroups.find((g) => g.key === 'research')
const visibleChildren = computed(() => group.children.filter((c) => isRoleAllowed(childRoles(group, c), role)))

const loading = ref(true)
const stats = ref({ project: 0, paper: 0, patent: 0, achievement: 0 })
const recentPapers = ref([])
const recentProjects = ref([])

function paperStatusText(s) {
  return { writing: '撰写中', submitted: '已投稿', revision: '返修', accepted: '已录用', published: '已见刊' }[s] || s
}

onMounted(async () => {
  try {
    const [p, pa, pat, ac] = await Promise.allSettled([
      research.project.list(), research.paper.list(),
      research.patent.list(), research.achievement.list()
    ])
    stats.value.project = p.status === 'fulfilled' && p.value.success ? (p.value.list || []).length : 0
    stats.value.paper = pa.status === 'fulfilled' && pa.value.success ? (pa.value.list || []).length : 0
    stats.value.patent = pat.status === 'fulfilled' && pat.value.success ? (pat.value.list || []).length : 0
    stats.value.achievement = ac.status === 'fulfilled' && ac.value.success ? (ac.value.list || []).length : 0
    recentPapers.value = pa.status === 'fulfilled' && pa.value.success ? (pa.value.list || []).slice(0, 5) : []
    recentProjects.value = p.status === 'fulfilled' && p.value.success ? (p.value.list || []).slice(0, 5) : []
  } catch (e) {} finally { loading.value = false }
})

const iconMap = {
  project: '📊', paper: '📄', patent: '💡', subject: '🔬', log: '📝',
  achievement: '🏆', graduation: '🎓', fund: '💰'
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
.badge.writing { background: #fff7e6; color: #fa8c16; }
.badge.submitted { background: #e6f7ff; color: #1890ff; }
.badge.revision { background: #fff1f0; color: #f5222d; }
.badge.accepted { background: #f6ffed; color: #52c41a; }
.badge.published { background: #f6ffed; color: #389e0d; }
.child-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.child-card { background: #fff; border: 1px solid #eceff3; border-radius: 12px; padding: 18px 14px; text-decoration: none; text-align: center; transition: all 0.15s; }
.child-card:hover { border-color: #0d80e0; box-shadow: 0 4px 12px rgba(13,128,224,0.1); transform: translateY(-2px); }
.child-icon { font-size: 28px; margin-bottom: 6px; }
.child-title { font-size: 13px; font-weight: 600; color: #1f2329; }
</style>
