<template>
  <div class="overview">
    <div class="welcome card">
      <h3 class="welcome-title">你好，{{ username }} 👋</h3>
      <p class="welcome-sub">欢迎回到研究生工作室管理平台，今天也要加油。</p>
    </div>

    <div class="stat-grid">
      <div class="stat card">
        <div class="stat-num">{{ stats.todo }}</div>
        <div class="stat-label">我的待办</div>
      </div>
      <div class="stat card">
        <div class="stat-num">{{ stats.unread }}</div>
        <div class="stat-label">未读消息</div>
      </div>
      <div class="stat card">
        <div class="stat-num">{{ stats.project }}</div>
        <div class="stat-label">在研项目</div>
      </div>
      <div class="stat card">
        <div class="stat-num">{{ stats.task }}</div>
        <div class="stat-label">协作任务</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { workbench, system, research, collab } from '../../api'
import { useSession } from '../../composables/useSession'

const { getSessionUser } = useSession()
const user = getSessionUser()
const username = user ? (user.real_name || user.username) : ''

const stats = ref({ todo: 0, unread: 0, project: 0, task: 0 })

onMounted(async () => {
  try {
    const [t, u, p, k] = await Promise.allSettled([
      workbench.todo.list(),
      system.unreadCount(),
      research.project.list(),
      collab.task.list()
    ])
    stats.value.todo = t.status === 'fulfilled' && t.value.success ? (t.value.list || []).length : 0
    stats.value.unread = u.status === 'fulfilled' && u.value.success ? u.value.count : 0
    stats.value.project = p.status === 'fulfilled' && p.value.success ? (p.value.list || []).length : 0
    stats.value.task = k.status === 'fulfilled' && k.value.success ? (k.value.list || []).length : 0
  } catch (e) {
    // 统计失败静默，保持 0
  }
})
</script>

<style scoped>
.overview {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.card {
  background: #fff;
  border: 1px solid #eceff3;
  border-radius: 12px;
  padding: 22px 24px;
}
.welcome-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1f2329;
}
.welcome-sub {
  margin: 8px 0 0;
  font-size: 14px;
  color: #8a9099;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.stat {
  text-align: center;
}
.stat-num {
  font-size: 30px;
  font-weight: 600;
  color: #0d80e0;
}
.stat-label {
  margin-top: 6px;
  font-size: 13px;
  color: #8a9099;
}
</style>
