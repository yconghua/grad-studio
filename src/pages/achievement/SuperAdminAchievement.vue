<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">科研成果管理</h2>
        <p class="page-sub">全局学生科研成果统计、查看与导出</p>
      </div>
      <div class="page-actions">
        <button class="btn" @click="templateVisible = true">节点管理</button>
        <button class="btn" :disabled="exporting" @click="exportXlsx">{{ exporting ? '导出中…' : '导出 Excel' }}</button>
      </div>
    </div>

    <div v-if="!summary" class="card card-loading">加载中…</div>

    <template v-else>
      <div class="card ach-overview">
        <div class="ach-overview__item">
          <span class="ach-overview__label">范围</span>
          <select v-model="filterGroupId" class="input" style="width: 200px" @change="onFilterChange">
            <option :value="null">全部课题组</option>
            <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
          </select>
        </div>
        <div class="ach-overview__item"><span class="ach-overview__label">总成果</span><b>{{ summary.total }}</b></div>
        <div class="ach-overview__item"><span class="ach-overview__label">待确认</span><b style="color:#d97706">{{ summary.submitted }}</b></div>
        <div class="ach-overview__item"><span class="ach-overview__label">已确认</span><b style="color:#16a34a">{{ summary.confirmed }}</b></div>
      </div>

      <div class="card ach-table">
        <div class="tbl-wrap">
          <table v-resizable-columns="{ min: 48 }" v-sortable-columns="{ field: sortField, order: sortOrder, onSort }" class="tbl">
            <thead>
              <tr>
                <th data-sort="realName">学生</th>
                <th data-sort="userNo">学号</th>
                <th data-sort="type">类型</th>
                <th data-sort="title">成果名称</th>
                <th data-sort="publishDate">日期</th>
                <th data-sort="status">状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in list" :key="row.id" @click="openDetail(row)">
                <td class="ellipsis">{{ row.user.realName || row.user.username }}</td>
                <td class="ellipsis">{{ row.user.userNo || '-' }}</td>
                <td>{{ row.typeLabel }}</td>
                <td class="ellipsis" style="max-width: 280px">{{ row.title }}</td>
                <td>{{ row.publishDate || '-' }}</td>
                <td><span :class="statusTag(row.status)">{{ statusLabel(row.status) }}</span></td>
              </tr>
              <tr v-if="list.length === 0">
                <td colspan="6"><div class="empty">范围内暂无成果</div></td>
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
      </div>
    </template>

    <AchievementDetailDialog v-model:visible="detailVisible" :row="detailRow" mode="super-admin" @changed="refreshAll" />
    <AchievementStageTemplateDialog v-model:visible="templateVisible" type="paper" @changed="refreshAll" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AchievementDetailDialog from './AchievementDetailDialog.vue'
import AchievementStageTemplateDialog from './AchievementStageTemplateDialog.vue'
import { getAchievementStats, getAchievementStatsSummary, exportAchievementXlsx, listGroups } from '../../api'
import { dialogAlert } from '../../composables/useDialog'
import { useAutoRefresh } from '../../composables/useAutoRefresh'

const templateVisible = ref(false)

const STATUS_LABELS = { pending: '待填写', submitted: '待确认', confirmed: '已确认' }
function statusLabel(s) { return STATUS_LABELS[s] || s }
function statusTag(s) { return s === 'confirmed' ? 'tag-ok' : s === 'submitted' ? 'tag-warn' : 'tag-off' }

const groups = ref([])
const filterGroupId = ref(null)
const list = ref([])
const total = ref(0)
const totalPages = ref(1)
const page = ref(1)
const sortField = ref('')
const sortOrder = ref('')
const summary = ref(null)
const exporting = ref(false)
const detailVisible = ref(false)
const detailRow = ref(null)

async function loadGroups() {
  const res = await listGroups({ page: 1, pageSize: 200 })
  if (res && res.success) {
    groups.value = (res.data && res.data.list) || []
  }
}

async function load() {
  try {
    const res = await getAchievementStats({ groupId: filterGroupId.value, page: page.value, sortField: sortField.value, sortOrder: sortOrder.value })
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
    const res = await getAchievementStatsSummary({ groupId: filterGroupId.value })
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
function onFilterChange() {
  page.value = 1
  refreshAll()
}
function openDetail(row) {
  detailRow.value = row
  detailVisible.value = true
}

async function exportXlsx() {
  exporting.value = true
  try {
    const res = await exportAchievementXlsx({ groupId: filterGroupId.value })
    const r = (res && res.data) || res
    if (!r) return
    if (r.success) {
      dialogAlert(r.filePath ? `导出成功：${r.filePath}` : (r.message || '导出成功'))
    } else if (!r.canceled) {
      dialogAlert((r && r.message) || '导出失败')
    }
  } finally {
    exporting.value = false
  }
}

onMounted(() => {
  loadGroups()
  refreshAll()
})
useAutoRefresh(refreshAll)
</script>

<style scoped>
.page-actions { margin-left: auto; display: flex; gap: 10px; }
.ach-table { padding: 10px; }
.ach-table tr { cursor: pointer; }
.ach-table tr:hover td { background: var(--bg-hover, #f3f4f6); }
.ach-overview {
  display: flex;
  gap: 22px;
  flex-wrap: wrap;
  margin-bottom: 14px;
  padding: 14px 18px;
  align-items: center;
}
.ach-overview__item { display: flex; align-items: baseline; gap: 8px; }
.ach-overview__label { font-size: 13px; color: var(--text-2, #6b7280); }
.card-loading { padding: 30px; text-align: center; color: var(--text-3, #9aa0aa); }
.tag-ok { background: #ecfdf5; color: #16a34a; font-size: 12px; padding: 1px 8px; border-radius: 10px; }
.tag-warn { background: #fffbeb; color: #d97706; font-size: 12px; padding: 1px 8px; border-radius: 10px; }
.tag-off { background: #f3f4f6; color: #6b7280; font-size: 12px; padding: 1px 8px; border-radius: 10px; }
</style>
