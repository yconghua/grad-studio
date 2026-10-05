<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">任务总览</h2>
        <p class="page-sub">按课题组展示组管 / 导师创建的任务（全局只读，点击行查看详情）</p>
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

    <!-- 按课题组分类展示任务 -->
    <div v-if="loading" class="panel"><div class="empty">加载中…</div></div>
    <div v-else-if="groups.length === 0" class="panel"><div class="empty">暂无任务数据</div></div>

    <div v-for="g in groups" :key="g.groupId" class="panel group-panel">
      <h3 class="group-title">{{ g.groupName }} <span class="group-count">{{ g.tasks.length }} 个任务</span></h3>

      <table v-resizable-columns v-sortable-columns="{ field: sortField, order: sortOrder, onSort }" class="tbl">
        <thead>
          <tr>
            <th data-sort="id">ID</th>
            <th data-sort="title">任务标题</th>
            <th data-sort="creatorName">创建人</th>
            <th data-sort="creatorRole">创建人角色</th>
            <th data-sort="status">状态</th>
            <th data-sort="priority">优先级</th>
            <th data-sort="dueTime">截止时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in g.tasks" :key="t.id" @click="openDetail(t)">
            <td>{{ t.id }}</td>
            <td class="ellipsis" style="max-width: 100px">{{ t.title }}</td>
            <td class="ellipsis" style="max-width: 90px">{{ t.creatorName }}</td>
            <td><span :class="creatorTagClass(t.creatorRole)">{{ creatorRoleText(t.creatorRole) }}</span></td>
            <td><span :class="taskStatusTagClass(t.status)">{{ taskStatusText(t.status) }}</span></td>
            <td><span :class="taskPriorityTagClass(t.priority)">{{ taskPriorityText(t.priority) }}</span></td>
            <td>{{ t.dueTime || '-' }}</td>
          </tr>
          <tr v-if="g.tasks.length === 0">
            <td colspan="7"><span class="no-task">暂无任务</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- 任务详情弹窗（超管只读） -->
  <TaskOverviewDialog v-if="detailVisible" :task-id="detailId" @close="detailVisible = false" />
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import TaskOverviewDialog from '../../components/task/TaskOverviewDialog.vue'
import { getTaskOverviewList, getTaskOverviewStats } from '../../api/task'
import { dialogAlert } from '../../composables/useDialog'
import { useAutoRefresh } from '../../composables/useAutoRefresh'
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
const sortField = ref('')
const sortOrder = ref('')

const groupOptions = computed(() => groups.value.map((g) => ({ groupId: g.groupId, groupName: g.groupName })))

// 创建人角色文案与标签（组管 / 导师）
function creatorRoleText(role) {
  if (role === 'group_admin') return '组管'
  if (role === 'mentor') return '导师'
  return role || '-'
}
function creatorTagClass(role) {
  if (role === 'group_admin') return 'tag tag-role-group'
  if (role === 'mentor') return 'tag tag-role-mentor'
  return 'tag'
}

// 展平用于导出 CSV 的行（按任务，每任务一行）
const exportRows = computed(() => {
  const rows = []
  for (const g of groups.value) {
    for (const t of g.tasks) {
      rows.push({
        group: g.groupName,
        taskId: t.id,
        title: t.title,
        creator: t.creatorName,
        creatorRole: creatorRoleText(t.creatorRole),
        status: taskStatusText(t.status),
        priority: taskPriorityText(t.priority),
        dueTime: t.dueTime || '',
        createdAt: t.createdAt
      })
    }
  }
  return rows
})

// ===== 详情弹窗 =====
const detailVisible = ref(false)
const detailId = ref(null)

function openDetail(t) {
  detailId.value = t.id
  detailVisible.value = true
}

async function loadStats() {
  const res = await getTaskOverviewStats()
  if (res && res.success) stats.value = res.data || {}
}

async function load() {
  loading.value = true
  const res = await getTaskOverviewList({
    groupId: filterGroupId.value === '' ? undefined : filterGroupId.value,
    status: filterStatus.value === '' ? undefined : filterStatus.value,
    sortField: sortField.value,
    sortOrder: sortOrder.value
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
function onSort(field, order) {
  sortField.value = field
  sortOrder.value = order
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
      { key: 'taskId', label: '任务ID' },
      { key: 'title', label: '任务标题' },
      { key: 'creator', label: '创建人' },
      { key: 'creatorRole', label: '创建人角色' },
      { key: 'status', label: '状态' },
      { key: 'priority', label: '优先级' },
      { key: 'dueTime', label: '截止时间' },
      { key: 'createdAt', label: '创建时间' }
    ]
  )
}

onMounted(() => {
  loadStats()
  load()
})
// 数据变动（本页写操作或外部改动）后后台静默重拉统计与列表
useAutoRefresh(() => {
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
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 14px 16px;
  text-align: center;
}
.stat-num {
  font-size: 24px;
  font-weight: 700;
  color: var(--text);
}
.stat-red {
  color: var(--unread);
}
.stat-orange {
  color: var(--warning);
}
.stat-label {
  margin-top: 4px;
  font-size: 13px;
  color: var(--text-disabled);
}
.group-panel {
  margin-bottom: 14px;
}
.group-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.group-count {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-disabled);
}
.no-task {
  color: var(--text-disabled);
  font-size: 13px;
}
.tbl tbody tr {
  cursor: pointer;
}
.tbl tbody tr:hover {
  background: var(--bg-hover);
}
</style>
