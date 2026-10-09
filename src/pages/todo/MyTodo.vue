<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">我的待办</h2>
        <p class="page-sub">个人轻量待办：手动新建，或把任务 / 组会 / 周报 / 公告一键转为待办</p>
      </div>
      <div class="page-actions">
        <div class="view-tabs">
          <button type="button" :class="view === 'table' ? 'on' : ''" @click="switchView('table')">表格</button>
          <button type="button" :class="view === 'calendar' ? 'on' : ''" @click="switchView('calendar')">日历</button>
        </div>
        <button class="btn btn-primary" @click="openCreate">新建待办</button>
      </div>
    </div>

    <div v-if="!summary" class="card card-loading">加载中…</div>

    <template v-else>
      <!-- 表格视图 -->
      <template v-if="view === 'table'">
        <!-- 筛选区：查询 / 重置（与用户管理等页面统一） -->
        <div class="toolbar">
          <input v-model="keyword" class="input" style="width: 200px" placeholder="名称 / 备注 / 标签" @keyup.enter="search" />
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
                <th data-sort="title">待办名称</th>
                <th data-sort="priority">紧急程度</th>
                <th data-sort="dueTime">结束时间</th>
                <th data-sort="sourceType">来源</th>
                <th data-sort="status">状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in list" :key="row.id" @click="openDetail(row)">
                <td class="ellipsis" style="max-width: 280px">
                  <span :class="{ 'todo-title-done': row.status === 'done' }">{{ row.title }}</span>
                </td>
                <td><span :class="['prio-tag', row.priority]">{{ priorityLabel(row.priority) }}</span></td>
                <td :class="{ 'due-overdue': isOverdue(row) }">{{ row.dueTime || '-' }}</td>
                <td>
                  <span v-if="row.sourceType" class="src-tag" :class="row.sourceType" @click.stop="sourceJump(row)">{{ row.sourceLabel }}</span>
                  <span v-else class="muted">手动</span>
                </td>
                <td><span :class="row.status === 'done' ? 'tag-ok' : 'tag-off'">{{ row.status === 'done' ? '已完成' : '待办' }}</span></td>
                <td class="op-col">
                  <div class="ops">
                    <button v-if="row.status === 'pending'" type="button" class="btn btn-sm" @click.stop="openEdit(row)">编辑</button>
                    <button type="button" class="btn btn-sm" @click.stop="toggleDone(row)">
                      {{ row.status === 'done' ? '取消完成' : '完成' }}
                    </button>
                    <button type="button" class="btn btn-sm btn-danger" @click.stop="removeRow(row)">删除</button>
                  </div>
                </td>
              </tr>
              <tr v-if="list.length === 0">
                <td colspan="6"><div class="empty">暂无待办，点击右上角「新建待办」或从任务 / 组会 / 周报 / 公告一键转换</div></td>
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

      <!-- 日历视图 -->
      <template v-else>
        <TodoCalendar />
      </template>
    </template>

    <TodoEditDialog v-model:open="editVisible" :row="editRow" :source="editSource" @saved="refreshAll" @goto="gotoTodo" />
    <RowDetailDialog v-model:visible="detailVisible" title="待办详情" :row="detailRow" :fields="detailFields" size="lg" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TodoEditDialog from '../../components/todo/TodoEditDialog.vue'
import TodoCalendar from '../../components/todo/TodoCalendar.vue'
import RowDetailDialog from '../../components/common/RowDetailDialog.vue'
import { getMyTodos, getMyTodoSummary, toggleTodoDone, removeTodo } from '../../api'
import { useSession } from '../../composables/useSession'
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'
import { refreshAfterWrite } from '../../composables/useGlobalRefresh'
import { useAutoRefresh } from '../../composables/useAutoRefresh'

const route = useRoute()
const router = useRouter()
const { getSessionUser } = useSession()
const user = getSessionUser()
const role = user && user.role
const basePath = role === 'mentor' ? '/mentor' : '/student'

const PRIORITY_LABELS = { low: '低', medium: '中', high: '高' }
function priorityLabel(p) { return PRIORITY_LABELS[p] || p }

const view = ref('table')
const keyword = ref('')
const filterStatus = ref('')
const filterPriority = ref('')
const filterSource = ref('')
const list = ref([])
const total = ref(0)
const totalPages = ref(1)
const page = ref(1)
const sortField = ref('')
const sortOrder = ref('')
const summary = ref(null)
const editVisible = ref(false)
const editRow = ref(null)
const editSource = ref(null)
const detailVisible = ref(false)
const detailRow = ref(null)

const detailFields = [
  { label: '名称', key: 'title' },
  { label: '紧急程度', key: 'priority', render: (v) => priorityLabel(v) },
  { label: '结束时间', key: 'dueTime', render: (v) => v || '-' },
  { label: '全天', key: 'allDay', render: (v) => (v ? '是' : '否') },
  { label: '标签', key: 'tag', render: (v) => v || '-' },
  { label: '提醒', key: 'remind', render: (v) => ({ none: '不提醒', '1h': '提前 1 小时', '1d': '提前 1 天' }[v] || '-') },
  { label: '来源', key: 'sourceLabel', render: (v) => v || '手动新建' },
  { label: '状态', key: 'status', render: (v) => (v === 'done' ? '已完成' : '待办') },
  { label: '完成时间', key: 'doneAt', render: (v) => v || '-' },
  { label: '创建时间', key: 'createdAt', render: (v) => v || '-' },
  { label: '备注', key: 'note', render: (v) => v || '-' }
]

// 逾期判断：未完成且结束时间已过
function isOverdue(row) {
  if (row.status === 'done' || !row.dueTime) return false
  return new Date(row.dueTime.replace(' ', 'T')) < new Date()
}

async function load() {
  try {
    const res = await getMyTodos({
      keyword: keyword.value,
      status: filterStatus.value,
      priority: filterPriority.value,
      sourceType: filterSource.value,
      page: page.value,
      sortField: sortField.value,
      sortOrder: sortOrder.value
    })
    if (res && res.success) {
      list.value = (res.data && res.data.list) || []
      total.value = (res.data && res.data.total) || 0
      totalPages.value = (res.data && res.data.totalPages) || 1
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
    const res = await getMyTodoSummary()
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
  filterStatus.value = ''
  filterPriority.value = ''
  filterSource.value = ''
  page.value = 1
  refreshAll()
}
function switchView(v) {
  view.value = v
  if (v === 'calendar') loadSummary()
}

function openCreate() {
  editRow.value = null
  editSource.value = null
  editVisible.value = true
}
function openEdit(row) {
  editRow.value = row
  editSource.value = null
  editVisible.value = true
}
function openDetail(row) {
  detailRow.value = row
  detailVisible.value = true
}
// 来源角标跳回原模块详情（复用各页 ?open= 直达机制）
function sourceJump(row) {
  if (!row.sourceType) return
  if (row.sourceType === 'task') router.push({ path: `${basePath}/tasks`, query: { open: row.sourceId } })
  else if (row.sourceType === 'meeting') router.push({ path: `${basePath}/meetings`, query: { open: row.sourceId, group: row.groupId } })
  else if (row.sourceType === 'report') router.push({ path: `${basePath}/report`, query: { open: row.sourceId } })
  else if (row.sourceType === 'notice') router.push({ path: `${basePath}/notices`, query: { open: row.sourceId } })
}
// 转换已存在跳转（TodoEditDialog @goto）
function gotoTodo(id) {
  openDetail({ id: Number(id) })
  load()
}
async function toggleDone(row) {
  const res = await toggleTodoDone(row.id)
  if (res && res.success) {
    await refreshAfterWrite(res.data && res.data.status === 'done' ? '已完成' : '已取消完成')
    refreshAll()
  } else {
    dialogAlert((res && res.message) || '操作失败')
  }
}
async function removeRow(row) {
  const ok = await dialogConfirm(`确定删除待办「${row.title}」吗？`, '删除待办')
  if (!ok) return
  const res = await removeTodo(row.id)
  if (res && res.success) {
    await refreshAfterWrite('已删除')
    refreshAll()
  } else {
    dialogAlert((res && res.message) || '删除失败')
  }
}

onMounted(async () => {
  refreshAll()
  // 全局搜索直达：?open=<id> → 打开对应待办详情
  const openId = route.query.open
  if (openId && /^\d+$/.test(String(openId))) {
    const target = list.value.find((r) => Number(r.id) === Number(openId))
    if (target) {
      openDetail(target)
    } else {
      await load()
      const found = list.value.find((r) => Number(r.id) === Number(openId))
      if (found) openDetail(found)
    }
  }
})
useAutoRefresh(refreshAll)
</script>

<style scoped>
.page-actions { margin-left: auto; display: flex; align-items: center; gap: 12px; }
.view-tabs { display: flex; gap: 4px; }
.view-tabs button { padding: 6px 14px; border: none; border-radius: var(--radius-md); background: var(--gray-soft); color: var(--text-2); font-size: 13px; cursor: pointer; }
.view-tabs button:hover { background: var(--bg-hover); }
.view-tabs button.on { background: var(--primary-soft); color: var(--primary); font-weight: 600; }
.tbl-wrap tr { cursor: pointer; }
.tbl-wrap tr:hover td { background: var(--bg-hover, #f3f4f6); }
.todo-title-done { text-decoration: line-through; color: var(--text-3, #9aa0aa); }
.due-overdue { color: var(--danger); font-weight: 600; }
.scope-metrics { display: flex; align-items: center; gap: 18px; font-size: 13px; color: var(--text-2, #6b7280); }
.scope-metrics span { display: flex; align-items: baseline; gap: 4px; }
.card-loading { padding: 30px; text-align: center; color: var(--text-3, #9aa0aa); }
.prio-tag { padding: 1px 10px; border-radius: 10px; font-size: 12px; }
.prio-tag.low { background: #ecfdf5; color: #16a34a; }
.prio-tag.medium { background: #fffbeb; color: #d97706; }
.prio-tag.high { background: #fef2f2; color: #dc2626; }
.src-tag { padding: 1px 8px; border-radius: 10px; font-size: 12px; cursor: pointer; }
.src-tag.task { background: #eff6ff; color: #2563eb; }
.src-tag.meeting { background: #f5f3ff; color: #7c3aed; }
.src-tag.report { background: #f0fdf4; color: #16a34a; }
.src-tag.notice { background: #fffbeb; color: #d97706; }
.src-tag:hover { filter: brightness(0.94); }
.muted { color: var(--text-3, #9aa0aa); font-size: 12px; }
.tag-ok { background: #ecfdf5; color: #16a34a; font-size: 12px; padding: 1px 8px; border-radius: 10px; }
.tag-off { background: #f3f4f6; color: #6b7280; font-size: 12px; padding: 1px 8px; border-radius: 10px; }
.op-col { white-space: nowrap; }
.op-col .ops { gap: 6px; }
</style>
