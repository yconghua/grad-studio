<template>
  <div class="module-overview">
    <div class="welcome card">
      <h3 class="welcome-title">📊 统计报表</h3>
      <p class="welcome-sub">成果、考勤、任务、活跃度数据统计与导出</p>
    </div>
    <div class="child-grid">
      <RouterLink v-for="c in visibleChildren" :key="c.key" :to="`/report/${c.key}`" class="child-card">
        <div class="child-icon">{{ iconMap[c.key] || '📄' }}</div>
        <div class="child-title">{{ c.title }}</div>
      </RouterLink>
    </div>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { navGroups, childRoles, isRoleAllowed } from '../../config/navConfig'
import { useSession } from '../../composables/useSession'
const { getSessionUser } = useSession()
const u = getSessionUser()
const role = (u && u.role) || 'student'
const group = navGroups.find((g) => g.key === 'report')
const visibleChildren = computed(() => group.children.filter((c) => isRoleAllowed(childRoles(group, c), role)))
const iconMap = {
  'achievement-stat': '📊', 'attendance-stat': '📈', 'task-stat': '📉',
  'device-stat': '🖥️', 'activity-stat': '🔥', export: '📤'
}
</script>
<style scoped>
.module-overview { display: flex; flex-direction: column; gap: 16px; }
.card { background: #fff; border: 1px solid #eceff3; border-radius: 12px; padding: 20px 22px; }
.welcome-title { margin: 0; font-size: 20px; font-weight: 600; color: #1f2329; }
.welcome-sub { margin: 6px 0 0; font-size: 13px; color: #8a9099; }
.child-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 14px; }
.child-card { background: #fff; border: 1px solid #eceff3; border-radius: 12px; padding: 22px 16px; text-decoration: none; text-align: center; transition: all 0.15s; }
.child-card:hover { border-color: #0d80e0; box-shadow: 0 4px 12px rgba(13,128,224,0.1); transform: translateY(-2px); }
.child-icon { font-size: 32px; margin-bottom: 8px; }
.child-title { font-size: 14px; font-weight: 600; color: #1f2329; }
</style>
