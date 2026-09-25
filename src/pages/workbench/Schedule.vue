<template>
  <div class="schedule-page">
    <!-- 头部：标题 + 视图切换 + 新增 -->
    <div class="page-head">
      <h3 class="page-title">日程安排</h3>
      <div class="head-actions">
        <div class="view-tabs">
          <button class="tab-btn" :class="{ active: view === 'calendar' }" @click="view = 'calendar'">日历视图</button>
          <button class="tab-btn" :class="{ active: view === 'list' }" @click="view = 'list'">列表视图</button>
        </div>
        <button class="btn btn-primary" @click="openCreate">新增日程</button>
      </div>
    </div>

    <!-- ===== 日历视图 ===== -->
    <div v-if="view === 'calendar'" class="calendar-wrap">
      <div class="cal-head">
        <div class="cal-nav">
          <button class="btn nav-btn" @click="shiftMonth(-1)">‹</button>
          <span class="cal-title">{{ calYear }} 年 {{ calMonth + 1 }} 月</span>
          <button class="btn nav-btn" @click="shiftMonth(1)">›</button>
          <button class="btn nav-btn" @click="goToday">今天</button>
        </div>
        <div class="cal-legend">
          <span v-for="lg in legends" :key="lg.key" class="legend-item">
            <i class="legend-dot" :style="{ background: lg.color }"></i>{{ lg.label }}
          </span>
        </div>
      </div>

      <div class="cal-grid">
        <div v-for="w in weekHeaders" :key="w" class="cal-cell cal-week">{{ w }}</div>
        <template v-for="(cell, i) in cells" :key="i">
          <div class="cal-cell" :class="{ 'other-month': cell.outside, today: cell.today }">
            <div class="cal-date">{{ cell.day }}</div>
            <div v-for="ev in cell.events.slice(0, 3)" :key="ev.bizType + ev.bizId + ev.date" class="cal-event" :style="{ borderLeftColor: evColor(ev.type) }" @click.stop="openEvent(ev)">
              <span class="ev-text">{{ evTitle(ev) }}</span>
            </div>
            <div v-if="cell.events.length > 3" class="cal-more" @click.stop="openDay(cell)">+{{ cell.events.length - 3 }} 更多</div>
          </div>
        </template>
      </div>
    </div>

    <!-- ===== 列表视图 ===== -->
    <div v-else class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>日程</th>
            <th>类型</th>
            <th>开始</th>
            <th>结束</th>
            <th>地点</th>
            <th class="col-ops">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading" class="state-row"><td colspan="6">加载中…</td></tr>
          <tr v-else-if="!list.length" class="state-row"><td colspan="6">暂无日程</td></tr>
          <tr v-for="row in list" :key="row.id">
            <td>{{ row.title }}</td>
            <td>{{ typeLabel(row.type) }}</td>
            <td>{{ fmtDateTime(row.start_time) }}</td>
            <td>{{ fmtDateTime(row.end_time) }}</td>
            <td>{{ row.location || '-' }}</td>
            <td class="col-ops">
              <button class="btn-link" @click="openEdit(row)">编辑</button>
              <button class="btn-link danger" @click="confirmRemove(row)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 新增 / 编辑日程弹窗 -->
    <div v-if="formVisible" class="modal-mask" @click.self="closeForm">
      <div class="modal-box">
        <div class="modal-head">
          <h4>{{ formMode === 'create' ? '新增日程' : '编辑日程' }}</h4>
          <button class="modal-close" @click="closeForm">×</button>
        </div>
        <div class="modal-body">
          <div class="form-item">
            <label class="form-label">日程标题<span class="req"> *</span></label>
            <input v-model="form.title" class="form-input" placeholder="必填" />
          </div>
          <div class="form-item">
            <label class="form-label">类型</label>
            <select v-model="form.type" class="form-input">
              <option v-for="o in SCHEDULE_TYPE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>
          <div class="form-row">
            <div class="form-item">
              <label class="form-label">开始时间</label>
              <input v-model="form.start_time" type="datetime-local" class="form-input" />
            </div>
            <div class="form-item">
              <label class="form-label">结束时间</label>
              <input v-model="form.end_time" type="datetime-local" class="form-input" />
            </div>
          </div>
          <div class="form-item">
            <label class="form-label">地点</label>
            <input v-model="form.location" class="form-input" />
          </div>
          <div class="form-item">
            <label class="form-label">说明</label>
            <textarea v-model="form.description" class="form-input form-textarea" rows="3"></textarea>
          </div>
          <p v-if="formError" class="form-error">{{ formError }}</p>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="closeForm">取消</button>
          <button class="btn btn-primary" @click="submit" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button>
        </div>
      </div>
    </div>

    <!-- 单日事件弹窗 -->
    <div v-if="dayVisible" class="modal-mask" @click.self="dayVisible = false">
      <div class="modal-box">
        <div class="modal-head">
          <h4>{{ dayTitle }} 的事件</h4>
          <button class="modal-close" @click="dayVisible = false">×</button>
        </div>
        <div class="modal-body">
          <div v-if="!dayEvents.length" class="empty-tip">这一天暂无事件</div>
          <div v-for="ev in dayEvents" :key="ev.bizType + ev.bizId + ev.date" class="day-event" @click="openEvent(ev)">
            <i class="ev-dot" :style="{ background: evColor(ev.type) }"></i>
            <div class="day-ev-body">
              <div class="day-ev-title">{{ evTitle(ev) }}</div>
              <div class="day-ev-meta">{{ evTypeLabel(ev.type) }} · {{ evExtraText(ev) }}</div>
            </div>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="dayVisible = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 事件详情弹窗 -->
    <div v-if="eventVisible" class="modal-mask" @click.self="eventVisible = false">
      <div class="modal-box">
        <div class="modal-head">
          <h4>{{ evTitle(currentEvent) }}</h4>
          <button class="modal-close" @click="eventVisible = false">×</button>
        </div>
        <div class="modal-body">
          <div class="detail-item"><div class="detail-label">类型</div><div class="detail-value">{{ evTypeLabel(currentEvent.type) }}</div></div>
          <div class="detail-item"><div class="detail-label">日期</div><div class="detail-value">{{ currentEvent.date }}</div></div>
          <div v-if="currentEvent.extra && currentEvent.extra.time" class="detail-item">
            <div class="detail-label">时间</div><div class="detail-value">{{ currentEvent.extra.time }}</div>
          </div>
          <div v-if="currentEvent.extra && currentEvent.extra.location" class="detail-item">
            <div class="detail-label">地点</div><div class="detail-value">{{ currentEvent.extra.location }}</div>
          </div>
          <div v-if="currentEvent.extra && currentEvent.extra.description" class="detail-item">
            <div class="detail-label">说明</div><div class="detail-value">{{ currentEvent.extra.description }}</div>
          </div>
          <div v-if="currentEvent.extra && currentEvent.extra.summary" class="detail-item">
            <div class="detail-label">纪要</div><div class="detail-value">{{ currentEvent.extra.summary }}</div>
          </div>
        </div>
        <div class="modal-foot">
          <button v-if="gotoPath(currentEvent)" class="btn btn-primary" @click="gotoEvent">去查看</button>
          <button class="btn" @click="eventVisible = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { workbench, collab } from '../../api'
import { SCHEDULE_TYPE_OPTIONS } from '../../config/fieldOptions'
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'

const router = useRouter()

// 视图切换
const view = ref('calendar')

// 日历状态
const calDate = ref(new Date())
const calYear = computed(() => calDate.value.getFullYear())
const calMonth = computed(() => calDate.value.getMonth())
const events = ref([]) // 聚合事件 [{ date, title, type, bizType, bizId, extra }]

// 列表状态
const list = ref([])
const loading = ref(false)

// 表单
const formVisible = ref(false)
const formMode = ref('create')
const form = ref({})
const formError = ref('')
const saving = ref(false)
const editingId = ref(null)

// 弹窗
const dayVisible = ref(false)
const dayTitle = ref('')
const dayEvents = ref([])
const eventVisible = ref(false)
const currentEvent = ref({})

const weekHeaders = ['一', '二', '三', '四', '五', '六', '日']

const legends = [
  { key: 'meeting', label: '组会', color: '#0d80e0' },
  { key: 'milestone', label: '毕业里程碑', color: '#ea4335' },
  { key: 'schedule', label: '日程', color: '#19a558' },
  { key: 'task', label: '任务截止', color: '#fa8c16' }
]

const TYPE_META = {
  meeting: { label: '组会', color: '#0d80e0' },
  milestone: { label: '毕业里程碑', color: '#ea4335' },
  schedule: { label: '日程', color: '#19a558' },
  task: { label: '任务截止', color: '#fa8c16' }
}

// 里程碑类型 → 中文
const MILESTONE_LABEL = {
  opening: '开题', midterm: '中期', pre_defense: '预答辩',
  blind_review: '盲审', defense: '答辩'
}

function fmtDateTime(v) {
  if (!v) return '-'
  return String(v).slice(0, 16)
}
function typeLabel(v) {
  const o = SCHEDULE_TYPE_OPTIONS.find((x) => x.value === v)
  return o ? o.label : (v || '-')
}
function evTypeLabel(type) {
  return (TYPE_META[type] || { label: type || '事件' }).label
}
function evColor(type) {
  return (TYPE_META[type] || { color: '#8a9099' }).color
}
function evTitle(ev) {
  if (ev.type === 'milestone') {
    const t = MILESTONE_LABEL[ev.extra && ev.extra.type] || ev.title || '里程碑'
    return `【${t}】`
  }
  return ev.title || '事件'
}
function evExtraText(ev) {
  if (!ev.extra) return ''
  if (ev.extra.time) return ev.extra.time
  if (ev.extra.location) return ev.extra.location
  if (ev.extra.remark) return ev.extra.remark
  return ''
}
function gotoPath(ev) {
  if (ev.bizType === 'meeting') return '/collaboration/meeting'
  if (ev.bizType === 'task') return '/collaboration/task'
  if (ev.bizType === 'milestone') return '/research/graduation'
  return null
}
function gotoEvent() {
  const p = gotoPath(currentEvent.value)
  if (p) router.push(p)
  eventVisible.value = false
}

// ===== 日历格子 =====
function monthStartStr() {
  return `${calYear.value}-${String(calMonth.value + 1).padStart(2, '0')}-01`
}
function monthEndStr() {
  const last = new Date(calYear.value, calMonth.value + 1, 0)
  return `${calYear.value}-${String(calMonth.value + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
}
function dateKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const cells = computed(() => {
  const y = calYear.value
  const m = calMonth.value
  const first = new Date(y, m, 1)
  // 周一开头：周日(0) → 6
  const lead = (first.getDay() + 6) % 7
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const prevDays = new Date(y, m, 0).getDate()
  const today = new Date()
  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate())
  const evMap = {}
  for (const ev of events.value) {
    if (!evMap[ev.date]) evMap[ev.date] = []
    evMap[ev.date].push(ev)
  }
  const out = []
  for (let i = 0; i < lead; i++) {
    const d = prevDays - lead + 1 + i
    const key = dateKey(y, m - 1, d)
    out.push({ day: d, outside: true, today: false, events: evMap[key] || [] })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const key = dateKey(y, m, d)
    out.push({ day: d, outside: false, today: key === todayKey, events: evMap[key] || [] })
  }
  // 补尾到下个周期（保持 7 的倍数）
  while (out.length % 7 !== 0) {
    const idx = out.length
    const d = idx - lead - daysInMonth + 1
    const key = dateKey(y, m + 1, d)
    out.push({ day: d, outside: true, today: false, events: evMap[key] || [] })
  }
  return out
})

function shiftMonth(delta) {
  calDate.value = new Date(calYear.value, calMonth.value + delta, 1)
  loadEvents()
}
function goToday() {
  calDate.value = new Date()
  loadEvents()
}
async function loadEvents() {
  try {
    const res = await collab.calendarEvents(monthStartStr(), monthEndStr())
    events.value = res && res.success ? res.list || [] : []
  } catch (e) {
    console.error('[calendar.loadEvents] 异常:', e)
    events.value = []
  }
}

function openEvent(ev) {
  currentEvent.value = ev
  dayVisible.value = false
  eventVisible.value = true
}
function openDay(cell) {
  dayEvents.value = cell.events
  dayTitle.value = `${calYear.value}年${calMonth.value + 1}月${cell.day}日`
  dayVisible.value = true
}

// ===== 列表 CRUD =====
async function load() {
  loading.value = true
  try {
    const res = await workbench.schedule.list({})
    list.value = res && res.success ? res.list || [] : []
  } catch (e) {
    list.value = []
  } finally {
    loading.value = false
  }
}

function openCreate() {
  formMode.value = 'create'
  editingId.value = null
  formError.value = ''
  form.value = { type: 'other' }
  formVisible.value = true
}
function openEdit(row) {
  formMode.value = 'edit'
  editingId.value = row.id
  formError.value = ''
  form.value = {
    title: row.title || '',
    type: row.type || 'other',
    start_time: row.start_time ? String(row.start_time).slice(0, 16).replace(' ', 'T') : '',
    end_time: row.end_time ? String(row.end_time).slice(0, 16).replace(' ', 'T') : '',
    location: row.location || '',
    description: row.description || ''
  }
  formVisible.value = true
}
function closeForm() {
  if (saving.value) return
  formVisible.value = false
}
function clean(v) {
  return typeof v === 'string' && v.trim() === '' ? null : v
}
async function submit() {
  formError.value = ''
  if (!form.value.title || !String(form.value.title).trim()) {
    formError.value = '请填写日程标题'
    return
  }
  saving.value = true
  try {
    const payload = {
      title: String(form.value.title).trim(),
      type: form.value.type || 'other',
      start_time: form.value.start_time ? String(form.value.start_time).replace('T', ' ') + ':00' : null,
      end_time: form.value.end_time ? String(form.value.end_time).replace('T', ' ') + ':00' : null,
      location: clean(form.value.location),
      description: clean(form.value.description)
    }
    const res = formMode.value === 'create'
      ? await workbench.schedule.create(payload)
      : await workbench.schedule.update(editingId.value, payload)
    if (res && res.success) {
      formVisible.value = false
      await load()
      await loadEvents()
    } else {
      formError.value = (res && res.message) || '保存失败'
    }
  } catch (e) {
    formError.value = '保存过程出现异常，请重试'
  } finally {
    saving.value = false
  }
}
async function confirmRemove(row) {
  const ok = await dialogConfirm(`确定删除日程「${row.title}」吗？`, '删除日程')
  if (!ok) return
  try {
    const res = await workbench.schedule.remove(row.id)
    if (res && res.success) {
      await load()
      await loadEvents()
    } else {
      await dialogAlert((res && res.message) || '删除失败')
    }
  } catch (e) {
    await dialogAlert('删除过程出现异常，请重试')
  }
}

onMounted(() => {
  loadEvents()
  load()
})
</script>

<style scoped>
.schedule-page {
  background: #fff;
  border: 1px solid #eceff3;
  border-radius: 12px;
  padding: 16px 18px;
}
.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.page-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2329;
}
.head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.view-tabs {
  display: flex;
  gap: 4px;
  background: #f2f3f5;
  border-radius: 8px;
  padding: 3px;
}
.tab-btn {
  border: none;
  background: transparent;
  padding: 5px 14px;
  font-size: 13px;
  border-radius: 6px;
  color: #4e5969;
  cursor: pointer;
}
.tab-btn.active {
  background: #fff;
  color: #0d80e0;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
.btn {
  height: 34px;
  padding: 0 14px;
  font-size: 13px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  background: #fff;
  color: #4e5969;
  cursor: pointer;
}
.btn:hover {
  border-color: #0d80e0;
  color: #0d80e0;
}
.btn-primary {
  border: none;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  color: #fff;
  font-weight: 600;
}
.btn-primary:hover {
  opacity: 0.92;
}
.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 日历 */
.calendar-wrap {
  border: 1px solid #eceff3;
  border-radius: 10px;
}
.cal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid #eceff3;
  flex-wrap: wrap;
  gap: 8px;
}
.cal-nav {
  display: flex;
  align-items: center;
  gap: 6px;
}
.nav-btn {
  min-width: 34px;
  padding: 0 10px;
}
.cal-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2329;
  margin: 0 6px;
}
.cal-legend {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #4e5969;
}
.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}
.cal-cell {
  min-height: 84px;
  border-right: 1px solid #f0f2f5;
  border-bottom: 1px solid #f0f2f5;
  padding: 5px 6px;
  box-sizing: border-box;
  overflow: hidden;
}
.cal-cell:nth-child(7n) {
  border-right: none;
}
.cal-week {
  min-height: auto;
  background: #f7f8fa;
  color: #4e5969;
  font-size: 12px;
  font-weight: 600;
  text-align: center;
  padding: 7px 0;
}
.cal-date {
  font-size: 12px;
  color: #4e5969;
  margin-bottom: 3px;
}
.cal-cell.today .cal-date {
  color: #fff;
  background: #0d80e0;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  line-height: 20px;
  text-align: center;
  font-weight: 600;
}
.cal-cell.other-month {
  background: #fbfcfd;
}
.cal-cell.other-month .cal-date {
  color: #c3c9d1;
}
.cal-event {
  font-size: 11px;
  line-height: 1.4;
  border-left: 3px solid;
  background: #f7f9fc;
  border-radius: 3px;
  padding: 1px 4px;
  margin-bottom: 2px;
  cursor: pointer;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: #1f2329;
}
.cal-event:hover {
  background: #edf3ff;
}
.ev-text {
  overflow: hidden;
  text-overflow: ellipsis;
}
.cal-more {
  font-size: 11px;
  color: #0d80e0;
  cursor: pointer;
  padding: 1px 4px;
}

/* 列表 */
.table-wrap {
  overflow-x: auto;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.data-table th,
.data-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid #eceff3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 240px;
}
.data-table th {
  background: #f5f7fa;
  color: #4e5969;
  font-weight: 600;
}
.data-table td {
  color: #1f2329;
}
.state-row td {
  text-align: center;
  color: #8a9099;
  padding: 32px 0;
}
.col-ops {
  width: 120px;
}
.btn-link {
  border: none;
  background: none;
  color: #0d80e0;
  font-size: 13px;
  cursor: pointer;
  padding: 0 6px;
}
.btn-link.danger {
  color: #ea4335;
}
.btn-link:hover {
  opacity: 0.8;
}

.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-box {
  width: 560px;
  max-width: 92vw;
  max-height: 85vh;
  background: #fff;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #eceff3;
}
.modal-head h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.modal-close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: #f2f3f5;
  color: #4e5969;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}
.modal-body {
  padding: 16px 20px;
  overflow-y: auto;
}
.form-row {
  display: flex;
  gap: 12px;
}
.form-row .form-item {
  flex: 1;
}
.form-item {
  margin-bottom: 12px;
}
.form-label {
  display: block;
  font-size: 13px;
  color: #4e5969;
  margin-bottom: 6px;
}
.req {
  color: #ea4335;
}
.form-input {
  width: 100%;
  min-height: 36px;
  padding: 0 10px;
  font-size: 13px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  outline: none;
  box-sizing: border-box;
}
.form-input:focus {
  border-color: #0d80e0;
}
.form-textarea {
  padding: 8px 10px;
  resize: vertical;
}
.form-error {
  margin: 8px 0 0;
  font-size: 13px;
  color: #ea4335;
}
.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid #eceff3;
}
.detail-item {
  margin-bottom: 12px;
}
.detail-label {
  font-size: 12px;
  color: #8a9099;
  margin-bottom: 4px;
}
.detail-value {
  font-size: 14px;
  color: #1f2329;
  white-space: pre-wrap;
  word-break: break-all;
}
.day-event {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid #eceff3;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
}
.day-event:hover {
  background: #f9fafb;
}
.ev-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 5px;
  flex-shrink: 0;
}
.day-ev-body {
  min-width: 0;
}
.day-ev-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}
.day-ev-meta {
  font-size: 12px;
  color: #8a9099;
  margin-top: 2px;
}
.empty-tip {
  text-align: center;
  color: #8a9099;
  font-size: 13px;
  padding: 24px 0;
}
</style>
