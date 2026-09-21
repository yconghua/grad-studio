<template>
  <div class="module-overview">
    <div class="welcome card">
      <h3 class="welcome-title">{{ groupTitle }}</h3>
      <p class="welcome-sub">选择下方功能入口开始工作</p>
    </div>

    <div class="child-grid">
      <RouterLink
        v-for="child in visibleChildren"
        :key="child.key"
        :to="`/${groupKey}/${child.key}`"
        class="child-card"
      >
        <div class="child-icon">{{ iconMap[child.key] || '📄' }}</div>
        <div class="child-title">{{ child.title }}</div>
        <div class="child-desc">{{ descMap[child.key] || '' }}</div>
      </RouterLink>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { navGroups, childRoles, isRoleAllowed } from '../config/navConfig'
import { useSession } from '../composables/useSession'

const route = useRoute()
const router = useRouter()
const { getSessionUser } = useSession()

// 从路径段取 groupKey（如 /research/project → research）
const groupKey = computed(() => {
  const seg = route.path.split('/')[1]
  return seg || ''
})

const group = computed(() => navGroups.find((g) => g.key === groupKey.value))
const groupTitle = computed(() => group.value ? group.value.title : '')

const { role } = (() => {
  const u = getSessionUser()
  return { role: (u && u.role) || 'student' }
})()

const visibleChildren = computed(() => {
  if (!group.value) return []
  return group.value.children.filter((c) => isRoleAllowed(childRoles(group.value, c), role))
})

const iconMap = {
  overview: '🏠', todo: '✅', schedule: '📅', notice: '📢', shortcuts: '🔗',
  project: '📊', paper: '📄', patent: '💡', subject: '🔬', log: '📝',
  achievement: '🏆', graduation: '🎓', fund: '💰',
  member: '👥', seat: '🪑', device: '🖥', attendance: '🕐', duty: '🧹',
  regulation: '📋', 'join-leave': '🚪', borrow: '📦',
  doc: '📚', dataset: '🗃', code: '💻', tool: '🛠', template: '📑', drive: '☁', link: '🔗',
  'weekly-report': '📝', meeting: '👥', activity: '🎉', task: '📋', forum: '💬', approval: '✅',
  'achievement-stat': '📊', 'attendance-stat': '📈', 'task-stat': '📉',
  'device-stat': '🖥', 'activity-stat': '🔥', export: '📤',
  user: '👤', audit: '🔍', backup: '💾', param: '⚙', update: 'ℹ'
}

const descMap = {
  overview: '工作台总览', todo: '个人待办事项管理', schedule: '日程与会议安排', notice: '平台通知公告',
  shortcuts: '常用功能快捷入口', project: '在研科研项目', paper: '论文著作管理', patent: '专利与软件著作权',
  subject: '课题申报管理', log: '日常科研日志', achievement: '成果登记与统计', graduation: '毕业进度追踪',
  fund: '科研经费流水', member: '工作室成员管理', seat: '工位分配', device: '设备资产台账',
  attendance: '考勤记录', duty: '卫生值班排班', regulation: '工作室规章制度', 'join-leave': '入组与离组审批',
  borrow: '物品借用登记', doc: '共享文档库', dataset: '数据集资源', code: '代码仓库',
  tool: '软件工具下载', template: '常用模板', drive: '共享网盘', link: '常用网站链接',
  'weekly-report': '周报提交与批注', meeting: '组会排期与纪要', activity: '学术活动报名',
  task: '任务协作看板', forum: '学术讨论区', approval: '审批流转中心',
  user: '用户账号管理', audit: '操作日志审计', backup: '数据备份与恢复', param: '系统参数配置',
  update: '版本信息与关于'
}
</script>

<style scoped>
.module-overview { display: flex; flex-direction: column; gap: 16px; }
.card { background: #fff; border: 1px solid #eceff3; border-radius: 12px; padding: 20px 22px; }
.welcome-title { margin: 0; font-size: 20px; font-weight: 600; color: #1f2329; }
.welcome-sub { margin: 6px 0 0; font-size: 13px; color: #8a9099; }
.child-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
}
.child-card {
  background: #fff; border: 1px solid #eceff3; border-radius: 12px; padding: 22px 16px;
  text-decoration: none; text-align: center; transition: all 0.15s;
}
.child-card:hover { border-color: #0d80e0; box-shadow: 0 4px 12px rgba(13,128,224,0.1); transform: translateY(-2px); }
.child-icon { font-size: 32px; margin-bottom: 8px; }
.child-title { font-size: 14px; font-weight: 600; color: #1f2329; }
.child-desc { margin-top: 4px; font-size: 12px; color: #8a9099; }
</style>