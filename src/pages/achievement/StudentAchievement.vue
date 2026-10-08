<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">我的科研成果</h2>
        <p class="page-sub">记录论文、专利、软著、获奖、项目等成果，提交后由导师确认</p>
      </div>
      <div class="page-actions">
        <button class="btn" @click="openCreate">新增成果</button>
        <button class="btn" :disabled="exporting" @click="exportXlsx">{{ exporting ? '导出中…' : '导出成果' }}</button>
      </div>
    </div>

    <div v-if="!summary" class="card card-loading">加载中…</div>

    <template v-else>
      <!-- 筛选区：查询 / 重置（与用户管理等页面统一） -->
      <div class="toolbar">
        <input v-model="keyword" class="input" style="width: 220px" placeholder="成果名称 / 发表载体" @keyup.enter="search" />
        <select v-model="filterType" class="select" @change="search">
          <option value="">全部类型</option>
          <option v-for="(t, k) in ACH_TYPES" :key="k" :value="k">{{ t }}</option>
        </select>
        <select v-model="filterStatus" class="select" @change="search">
          <option value="">全部状态</option>
          <option value="pending">待填写</option>
          <option value="submitted">待确认</option>
          <option value="confirmed">已确认</option>
        </select>
        <button class="btn btn-primary" @click="search">查询</button>
        <button class="btn" @click="reset">重置</button>
        <div class="spacer"></div>
        <div class="scope-metrics">
          <span>总成果 <b>{{ summary.total }}</b></span>
          <span>待确认 <b style="color:#d97706">{{ summary.submitted }}</b></span>
          <span>已确认 <b style="color:#16a34a">{{ summary.confirmed }}</b></span>
        </div>
      </div>

      <div class="tbl-wrap">
        <table v-resizable-columns="{ min: 48 }" v-sortable-columns="{ field: sortField, order: sortOrder, onSort }" class="tbl">
          <thead>
            <tr>
              <th data-sort="type">类型</th>
              <th data-sort="title">成果名称</th>
              <th data-sort="venue">发表载体</th>
              <th data-sort="publishDate">日期</th>
              <th data-sort="status">状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in list" :key="row.id" @click="openDetail(row)">
              <td>{{ row.typeLabel }}</td>
              <td class="ellipsis" style="max-width: 280px">{{ row.title }}</td>
              <td class="ellipsis" style="max-width: 200px">{{ row.venue || '-' }}</td>
              <td>{{ row.publishDate || '-' }}</td>
              <td><span :class="statusTag(row.status)">{{ statusLabel(row.status) }}</span></td>
            </tr>
            <tr v-if="list.length === 0">
              <td colspan="5"><div class="empty">暂无成果，点击右上角「新增成果」开始记录</div></td>
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

    <AchievementEditDialog v-model:visible="editVisible" :row="editRow" @save="saveRecord" />
    <AchievementDetailDialog v-model:visible="detailVisible" :row="detailRow" mode="student" @changed="refreshAll" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AchievementEditDialog from './AchievementEditDialog.vue'
import AchievementDetailDialog from './AchievementDetailDialog.vue'
import { getAchievementStats, getAchievementStatsSummary, saveAchievement, exportAchievementXlsx } from '../../api'
import { dialogAlert } from '../../composables/useDialog'
import { refreshAfterWrite } from '../../composables/useGlobalRefresh'
import { useAutoRefresh } from '../../composables/useAutoRefresh'

const STATUS_LABELS = { pending: '待填写', submitted: '待确认', confirmed: '已确认' }
function statusLabel(s) { return STATUS_LABELS[s] || s }
function statusTag(s) { return s === 'confirmed' ? 'tag-ok' : s === 'submitted' ? 'tag-warn' : 'tag-off' }

const ACH_TYPES = { paper: '论文', patent: '专利', software: '软件著作权', award: '获奖', project: '项目', other: '其他' }

const keyword = ref('')
const filterType = ref('')
const filterStatus = ref('')
const list = ref([])
const total = ref(0)
const totalPages = ref(1)
const page = ref(1)
const sortField = ref('')
const sortOrder = ref('')
const summary = ref(null)
const exporting = ref(false)
const editVisible = ref(false)
const editRow = ref(null)
const detailVisible = ref(false)
const detailRow = ref(null)

async function load() {
  try {
    const res = await getAchievementStats({
      keyword: keyword.value,
      type: filterType.value,
      status: filterStatus.value,
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
    const res = await getAchievementStatsSummary({
      keyword: keyword.value,
      type: filterType.value,
      status: filterStatus.value
    })
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
// 查询：回到第一页并应用当前筛选
function search() {
  page.value = 1
  refreshAll()
}
// 重置：清空筛选并回到第一页
function reset() {
  keyword.value = ''
  filterType.value = ''
  filterStatus.value = ''
  page.value = 1
  refreshAll()
}

function openCreate() {
  editRow.value = null
  editVisible.value = true
}
function openDetail(row) {
  detailRow.value = row
  detailVisible.value = true
}

async function saveRecord(payload) {
  const res = await saveAchievement(payload)
  if (res && res.success) {
    editVisible.value = false
    await refreshAfterWrite('已保存')
    refreshAll()
  } else {
    dialogAlert((res && res.message) || '保存失败')
  }
}

async function exportXlsx() {
  exporting.value = true
  try {
    const res = await exportAchievementXlsx()
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

onMounted(refreshAll)
useAutoRefresh(refreshAll)
</script>

<style scoped>
.page-actions { margin-left: auto; display: flex; gap: 10px; }
.tbl-wrap tr { cursor: pointer; }
.tbl-wrap tr:hover td { background: var(--bg-hover, #f3f4f6); }
.scope-metrics { display: flex; align-items: center; gap: 18px; font-size: 13px; color: var(--text-2, #6b7280); }
.scope-metrics span { display: flex; align-items: baseline; gap: 4px; }
.card-loading { padding: 30px; text-align: center; color: var(--text-3, #9aa0aa); }
.tag-ok { background: #ecfdf5; color: #16a34a; font-size: 12px; padding: 1px 8px; border-radius: 10px; }
.tag-warn { background: #fffbeb; color: #d97706; font-size: 12px; padding: 1px 8px; border-radius: 10px; }
.tag-off { background: #f3f4f6; color: #6b7280; font-size: 12px; padding: 1px 8px; border-radius: 10px; }
</style>
