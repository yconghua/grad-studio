<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">任务总览</h2>
        <p class="page-sub">按课题组分类查看成员参与的任务（全局只读，无操作权限）</p>
      </div>
      <button class="btn" type="button" :disabled="!exportRows.length" @click="doExport">导出 CSV</button>
    </div>

    <!-- 统计卡片 -->
    <div class="stat-cards">
      <div class="stat-card">
        <div class="stat-num">{{ stats.total }}</div>
        <div class="stat-label">任务总数</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{ stats.completionRate }}%</div>
        <div class="stat-label">完成率</div>
      </div>
      <div class="stat-card">
        <div class="stat-num stat-red">{{ stats.overdue }}</div>
        <div class="stat-label">逾期任务</div>
      </div>
      <div class="stat-card">
        <div class="stat-num stat-orange">{{ stats.pendingReview }}</div>
        <div class="stat-label">待验收</div>
      </div>
    </div>

    <!-- 筛选 -->
    <div class="toolbar">
      <select v-model="filterGroupId" class="select" @change="search">
        <option :value="''">全部课题组</option>
        <option v-for="g in groupOptions" :key="g.groupId" :value="g.groupId">{{ g.groupName }}</option>
      </select>
      <select v-model="filterStatus" class="select" @change="search">
        <option :value="''">全部状态</option>
        <option v-for="(txt, val) in TASK_STATUS_TEXT" :key="val" :value="Number(val)">{{ txt }}</option>
      </select>
      <button class="btn btn-primary" type="button" @click="search">查询</button>
      <button class="btn" type="button" @click="reset">重置</button>
    </div>

    <!-- 按课题组分类 -->
    <div v-if="loading" class="panel"><div class="empty">加载中…</div></div>
    <div v-else-if="groups.length === 0" class="panel"><div class="empty">暂无任务数据</div></div>

    <div v-for="g in groups" :key="g.groupId" class="panel group-panel">
      <h3 class="group-title">{{ g.groupName }} <span class="group-count">{{ g.members.length }} 名成员</span></h3>

      <table class="tbl">
        <thead>
          <tr>
            <th>成员</th>
            <th>角色</th>
            <th>任务标题</th>
            <th>状态</th>
            <th>优先级</th>
            <th>截止时间</th>
            <th>进度</th>
            <th>创建人</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="m in g.members" :key="m.userId">
            <tr v-if="m.tasks.length === 0">
              <td>{{ m.realName || m.username }}</td>
              <td>{{ m.role === 'mentor' ? '导师' : '学生' }}</td>
              <td colspan="6"><span class="no-task">无参与任务</span></td>
            </tr>
            <tr v-for="t in m.tasks" :key="m.userId + '-' + t.id">
              <td class="ellipsis" style="max-width: 90px">{{ m.realName || m.username }}</td>
              <td>{{ m.role === 'mentor' ? '导师' : '学生' }}</td>
              <td class="ellipsis" style="max-width: 260px">{{ t.title }}</td>
              <td><span :class="taskStatusTagClass(t.status)">{{ taskStatusText(t.status) }}</span></td>
              <td><span :class="taskPriorityTagClass(t.priority)">{{ taskPriorityText(t.priority) }}</span></td>
              <td>{{ t.dueTime || '-' }}</td>
              <td>{{ t.progress }}%</td>
              <td class="ellipsis" style="max-width: 90px">{{ t.creatorName }}</td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getTaskOverviewList, getTaskOverviewStats } from '../../api/task'
import { dialogAlert } from '../../composables/useDialog'
import { exportCsv } from '../../utils/csvExport'
import {
  taskStatusText,
  taskStatusTagClass,
  taskPriorityText,
  taskPriorityTagClass,
  TASK_STATUS_TEXT
} from '../../utils/labels'

const groups = ref([])
const stats = ref({ total: 0, completionRate: 0, overdue: 0, pendingReview: 0 })
const loading = ref(false)
const filterGroupId = ref('')
const filterStatus = ref('')

const groupOptions = computed(() => groups.value.map((g) => ({ groupId: g.groupId, groupName: g.groupName })))

// 展平用于导出 CSV 的行
const exportRows = computed(() => {
  const rows = []
  for (const g of groups.value) {
    for (const m of g.members) {
      for (const t of m.tasks) {
        rows.push({
          group: g.groupName,
          member: m.realName || m.username,
          memberRole: m.role === 'mentor' ? '导师' : '学生',
          taskId: t.id,
          title: t.title,
          status: taskStatusText(t.status),
          priority: taskPriorityText(t.priority),
          dueTime: t.dueTime || '',
          progress: `${t.progress}%`,
          creator: t.creatorName,
          createdAt: t.createdAt
        })
      }
    }
  }
  return rows
})

async function loadStats() {
  const res = await getTaskOverviewStats()
  if (res && res.success) stats.value = res.data || {}
}

async function load() {
  loading.value = true
  const res = await getTaskOverviewList({
    groupId: filterGroupId.value === '' ? undefined : filterGroupId.value,
    status: filterStatus.value === '' ? undefined : filterStatus.value
  })
  loading.value = false
  if (res && res.success) {
    groups.value = (res.data && res.data.groups) || []
  } else {
    dialogAlert((res && res.message) || '加载失败')
  }
}

function search() {
  load()
}
function reset() {
  filterGroupId.value = ''
  filterStatus.value = ''
  load()
}

function doExport() {
  exportCsv(
    '任务总览.csv',
    exportRows.value,
    [
      { key: 'group', label: '课题组' },
      { key: 'member', label: '成员' },
      { key: 'memberRole', label: '角色' },
      { key: 'taskId', label: '任务ID' },
      { key: 'title', label: '任务标题' },
      { key: 'status', label: '状态' },
      { key: 'priority', label: '优先级' },
      { key: 'dueTime', label: '截止时间' },
      { key: 'progress', label: '进度' },
      { key: 'creator', label: '创建人' },
      { key: 'createdAt', label: '创建时间' }
    ]
  )
}

onMounted(() => {
  loadStats()
  load()
})
</script>

<style scoped>
.stat-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 14px;
}
.stat-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 14px 16px;
  text-align: center;
}
.stat-num {
  font-size: 24px;
  font-weight: 700;
  color: #1f2329;
}
.stat-red {
  color: #ef4444;
}
.stat-orange {
  color: #f59e0b;
}
.stat-label {
  margin-top: 4px;
  font-size: 13px;
  color: #9ca3af;
}
.group-panel {
  margin-bottom: 14px;
}
.group-title {
  font-size: 15px;
  font-weight: 700;
  color: #1f2329;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.group-count {
  font-size: 12px;
  font-weight: 400;
  color: #9ca3af;
}
.no-task {
  color: #9ca3af;
  font-size: 13px;
}
</style>
