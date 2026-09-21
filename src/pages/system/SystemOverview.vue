<template>
  <div class="module-overview">
    <div class="welcome card">
      <h3 class="welcome-title">⚙️ 系统设置</h3>
      <p class="welcome-sub">用户、日志、备份、参数、版本管理</p>
    </div>

    <div class="stat-grid">
      <RouterLink to="/system/user" class="stat card">
        <div class="stat-num">{{ stats.user }}</div>
        <div class="stat-label">系统用户</div>
      </RouterLink>
      <RouterLink to="/system/audit" class="stat card">
        <div class="stat-num">{{ stats.log }}</div>
        <div class="stat-label">操作日志</div>
      </RouterLink>
    </div>

    <div class="child-grid">
      <RouterLink v-for="c in visibleChildren" :key="c.key" :to="`/system/${c.key}`" class="child-card">
        <div class="child-icon">{{ iconMap[c.key] || '📄' }}</div>
        <div class="child-title">{{ c.title }}</div>
      </RouterLink>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, onMounted } from 'vue'
import { navGroups, childRoles, isRoleAllowed } from '../../config/navConfig'
import { useSession } from '../../composables/useSession'
import { system, listUsers } from '../../api'

const { getSessionUser } = useSession()
const u = getSessionUser()
const role = (u && u.role) || 'student'
const group = navGroups.find((g) => g.key === 'system')
const visibleChildren = computed(() => group.children.filter((c) => isRoleAllowed(childRoles(group, c), role)))

const stats = ref({ user: 0, log: 0 })
onMounted(async () => {
  try {
    const [u, l] = await Promise.allSettled([listUsers(), system.listLogs({})])
    stats.value.user = u.status === 'fulfilled' && u.value.success ? (u.value.users || []).length : 0
    stats.value.log = l.status === 'fulfilled' && l.value.success ? (l.value.list || []).length : 0
  } catch (e) {}
})

const iconMap = {
  user: '👤', audit: '🔍', backup: '💾', param: '⚙️', update: 'ℹ️'
}
</script>
<style scoped>
.module-overview { display: flex; flex-direction: column; gap: 16px; }
.card { background: #fff; border: 1px solid #eceff3; border-radius: 12px; padding: 20px 22px; }
.welcome-title { margin: 0; font-size: 20px; font-weight: 600; color: #1f2329; }
.welcome-sub { margin: 6px 0 0; font-size: 13px; color: #8a9099; }
.stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
.stat { text-align: center; text-decoration: none; transition: transform 0.15s; }
.stat:hover { transform: translateY(-2px); }
.stat-num { font-size: 28px; font-weight: 600; color: #0d80e0; }
.stat-label { margin-top: 4px; font-size: 12px; color: #8a9099; }
.child-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 14px; }
.child-card { background: #fff; border: 1px solid #eceff3; border-radius: 12px; padding: 22px 16px; text-decoration: none; text-align: center; transition: all 0.15s; }
.child-card:hover { border-color: #0d80e0; box-shadow: 0 4px 12px rgba(13,128,224,0.1); transform: translateY(-2px); }
.child-icon { font-size: 32px; margin-bottom: 8px; }
.child-title { font-size: 14px; font-weight: 600; color: #1f2329; }
</style>
