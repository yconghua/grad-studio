<template>
  <div class="page ga-report">
    <div class="page-head">
      <div>
        <h2 class="page-title">组内周报</h2>
        <p class="page-sub">查看本组周报、提交统计与未交名单；可设置免交周、维护组内周报模板、催交未交学生</p>
      </div>
    </div>

    <div class="tabs">
      <button type="button" :class="tab === 'list' ? 'on' : ''" @click="switchTab('list')">周报与统计</button>
      <button type="button" :class="tab === 'cfg' ? 'on' : ''" @click="switchTab('cfg')">免交周与模板</button>
    </div>

    <!-- ===== Tab1：周报与统计 ===== -->
    <div v-if="tab === 'list'" class="tab-body">
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
          <span class="stat-num">{{ statsData.avgScore ?? '-' }}</span>
          <span class="stat-label">平均评分</span>
        </div>
        <div class="stat-card stat-wide">
          <span class="stat-label" style="font-weight: 600">未交学生（{{ (statsData.missedList || []).length }}）</span>
          <span class="stat-sub">{{ missedText }}</span>
        </div>
      </div>

      <div class="action-row">
        <button type="button" class="btn btn-primary" :disabled="reminding" @click="onRemind">
          {{ reminding ? '提醒中…' : '一键催交未交学生' }}
        </button>
        <span v-if="statsData.holiday" class="holiday-tip">本周为免交周，不纳入统计</span>
        <span v-else class="holiday-tip">{{ statsData.weekLabel }}</span>
      </div>

      <!-- 组内周报列表 -->
      <div class="list-panel">
        <div class="list-panel-head">
          <span class="panel-title">组内周报</span>
          <div class="filters">
            <input v-model="filters.weekKey" class="input input-sm" placeholder="周次如 2026-40" style="width: 120px" />
            <select v-model="filters.status" class="input input-sm" style="width: 110px">
              <option value="">全部状态</option>
              <option value="draft">草稿</option>
              <option value="submitted">待批阅</option>
              <option value="returned">已打回</option>
              <option value="reviewed">已批阅</option>
            </select>
            <button type="button" class="btn btn-sm" @click="search">查询</button>
          </div>
        </div>
        <div class="table-wrap">
          <table v-resizable-columns v-sortable-columns="{ field: sortField, order: sortOrder, onSort }" class="table">
            <thead>
              <tr>
                <th data-sort="studentName">学生</th>
                <th data-sort="weekKey">周次</th>
                <th data-sort="title">主题</th>
                <th data-sort="status">状态</th>
                <th data-sort="submittedAt">提交时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="listLoading"><td colspan="6" class="center">加载中…</td></tr>
              <tr v-else-if="!list.length"><td colspan="6" class="center">暂无周报</td></tr>
              <tr v-else v-for="n in list" :key="n.id">
                <td>{{ n.student_name || n.user_id }}</td>
                <td>
                  {{ n.week_key }}
                  <span v-if="Number(n.is_late) === 1" class="tag tag-orange">补交</span>
                </td>
                <td class="ellipsis" :title="n.title">{{ n.title || '（无主题）' }}</td>
                <td><span class="st" :class="'st-' + n.status">{{ statusText(n.status) }}</span></td>
                <td>{{ n.submitted_at || '-' }}</td>
                <td>
                  <button type="button" class="btn btn-sm" @click="onView(n)">查看</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="totalPages > 1" class="pager">
          <button type="button" class="btn btn-sm" :disabled="page <= 1" @click="onPrevPage">上一页</button>
          <span>第 {{ page }} / {{ totalPages }} 页</span>
          <button type="button" class="btn btn-sm" :disabled="page >= totalPages" @click="onNextPage">下一页</button>
        </div>
      </div>
    </div>

    <!-- ===== Tab2：免交周与模板 ===== -->
    <div v-else class="tab-body cfg-body">
      <div class="cfg-card">
        <div class="cfg-title">免交周设置</div>
        <p class="cfg-desc">设置后该周不计入本组应提交人数与提交率统计。</p>
        <div class="cfg-form">
          <input v-model="holidayWeek" class="input" placeholder="周次，如 2026-41" style="width: 140px" />
          <input v-model="holidayReason" class="input" placeholder="原因（选填）" style="width: 220px" />
          <button type="button" class="btn btn-primary" @click="onAddHoliday">设为免交周</button>
        </div>
        <div v-if="holidays.length" class="holiday-list">
          <div v-for="h in holidays" :key="h.id" class="holiday-item">
            <span class="hw">{{ h.week_key }}</span>
            <span class="hr">{{ h.reason || '（未填原因）' }}</span>
            <button type="button" class="btn btn-sm btn-danger" @click="onRemoveHoliday(h)">移除</button>
          </div>
        </div>
        <div v-else class="cfg-empty">暂无免交周</div>
      </div>

      <div class="cfg-card">
        <div class="cfg-title">组内周报模板</div>
        <p class="cfg-desc">学生新建周报时默认使用本组模板（未设置时使用系统内置模板）。</p>
        <input v-model="templateName" class="input" maxlength="50" placeholder="模板名称" style="width: 260px" />
        <textarea v-model="templateContent" class="template-area" maxlength="100000" placeholder="模板内容（Markdown），新建周报时自动带入"></textarea>
        <div class="cfg-actions">
          <button type="button" class="btn btn-primary" :disabled="savingTemplate" @click="onSaveTemplate">
            {{ savingTemplate ? '保存中…' : '保存模板' }}
          </button>
          <span v-if="templateTip" class="tip">{{ templateTip }}</span>
        </div>
      </div>
    </div>

    <!-- 查看周报详情 -->
    <ReportDetailDialog v-model:visible="showDetail" :note-id="detailNoteId" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  reportStats, reportRemind, reportListGroup,
  reportDownloadAttachment, reportListHolidays, reportUpsertHoliday, reportRemoveHoliday,
  reportListTemplates, reportSaveTemplate
} from '../../api'
import { REPORT_STATUS_DRAFT, REPORT_STATUS_SUBMITTED, REPORT_STATUS_RETURNED, REPORT_STATUS_REVIEWED } from '../../config/constants'
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'
import { useAutoRefresh } from '../../composables/useAutoRefresh'
import ReportDetailDialog from '../../components/report/ReportDetailDialog.vue'

const tab = ref('list')

const statsData = ref({})
const reminding = ref(false)

const page = ref(1)
const totalPages = ref(1)
const list = ref([])
const listLoading = ref(false)
const filters = ref({ weekKey: '', status: '' })
const sortField = ref('')
const sortOrder = ref('')

const holidays = ref([])
const holidayWeek = ref('')
const holidayReason = ref('')

const templates = ref([])
const templateName = ref('')
const templateContent = ref('')
const savingTemplate = ref(false)
const templateTip = ref('')

const showDetail = ref(false)
const detailNoteId = ref(null)

const STATUS_TEXT = {
  [REPORT_STATUS_DRAFT]: '草稿',
  [REPORT_STATUS_SUBMITTED]: '待批阅',
  [REPORT_STATUS_RETURNED]: '已打回',
  [REPORT_STATUS_REVIEWED]: '已批阅'
}
function statusText(s) {
  return STATUS_TEXT[s] || s
}

const missedText = computed(() => {
  const arr = statsData.value.missedList || []
  if (!arr.length) return '本周全员已提交'
  return arr.slice(0, 6).map((s) => s.realName || s.username).join('、') + (arr.length > 6 ? ` 等 ${arr.length} 人` : '')
})

function switchTab(t) {
  if (tab.value === t) return
  tab.value = t
  if (t === 'cfg') loadConfig()
}

async function loadStats() {
  try {
    const res = await reportStats({})
    if (res && res.success) statsData.value = res.data || {}
  } catch (e) {
    statsData.value = {}
  }
}

async function loadList() {
  listLoading.value = true
  try {
    const params = { page: page.value, sortField: sortField.value, sortOrder: sortOrder.value }
    if (filters.value.weekKey) params.weekKey = filters.value.weekKey.trim()
    if (filters.value.status) params.status = filters.value.status
    const res = await reportListGroup(params)
    const d = res && res.data
    if (res && res.success && d) {
      list.value = d.list || []
      totalPages.value = d.totalPages || 1
      page.value = d.page || 1
    } else {
      list.value = []
    }
  } catch (e) {
    list.value = []
  } finally {
    listLoading.value = false
  }
}

function search() {
  page.value = 1
  loadList()
}
function onSort(field, order) {
  sortField.value = field
  sortOrder.value = order
  page.value = 1
  loadList()
}
function onPrevPage() {
  if (page.value <= 1) return
  page.value--
  loadList()
}
function onNextPage() {
  if (page.value >= totalPages.value) return
  page.value++
  loadList()
}

async function onRemind() {
  const ok = await dialogConfirm('将向本周未提交周报的学生发送催交通知，确定吗？', '催交周报')
  if (!ok) return
  reminding.value = true
  try {
    const res = await reportRemind({})
    if (res && res.success) {
      dialogAlert(`已向 ${res.data && res.data.reminded ? res.data.reminded : 0} 名学生发送催交通知`)
    } else {
      dialogAlert((res && res.message) || '催交失败，请重试')
    }
  } catch (e) {
    dialogAlert('催交失败，请重试')
  } finally {
    reminding.value = false
  }
}

// 打开详情弹窗（详情加载与附件下载逻辑在 ReportDetailDialog 中）
function onView(n) {
  detailNoteId.value = n.id
  showDetail.value = true
}

// ===== 免交周 =====
async function loadConfig() {
  try {
    const res = await reportListHolidays()
    if (res && res.success) holidays.value = res.data || []
    const tpl = await reportListTemplates()
    if (tpl && tpl.success && Array.isArray(tpl.data)) {
      templates.value = tpl.data
      const mine = templates.value.find((t) => t.group_id != null)
      if (mine) {
        templateName.value = mine.name || ''
        templateContent.value = mine.content || ''
      } else {
        templateName.value = '组内默认周报模板'
        templateContent.value = ''
      }
    }
  } catch (e) {
    // 静默
  }
}

async function onAddHoliday() {
  const wk = String(holidayWeek.value || '').trim()
  if (!/^\d{4}-\d{1,2}$/.test(wk)) {
    dialogAlert('周次格式不正确，如 2026-40')
    return
  }
  const res = await reportUpsertHoliday({ weekKey: wk, reason: String(holidayReason.value || '').trim() })
  if (res && res.success) {
    holidays.value = res.data || []
    holidayWeek.value = ''
    holidayReason.value = ''
    dialogAlert('已设置免交周')
  } else {
    dialogAlert((res && res.message) || '设置失败，请重试')
  }
}

async function onRemoveHoliday(h) {
  const ok = await dialogConfirm(`确定移除 ${h.week_key} 免交设置吗？`, '移除免交周')
  if (!ok) return
  const res = await reportRemoveHoliday(h.week_key)
  if (res && res.success) {
    holidays.value = res.data || []
  } else {
    dialogAlert((res && res.message) || '移除失败，请重试')
  }
}

async function onSaveTemplate() {
  const name = String(templateName.value || '').trim()
  if (!name) {
    dialogAlert('请输入模板名称')
    return
  }
  if (!String(templateContent.value || '').trim()) {
    dialogAlert('模板内容不能为空')
    return
  }
  savingTemplate.value = true
  templateTip.value = ''
  try {
    const res = await reportSaveTemplate({ name, content: templateContent.value })
    if (res && res.success) {
      templates.value = res.data || []
      templateTip.value = '已保存'
      setTimeout(() => (templateTip.value = ''), 2000)
    } else {
      dialogAlert((res && res.message) || '保存失败，请重试')
    }
  } catch (e) {
    dialogAlert('保存失败，请重试')
  } finally {
    savingTemplate.value = false
  }
}

onMounted(() => {
  loadStats()
  loadList()
})
// 数据变动（本页写操作或外部改动）后后台静默重拉统计与列表
useAutoRefresh(() => {
  loadStats()
  loadList()
})
</script>

<style scoped>
.ga-report {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.tabs {
  display: flex;
  gap: 4px;
  margin-top: 2px;
}
.tabs button {
  padding: 6px 16px;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--text-2);
  font-size: 14px;
  cursor: pointer;
}
.tabs button.on {
  color: var(--primary);
  border-bottom-color: var(--primary);
  font-weight: 600;
}
.tab-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stat-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.stat-card {
  flex: 1 1 110px;
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
.stat-sub {
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.stat-wide { flex: 1 1 220px; max-width: 320px; }

.action-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.holiday-tip { font-size: 12px; color: var(--muted); }

.list-panel {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.list-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-light);
  flex-wrap: wrap;
}
.panel-title { font-weight: 600; color: var(--text); font-size: 14px; }
.filters { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.table-wrap { overflow-x: auto; flex: 1 1 auto; }
.table { width: 100%; border-collapse: collapse; font-size: 13px; }
.table th, .table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--border-light); }
.table th { color: var(--muted); font-weight: 500; background: var(--bg-hover); white-space: nowrap; }
.center { text-align: center; color: var(--muted); }
.ellipsis {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 8px;
  font-size: 12px;
  color: var(--text-2);
}

/* 配置 Tab */
.cfg-body { display: block; }
.cfg-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  padding: 14px;
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cfg-title { font-weight: 700; color: var(--text); font-size: 14px; }
.cfg-desc { font-size: 12px; color: var(--muted); margin: 0; }
.cfg-form { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.holiday-list { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }
.holiday-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-size: 13px;
}
.hw { font-weight: 600; color: var(--text); flex: 0 0 auto; }
.hr { color: var(--text-2); flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cfg-empty { font-size: 12px; color: var(--muted); }
.template-area {
  min-height: 180px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 10px;
  font-size: 13px;
  line-height: 1.7;
  resize: vertical;
  background: var(--bg-card);
  color: var(--text);
  font-family: inherit;
}
.cfg-actions { display: flex; align-items: center; gap: 10px; }
.tip { font-size: 12px; color: var(--success); }

/* 详情弹窗样式已随组件搬至 components/report/ReportDetailDialog.vue */

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
