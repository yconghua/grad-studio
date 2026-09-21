<template>
  <div class="module-overview">
    <div class="welcome card">
      <h3 class="welcome-title">🏢 工作室事务</h3>
      <p class="welcome-sub">成员、工位、设备、考勤、物品借用管理</p>
    </div>

    <div class="stat-grid">
      <div class="stat card"><div class="stat-num">{{ stats.member }}</div><div class="stat-label">工作室成员</div></div>
      <div class="stat card"><div class="stat-num">{{ stats.device }}</div><div class="stat-label">设备资产</div></div>
      <div class="stat card"><div class="stat-num">{{ stats.borrow }}</div><div class="stat-label">借出物品</div></div>
      <div class="stat card"><div class="stat-num">{{ stats.joinLeave }}</div><div class="stat-label">入组/离组</div></div>
    </div>

    <div class="two-col">
      <!-- 最近借用 -->
      <div class="card section">
        <div class="section-head">
          <h4>📦 最近借用</h4>
          <RouterLink to="/studio/borrow" class="more">查看全部 →</RouterLink>
        </div>
        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="!recentBorrows.length" class="empty">暂无借用记录</div>
        <div v-else class="list">
          <div v-for="b in recentBorrows" :key="b.id" class="list-item">
            <span class="item-title">{{ b.item_name || b.name }}</span>
            <span class="badge" :class="b.status">{{ b.status || '借出中' }}</span>
          </div>
        </div>
      </div>

      <!-- 成员列表 -->
      <div class="card section">
        <div class="section-head">
          <h4>👥 工作室成员</h4>
          <RouterLink to="/studio/member" class="more">查看全部 →</RouterLink>
        </div>
        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="!recentMembers.length" class="empty">暂无成员</div>
        <div v-else class="list">
          <div v-for="m in recentMembers" :key="m.id" class="list-item">
            <span class="item-title">{{ m.real_name || m.username }}</span>
            <span class="badge" :class="m.role">{{ roleText(m.role) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="child-grid">
        <RouterLink v-for="c in visibleChildren" :key="c.key" :to="`/studio/${c.key}`" class="child-card">
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
import { studio } from '../../api'

const { getSessionUser } = useSession()
const u = getSessionUser()
const role = (u && u.role) || 'student'
const group = navGroups.find((g) => g.key === 'studio')
const visibleChildren = computed(() => group.children.filter((c) => isRoleAllowed(childRoles(group, c), role)))

const loading = ref(true)
const stats = ref({ member: 0, device: 0, borrow: 0, joinLeave: 0 })
const recentBorrows = ref([])
const recentMembers = ref([])

function roleText(r) {
  return { admin: '管理员', mentor: '导师', student: '学生' }[r] || r
}

onMounted(async () => {
  try {
    const [m, d, b, j] = await Promise.allSettled([
      studio.member.list(), studio.device.list(),
      studio.borrow.list(), studio.joinLeave.list()
    ])
    stats.value.member = m.status === 'fulfilled' && m.value.success ? (m.value.list || []).length : 0
    stats.value.device = d.status === 'fulfilled' && d.value.success ? (d.value.list || []).length : 0
    stats.value.borrow = b.status === 'fulfilled' && b.value.success ? (b.value.list || []).length : 0
    stats.value.joinLeave = j.status === 'fulfilled' && j.value.success ? (j.value.list || []).length : 0
    recentBorrows.value = b.status === 'fulfilled' && b.value.success ? (b.value.list || []).slice(0, 5) : []
    recentMembers.value = m.status === 'fulfilled' && m.value.success ? (m.value.list || []).slice(0, 6) : []
  } catch (e) {} finally { loading.value = false }
})

const iconMap = {
  member: '👥', seat: '🪑', device: '🖥️', attendance: '🕐', duty: '🧹',
  regulation: '📋', 'join-leave': '🚪', borrow: '📦'
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
.badge.admin { background: #fff1f0; color: #f5222d; }
.badge.mentor { background: #e6f7ff; color: #1890ff; }
.badge.student { background: #f6ffed; color: #52c41a; }
.badge.pending { background: #fff7e6; color: #fa8c16; }
.child-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.child-card { background: #fff; border: 1px solid #eceff3; border-radius: 12px; padding: 18px 14px; text-decoration: none; text-align: center; transition: all 0.15s; }
.child-card:hover { border-color: #0d80e0; box-shadow: 0 4px 12px rgba(13,128,224,0.1); transform: translateY(-2px); }
.child-icon { font-size: 28px; margin-bottom: 6px; }
.child-title { font-size: 13px; font-weight: 600; color: #1f2329; }
</style>
