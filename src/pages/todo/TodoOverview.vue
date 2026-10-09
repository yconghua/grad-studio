<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">待办总览</h2>
        <p class="page-sub">{{ isSuperAdmin ? '查看全平台 / 指定课题组的待办（全局只读）' : '查看本组学生的待办（只读）' }}</p>
      </div>
    </div>

    <div v-if="!summary" class="card card-loading">加载中…</div>

    <template v-else>
      <!-- 筛选区：所属范围放最前，统计数字放重置按钮后（与学业/成果页统一） -->
      <div class="toolbar">
        <span class="scope-label">所属范围</span>
        <select v-if="isSuperAdmin" v-model="filterGroupId" class="select" style="width: 150px" @change="search">
          <option :value="null">全部课题组</option>
          <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
        </select>
        <span v-else class="scope-fixed">{{ scopeLabel }}</span>
        <input v-model="keyword" class="input" style="width: 180px" placeholder="名称 / 备注 / 标签 / 姓名" @keyup.enter="search" />
        <select v-model="filterStatus" class="select" @change="search">
          <option value="">全部状态</option>
          <option value="pending">待办</option>
          <option value="done">已完成</option>
        </select>
        <select v-model="filterPriority" class="select" @change="search">
          <option value="">全部紧急程度</option>
          <option value="low">低</option>
          <option value="medium">中</option>
          <option value="high">高</option>
        </select>
        <select v-model="filterSource" class="select" @change="search">
          <option value="">全部来源</option>
          <option value="task">任务</option>
          <option value="meeting">组会</option>
          <option value="report">周报</option>
          <option value="notice">公告</option>
          <option value="manual">手动新建</option>
        </select>
        <input v-model="dueFrom" type="datetime-local" class="input" style="width: 170px" title="截止时间从" />
        <span class="range-sep">~</span>
        <input v-model="dueTo" type="datetime-local" class="input" style="width: 170px" title="截止时间至" />
        <button class="btn btn-primary" @click="search">查询</button>
        <button class="btn" @click="reset">重置</button>
        <div class="spacer"></div>
        <div class="scope-metrics">
          <span>总待办 <b>{{ summary.total }}</b></span>
          <span>未完成 <b style="color:#d97706">{{ summary.pending }}</b></span>
          <span>已完成 <b style="color:#16a34a">{{ summary.done }}</b></span>
          <span>已逾期 <b style="color:#dc2626">{{ summary.overdue }}</b></span>
        </div>
      </div>

      <div class="tbl-wrap">
        <table v-resizable-columns="{ min: 48 }" v-sortable-columns="{ field: sortField, order: sortOrder, onSort }" class="tbl">
          <thead>
            <tr>
              <th data-sort="owner">所属人</th>
              <th data-sort="title">待办名称</th>
              <th data-sort="priority">紧急程度</th>
              <th data-sort="dueTime">结束时间</th>
              <th data-sort="sourceType">来源</th>
              <th data-sort="status">状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in list" :key="row.id">
              <td>{{ row.owner.realName || row.owner.username }}</td>
              <td class="ellipsis" style="max-width: 260px">{{ row.title }}</td>
              <td><span :class="['prio-tag', row.priority]">{{ priorityLabel(row.priority) }}</span></td>
              <td :class="{ 'due-overdue': isOverdue(row) }">{{ row.dueTime || '-' }}</td>
              <td>
                <span v-if="row.sourceType" class="src-tag" :class="row.sourceType">{{ row.sourceLabel }}</span>
                <span v-else class="muted">手动</span>
              </td>
              <td><span :class="row.status === 'done' ? 'tag-ok' : 'tag-off'">{{ row.status === 'done' ? '已完成' : '待办' }}</span></td>
            </tr>
            <tr v-if="list.length === 0">
              <td colspan="6"><div class="empty">暂无待办数据</div></td>
            </tr>
          </tbody>
        </table>
        <div class="pager">
          <button class="btn btn-sm" :disabled="page <= 1" @click="page--; load()">上一页</button>
          <span>第 {{ page }} / {{ totalPages || 1 }} 页</span>
          <button class="btn btn-sm" :disabled="page >= totalPages" @click="page++; load()">下一页</button>
          <span>共 {{ total }} 条</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getTodoOverview, getTodoOverviewSummary, listGroups } from '../../api'
import { useSession } from '../../composables/useSession'
import { dialogAlert } from '../../composables/useDialog'
import { useAutoRefresh } from '../../composables/useAutoRefresh'
import { ROLE_GROUP_ADMIN, ROLE_SUPER_ADMIN } from '../../config/constants'

const { getSessionUser } = useSession()
const user = getSessionUser()
const isSuperAdmin = user.role === ROLE_SUPER_ADMIN

const PRIORITY_LABELS = { low: '低', medium: '中', high: '高' }
function priorityLabel(p) { return PRIORITY_LABELS[p] || p }

const groups = ref([])
const scopeLabel = ref('')
const keyword = ref('')
const filterGroupId = ref(null)
const filterStatus = ref('')
const filterPriority = ref('')
const filterSource = ref('')
const dueFrom = ref('')
const dueTo = ref('')
const list = ref([])
const total = ref(0)
const totalPages = ref(1)
const page = ref(1)
const sortField = ref('')
const sortOrder = ref('')
const summary = ref(null)

function isOverdue(row) {
  if (row.status === 'done' || !row.dueTime) return false
  return new Date(row.dueTime.replace(' ', 'T')) < new Date()
}
// datetime-local 'YYYY-MM-DDTHH:mm' → 服务端 'YYYY-MM-DD HH:mm:ss'
function toServer(v) {
  return v ? v.replace('T', ' ') + ':00' : ''
}

async function load() {
  try {
    const res = await getTodoOverview({
      groupId: filterGroupId.value,
      keyword: keyword.value,
      status: filterStatus.value,
      priority: filterPriority.value,
      sourceType: filterSource.value,
      dueFrom: toServer(dueFrom.value),
      dueTo: toServer(dueTo.value),
      page: page.value,
      sortField: sortField.value,
      sortOrder: sortOrder.value
    })
    if (res && res.success) {
      list.value = (res.data && res.data.list) || []
      total.value = (res.data && res.data.total) || 0
      totalPages.value = (res.data && res.data.totalPages) || 1
      scopeLabel.value = (res.data && res.data.groupName) || ''
    } else {
      dialogAlert((res && res.message) || '加载失败')
    }
  } catch (e) {
    dialogAlert('加载失败：' + (e && e.message ? e.message : '请稍后重试'))
  }
}
function onSort(field, order) {
  sortField.value = field
  sortOrder.value = order
  page.value = 1
  load()
}
async function loadSummary() {
  try {
    const res = await getTodoOverviewSummary({ groupId: filterGroupId.value })
    if (res && res.success) {
      summary.value = res.data
    } else {
      dialogAlert((res && res.message) || '加载失败')
    }
  } catch (e) {
    dialogAlert('加载失败：' + (e && e.message ? e.message : '请稍后重试'))
  }
}
function refreshAll() {
  load()
  loadSummary()
}
function search() {
  page.value = 1
  refreshAll()
}
function reset() {
  keyword.value = ''
  filterGroupId.value = null
  filterStatus.value = ''
  filterPriority.value = ''
  filterSource.value = ''
  dueFrom.value = ''
  dueTo.value = ''
  page.value = 1
  refreshAll()
}

onMounted(async () => {
  if (isSuperAdmin) {
    try {
      const res = await listGroups({ page: 1, pageSize: 500 })
      if (res && res.success) groups.value = (res.data && res.data.list) || []
    } catch (e) { /* 组列表加载失败不阻塞页面 */ }
  }
  refreshAll()
})
useAutoRefresh(refreshAll)
</script>

<style scoped>
.tbl-wrap tr { cursor: default; }
.scope-label { font-size: 13px; color: var(--text-2); white-space: nowrap; }
.scope-fixed { font-size: 13px; color: var(--text); font-weight: 600; white-space: nowrap; }
.range-sep { color: var(--text-3); }
.scope-metrics { display: flex; align-items: center; gap: 18px; font-size: 13px; color: var(--text-2, #6b7280); }
.scope-metrics span { display: flex; align-items: baseline; gap: 4px; }
.card-loading { padding: 30px; text-align: center; color: var(--text-3, #9aa0aa); }
.due-overdue { color: var(--danger); font-weight: 600; }
.prio-tag { padding: 1px 10px; border-radius: 10px; font-size: 12px; }
.prio-tag.low { background: #ecfdf5; color: #16a34a; }
.prio-tag.medium { background: #fffbeb; color: #d97706; }
.prio-tag.high { background: #fef2f2; color: #dc2626; }
.src-tag { padding: 1px 8px; border-radius: 10px; font-size: 12px; }
.src-tag.task { background: #eff6ff; color: #2563eb; }
.src-tag.meeting { background: #f5f3ff; color: #7c3aed; }
.src-tag.report { background: #f0fdf4; color: #16a34a; }
.src-tag.notice { background: #fffbeb; color: #d97706; }
.muted { color: var(--text-3, #9aa0aa); font-size: 12px; }
.tag-ok { background: #ecfdf5; color: #16a34a; font-size: 12px; padding: 1px 8px; border-radius: 10px; }
.tag-off { background: #f3f4f6; color: #6b7280; font-size: 12px; padding: 1px 8px; border-radius: 10px; }
</style>
