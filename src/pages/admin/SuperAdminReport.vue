<template>
  <div class="page sa-report">
    <div class="page-head">
      <div>
        <h2 class="page-title">周报统计</h2>
        <p class="page-sub">全平台周报提交统计、各组排名与按组核查（仅统计与运维，不展示任何周报内容）</p>
      </div>
    </div>

    <!-- 全局统计卡 -->
    <div class="stat-row">
      <div class="stat-card">
        <span class="stat-num">{{ statsData.expected ?? '-' }}</span>
        <span class="stat-label">应提交</span>
      </div>
      <div class="stat-card">
        <span class="stat-num">{{ statsData.submitted ?? '-' }}</span>
        <span class="stat-label">已提交</span>
      </div>
      <div class="stat-card">
        <span class="stat-num">{{ statsData.submitRate ?? '-' }}<i v-if="statsData.submitRate !== null">%</i></span>
        <span class="stat-label">提交率</span>
      </div>
      <div class="stat-card">
        <span class="stat-num">{{ statsData.onTimeRate ?? '-' }}<i v-if="statsData.onTimeRate !== null">%</i></span>
        <span class="stat-label">按时率</span>
      </div>
      <div class="stat-card">
        <span class="stat-num">{{ statsData.reviewed ?? '-' }}</span>
        <span class="stat-label">已批阅</span>
      </div>
      <div class="stat-card">
        <span class="stat-num">{{ statsData.avgScore ?? '-' }}</span>
        <span class="stat-label">平均评分</span>
      </div>
    </div>

    <div class="grid">
      <!-- 各组成绩排名 -->
      <div class="panel">
        <div class="panel-head">
          <span class="panel-title">各组成绩排名（本周）</span>
        </div>
        <div class="table-wrap">
          <table v-resizable-columns class="table">
            <thead>
              <tr>
                <th>#</th>
                <th>课题组</th>
                <th>已提交</th>
                <th>按时</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!ranking.length"><td colspan="4" class="center">本周暂无提交数据</td></tr>
              <tr v-else v-for="(g, i) in ranking" :key="g.groupId">
                <td>{{ i + 1 }}</td>
                <td>{{ g.groupName }}</td>
                <td>{{ g.submitted }}</td>
                <td>{{ g.onTime }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 近 5 周趋势 -->
      <div class="panel">
        <div class="panel-head"><span class="panel-title">提交趋势（近 5 周）</span></div>
        <div class="trend">
          <div v-for="t in trend" :key="t.weekKey" class="trend-col">
            <span class="trend-val">{{ t.submitted }}</span>
            <div class="trend-bar" :style="{ height: barHeight(t.submitted) }"></div>
            <span class="trend-label">{{ shortWeek(t.weekKey) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 按组核查（无内容元数据） -->
    <div class="panel audit-panel">
      <div class="panel-head">
        <span class="panel-title">按组核查</span>
        <div class="filters">
          <select v-model="audit.groupId" class="input input-sm" style="width: 200px">
            <option value="">选择课题组</option>
            <option v-for="g in groupOptions" :key="g.id" :value="g.id">{{ g.name }}</option>
          </select>
          <input v-model="audit.weekKey" class="input input-sm" placeholder="周次如 2026-40" style="width: 120px" />
          <select v-model="audit.status" class="input input-sm" style="width: 110px">
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="submitted">待批阅</option>
            <option value="returned">已打回</option>
            <option value="reviewed">已批阅</option>
          </select>
          <button type="button" class="btn btn-sm" @click="searchAudit">查询</button>
        </div>
      </div>
      <div class="table-wrap">
        <table v-resizable-columns class="table">
          <thead>
            <tr>
              <th>学生</th>
              <th>周次</th>
              <th>主题</th>
              <th>状态</th>
              <th>提交时间</th>
              <th>附件</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="auditLoading"><td colspan="7" class="center">加载中…</td></tr>
            <tr v-else-if="!auditList.length"><td colspan="7" class="center">暂无记录</td></tr>
            <tr v-else v-for="n in auditList" :key="n.id">
              <td>{{ n.student_name || n.user_id }}</td>
              <td>{{ n.week_key }}</td>
              <td class="ellipsis" :title="n.title">{{ n.title || '（无主题）' }}</td>
              <td><span class="st" :class="'st-' + n.status">{{ statusText(n.status) }}</span></td>
              <td>{{ n.submitted_at || '-' }}</td>
              <td>{{ n.attachCount ?? '-' }}</td>
              <td>
                <button type="button" class="btn btn-sm btn-danger" @click="onPurge(n)">强制删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="auditPages > 1" class="pager">
        <button type="button" class="btn btn-sm" :disabled="auditPage <= 1" @click="onAuditPrev">上一页</button>
        <span>第 {{ auditPage }} / {{ auditPages }} 页</span>
        <button type="button" class="btn btn-sm" :disabled="auditPage >= auditPages" @click="onAuditNext">下一页</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { reportStats, reportListMeta, reportPurge, listGroups } from '../../api'
import { REPORT_STATUS_DRAFT, REPORT_STATUS_SUBMITTED, REPORT_STATUS_RETURNED, REPORT_STATUS_REVIEWED } from '../../config/constants'
import { dialogAlert, dialogConfirm, dialogPrompt } from '../../composables/useDialog'

const statsData = ref({})
const ranking = ref([])
const trend = ref([])

const groupOptions = ref([])
const audit = ref({ groupId: '', weekKey: '', status: '' })
const auditPage = ref(1)
const auditPages = ref(1)
const auditList = ref([])
const auditLoading = ref(false)

const STATUS_TEXT = {
  [REPORT_STATUS_DRAFT]: '草稿',
  [REPORT_STATUS_SUBMITTED]: '待批阅',
  [REPORT_STATUS_RETURNED]: '已打回',
  [REPORT_STATUS_REVIEWED]: '已批阅'
}
function statusText(s) {
  return STATUS_TEXT[s] || s
}
function shortWeek(key) {
  const m = /^(\d{4})-(\d{1,2})$/.exec(key || '')
  return m ? `W${m[2]}` : key
}
function barHeight(submitted) {
  const max = Math.max(1, ...trend.value.map((t) => Number(t.submitted) || 0))
  return Math.max(4, Math.round((Number(submitted) / max) * 100)) + 'px'
}

async function loadStats() {
  try {
    const res = await reportStats({})
    if (res && res.success) {
      statsData.value = res.data || {}
      ranking.value = (res.data && res.data.ranking) || []
      trend.value = (res.data && res.data.trend) || []
    }
  } catch (e) {
    statsData.value = {}
  }
}

async function loadGroups() {
  try {
    const res = await listGroups({ page: 1, pageSize: 100 })
    if (res && res.success) groupOptions.value = (res.data && res.data.list) || []
  } catch (e) {
    groupOptions.value = []
  }
}

async function searchAudit() {
  auditLoading.value = true
  try {
    const params = { page: auditPage.value }
    if (audit.value.groupId) params.groupId = Number(audit.value.groupId)
    if (audit.value.weekKey) params.weekKey = audit.value.weekKey.trim()
    if (audit.value.status) params.status = audit.value.status
    const res = await reportListMeta(params)
    const d = res && res.data
    if (res && res.success && d) {
      auditList.value = d.list || []
      auditPages.value = d.totalPages || 1
      auditPage.value = d.page || 1
    } else {
      auditList.value = []
      dialogAlert((res && res.message) || '查询失败，请重试')
    }
  } catch (e) {
    auditList.value = []
  } finally {
    auditLoading.value = false
  }
}

function onAuditPrev() {
  if (auditPage.value <= 1) return
  auditPage.value--
  searchAudit()
}
function onAuditNext() {
  if (auditPage.value >= auditPages.value) return
  auditPage.value++
  searchAudit()
}

async function onPurge(n) {
  const ok = await dialogConfirm(
    `确定强制删除「${n.student_name || n.user_id}」的 ${n.week_key} 周报吗？\n该操作将物理删除周报及其全部附件，且会通知该学生，不可恢复！`,
    '强制删除周报'
  )
  if (!ok) return
  const reason = await dialogPrompt('请输入删除原因（将随通知发送给学生）：', '', '删除原因')
  if (reason === null) return
  const res = await reportPurge(n.id, reason)
  if (res && res.success) {
    dialogAlert('已强制删除并通知学生')
    searchAudit()
  } else {
    dialogAlert((res && res.message) || '删除失败，请重试')
  }
}

onMounted(() => {
  loadStats()
  loadGroups()
})
</script>

<style scoped>
.sa-report {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}
.stat-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.stat-card {
  flex: 1 1 120px;
  max-width: 170px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-num { font-size: 22px; font-weight: 700; color: var(--text); }
.stat-label { font-size: 12px; color: var(--muted); }

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 12px;
}
@media (max-width: 960px) {
  .grid { grid-template-columns: 1fr; }
}

.panel {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-light);
  flex-wrap: wrap;
}
.panel-title { font-weight: 600; color: var(--text); font-size: 14px; }
.table-wrap { overflow-x: auto; }
.table { width: 100%; border-collapse: collapse; font-size: 13px; }
.table th, .table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--border-light); }
.table th { color: var(--muted); font-weight: 500; background: var(--bg-hover); white-space: nowrap; }
.center { text-align: center; color: var(--muted); }
.ellipsis {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 趋势图 */
.trend {
  display: flex;
  align-items: flex-end;
  gap: 14px;
  padding: 14px 16px;
  min-height: 160px;
}
.trend-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.trend-val { font-size: 13px; font-weight: 600; color: var(--text); }
.trend-bar {
  width: 26px;
  background: var(--primary);
  border-radius: 4px 4px 0 0;
  opacity: 0.85;
}
.trend-label { font-size: 12px; color: var(--muted); }

.audit-panel { margin-top: 12px; flex: 0 0 auto; }
.filters { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 8px;
  font-size: 12px;
  color: var(--text-2);
}

.st {
  display: inline-block;
  padding: 0 8px;
  border-radius: var(--radius-full);
  font-size: 12px;
  line-height: 20px;
}
.st-draft { background: var(--bg-hover); color: var(--text-2); }
.st-submitted { background: var(--primary-soft); color: var(--primary); }
.st-returned { background: var(--danger-soft); color: var(--danger); }
.st-reviewed { background: var(--success-soft); color: var(--success); }
</style>
