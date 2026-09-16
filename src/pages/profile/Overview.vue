<template>
  <div class="page">
    <div class="welcome">
      <h3 class="welcome-title">{{ username }}</h3>
      <p class="welcome-sub">角色：{{ roleLabel }} · 欢迎回来</p>
    </div>

    <div class="grid">
      <div class="card">
        <div class="num">{{ stats.todo }}</div>
        <div class="label">我的待办</div>
      </div>
      <div class="card">
        <div class="num">{{ stats.unread }}</div>
        <div class="label">未读消息</div>
      </div>
      <div class="card">
        <div class="num">{{ stats.project }}</div>
        <div class="label">我负责的项目</div>
      </div>
      <div class="card">
        <div class="num">{{ stats.task }}</div>
        <div class="label">我的任务</div>
      </div>
      <div class="card">
        <div class="num">{{ stats.achievement }}</div>
        <div class="label">我的成果</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { workbench, system, research, collab } from '../../api'
import { useSession } from '../../composables/useSession'
import { ROLE_OPTIONS } from '../../config/fieldOptions'

const { getSessionUser } = useSession()
const user = getSessionUser()
const username = user ? (user.real_name || user.username) : ''
const roleLabel = user ? (ROLE_OPTIONS.find((o) => o.value === user.role)?.label || user.role) : ''

const stats = ref({ todo: 0, unread: 0, project: 0, task: 0, achievement: 0 })
const me = user ? user.id : null

onMounted(async () => {
  const r = await Promise.allSettled([
    workbench.todo.list(),
    system.unreadCount(),
    research.project.list({ leader_id: me }),
    collab.task.list({ assignee_id: me }),
    research.achievement.list({ owner_id: me })
  ])
  const len = (p) => (p.status === 'fulfilled' && p.value.success ? (p.value.list || []).length : 0)
  stats.value.todo = len(r[0])
  stats.value.unread = r[1].status === 'fulfilled' && r[1].value.success ? r[1].value.count : 0
  stats.value.project = len(r[2])
  stats.value.task = len(r[3])
  stats.value.achievement = len(r[4])
})
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.welcome {
  background: #fff;
  border: 1px solid #eceff3;
  border-radius: 12px;
  padding: 20px 22px;
}
.welcome-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}
.welcome-sub {
  margin: 8px 0 0;
  font-size: 13px;
  color: #8a9099;
}
.grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14px;
}
.card {
  background: #fff;
  border: 1px solid #eceff3;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
}
.num {
  font-size: 28px;
  font-weight: 600;
  color: #0d80e0;
}
.label {
  margin-top: 6px;
  font-size: 13px;
  color: #8a9099;
}
</style>
