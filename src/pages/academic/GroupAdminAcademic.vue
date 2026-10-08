<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">本组学业档案管理</h2>
        <p class="page-sub">本组学生学业档案进度总览与阶段模板管理</p>
      </div>
      <div class="page-actions">
        <button class="btn" :disabled="exporting" @click="exportAll">{{ exporting ? '导出中…' : '导出全部学业档案' }}</button>
        <button class="btn" @click="openTemplate">配置阶段模板</button>
      </div>
    </div>

    <div v-if="!summary" class="card card-loading">加载中…</div>

    <template v-else>
      <!-- 筛选区：所属范围置前，查询 / 重置，数字统计放重置按钮后（与用户管理等页面统一） -->
      <div class="toolbar">
        <span class="scope-label">所属范围：{{ summary.groupName }}</span>
        <input v-model="keyword" class="input" style="width: 220px" placeholder="学生姓名 / 学号 / 用户名" @keyup.enter="search" />
        <select v-model="degree" class="select" @change="search">
          <option value="">全部培养类型</option>
          <option value="硕士">硕士</option>
          <option value="博士">博士</option>
          <option value="本科">本科</option>
        </select>
        <button class="btn btn-primary" @click="search">查询</button>
        <button class="btn" @click="reset">重置</button>
        <div class="spacer"></div>
        <div class="scope-metrics">
          <span>学生数 <b>{{ summary.studentCount }}</b></span>
          <span>平均完成率 <b>{{ summary.avgRate }}%</b></span>
          <span>逾期 <b style="color:#dc2626">{{ summary.totalOverdue }}</b></span>
        </div>
      </div>

      <div class="tbl-wrap">
        <table v-resizable-columns="{ min: 48 }" v-sortable-columns="{ field: sortField, order: sortOrder, onSort }" class="tbl">
          <thead>
            <tr>
              <th data-sort="realName">学生</th>
              <th data-sort="userNo">学号</th>
              <th data-sort="degree">类型</th>
              <th>进度</th>
              <th>逾期</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in list" :key="s.user.id" @click="openDetail(s.user.id)">
              <td class="ellipsis">{{ s.user.realName || s.user.username }}</td>
              <td class="ellipsis">{{ s.user.userNo || '-' }}</td>
              <td>{{ stageLabel(s.stageType) }}</td>
              <td>
                <div class="bar"><div class="bar__fill" :style="{ width: s.progress + '%' }"></div></div>
                <span class="bar__text">{{ s.done }}/{{ s.nodeCount }}</span>
              </td>
              <td><span v-if="s.overdue" class="overdue">{{ s.overdue }}</span><span v-else>-</span></td>
            </tr>
            <tr v-if="list.length === 0">
              <td colspan="5"><div class="empty">本组暂无学生</div></td>
            </tr>
          </tbody>
        </table>
        <div class="pager">
          <button class="btn btn-sm" :disabled="page <= 1" @click="page--; load()">上一页</button>
          <span>第 {{ page }} / {{ totalPages || 1 }} 页</span>
          <button class="btn btn-sm" :disabled="page >= totalPages" @click="page++; load()">下一页</button>
          <span>共 {{ total }} 人</span>
        </div>
      </div>
    </template>

    <AcademicTemplateDialog v-model:visible="tplVisible" :stage-type="tplStageType" @changed="load" />
    <AcademicDetailDialog v-model:visible="detailVisible" :user-id="detailUserId" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AcademicTemplateDialog from './AcademicTemplateDialog.vue'
import AcademicDetailDialog from './AcademicDetailDialog.vue'
import { getAcademicStats, getAcademicStatsSummary, exportAllAcademic } from '../../api'
import { dialogAlert } from '../../composables/useDialog'
import { useAutoRefresh } from '../../composables/useAutoRefresh'

const STAGE_LABELS = { master: '硕士', doctor: '博士', bachelor: '本科' }
function stageLabel(t) {
  return STAGE_LABELS[t] || t
}

const keyword = ref('')
const degree = ref('')
// 列表：与其他列表统一的后端分页（每页 8 条）+ 表头排序
const list = ref([])
const total = ref(0)
const totalPages = ref(1)
const page = ref(1)
const sortField = ref('')
const sortOrder = ref('')
// 顶部统计卡：独立聚合接口（与列表同一筛选口径）
const summary = ref(null)
const tplVisible = ref(false)
const tplStageType = ref('master')
// 详情弹窗
const detailVisible = ref(false)
const detailUserId = ref(null)

async function load() {
  try {
    const res = await getAcademicStats(null, page.value, sortField.value, sortOrder.value, keyword.value, degree.value)
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
async function loadSummary() {
  try {
    const res = await getAcademicStatsSummary(null, keyword.value, degree.value)
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
// 表头排序：回到第一页并重新加载（与其他列表一致）
function onSort(field, order) {
  sortField.value = field
  sortOrder.value = order
  page.value = 1
  load()
}
// 查询：回到第一页并应用当前筛选
function search() {
  page.value = 1
  refreshAll()
}
// 重置：清空筛选并回到第一页
function reset() {
  keyword.value = ''
  degree.value = ''
  page.value = 1
  refreshAll()
}
// 点击行：打开档案详情弹窗
function openDetail(userId) {
  detailUserId.value = userId
  detailVisible.value = true
}

function openTemplate() {
  const target = list.value[0]
  tplStageType.value = (target && target.stageType) || 'master'
  tplVisible.value = true
}

// 一键导出本组全部学生学业档案（Excel）
const exporting = ref(false)
async function exportAll() {
  exporting.value = true
  try {
    const res = await exportAllAcademic()
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
.bar {
  width: 80px;
  height: 6px;
  border-radius: 3px;
  background: var(--line, #e5e7eb);
  display: inline-block;
  vertical-align: middle;
}
.bar__fill { height: 100%; border-radius: 3px; background: #2563eb; }
.bar__text { font-size: 11px; color: var(--text-2, #6b7280); margin-left: 6px; }
.overdue { color: #dc2626; font-weight: 600; }
.scope-label { font-size: 13px; color: var(--text-2, #6b7280); white-space: nowrap; }
.page-actions { margin-left: auto; display: flex; gap: 12px; }
.scope-metrics { display: flex; align-items: center; gap: 18px; font-size: 13px; color: var(--text-2, #6b7280); }
.scope-metrics span { display: flex; align-items: baseline; gap: 4px; }
.card-loading { padding: 30px; text-align: center; color: var(--text-3, #9aa0aa); }
.tbl-wrap tr { cursor: pointer; }
.tbl-wrap tr:hover td { background: var(--bg-hover, #f3f4f6); }
</style>
