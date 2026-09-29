<template>
  <div class="meeting-page">
    <div class="header-card">
      <div class="header-left">
        <h2 class="page-title">📅 组会管理</h2>
        <p class="page-desc">组会列表查看，学生提交汇报、导师审阅。</p>
      </div>
      <div class="header-right">
        <button v-if="isStudent" class="btn btn-primary" @click="openReportModal()">📝 提交组会汇报</button>
      </div>
    </div>

    <div v-if="!currentGroupId" class="empty-tip">请先在页头选择或输入课题组ID</div>
    <template v-else>
      <div class="tab-bar">
        <button :class="['tab-btn', { active: tab === 'meetings' }]" @click="tab = 'meetings'">组会列表</button>
        <button :class="['tab-btn', { active: tab === 'reports' }]" @click="switchTab('reports')">组会汇报</button>
      </div>

      <!-- 组会列表 -->
      <div v-show="tab === 'meetings'" class="card">
        <p v-if="loading" class="empty-tip">加载中…</p>
        <p v-else-if="!meetings.length" class="empty-tip">暂无组会记录</p>
        <table v-else class="data-table">
          <thead>
            <tr>
              <th style="width:20%">主题</th>
              <th style="width:9%">类型</th>
              <th style="width:24%">时间</th>
              <th style="width:12%">地点</th>
              <th style="width:13%">主持人</th>
              <th style="width:9%">状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in meetings" :key="m.id" @click="openMeetingDetail(m)" style="cursor:pointer">
              <td class="cell-title">{{ m.title }}</td>
              <td>{{ typeText(m.meeting_type) }}</td>
              <td class="cell-time">{{ fmtDT(m.start_time) }} ~ {{ fmtDT(m.end_time) }}</td>
              <td>{{ m.location || '—' }}</td>
              <td class="cell-name">{{ nameOf(m.host_id) }}</td>
              <td><span :class="['status-tag', 'st-' + m.status]">{{ statusText(m.status) }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 组会汇报 -->
      <div v-show="tab === 'reports'" class="card">
        <p v-if="loadingReports" class="empty-tip">加载中…</p>
        <p v-else-if="!reports.length" class="empty-tip">暂无组会汇报</p>
        <table v-else class="data-table">
          <thead>
            <tr>
              <th style="width:15%">组会主题</th>
              <th style="width:11%">汇报学生</th>
              <th style="width:13%">汇报主题</th>
              <th style="width:17%">内容</th>
              <th style="width:8%">状态</th>
              <th style="width:13%">审阅意见</th>
              <th style="width:9%">提交时间</th>
              <th v-if="isManager" style="width:14%">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in reports" :key="r.id" @click="openReportDetail(r)" style="cursor:pointer">
              <td class="cell-title">{{ meetingTitleOf(r.meeting_id) }}</td>
              <td class="cell-name">{{ nameOf(r.student_id) }}</td>
              <td class="cell-topic">{{ r.topic || '—' }}</td>
              <td class="cell-desc">{{ r.content || '—' }}</td>
              <td><span :class="['status-tag', 'st-' + r.status]">{{ reportStatusText(r.status) }}</span></td>
              <td class="cell-desc">{{ r.review_comment || '—' }}</td>
              <td class="cell-time">{{ fmtDT(r.created_at) }}</td>
              <td v-if="isManager" @click.stop>
                <template v-if="r.status === 'pending'">
                  <button class="btn btn-mini btn-primary" @click="openReviewModal(r, 'approved')">通过</button>
                  <button class="btn btn-mini btn-danger" @click="openReviewModal(r, 'rejected')">驳回</button>
                </template>
                <span v-else class="cell-time">已审阅</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- 学生提交汇报弹窗 -->
    <div v-if="reportModal.visible" class="modal-mask" @click.self="reportModal.visible = false">
      <div class="modal-box">
        <h3 class="modal-title">提交组会汇报</h3>
        <div class="form-grid">
          <label class="form-item full">
            <span class="form-label">选择组会 *</span>
            <select v-model="reportModal.form.meeting_id">
              <option :value="0" disabled>请选择组会</option>
              <option v-for="m in publishableMeetings" :key="m.id" :value="m.id">{{ m.title }}（{{ fmtDT(m.start_time) }}）</option>
            </select>
          </label>
          <label class="form-item full">
            <span class="form-label">汇报主题</span>
            <input v-model="reportModal.form.topic" type="text" placeholder="汇报主题" />
          </label>
          <label class="form-item full">
            <span class="form-label">汇报内容</span>
            <textarea v-model="reportModal.form.content" rows="5" placeholder="汇报内容"></textarea>
          </label>
          <label class="form-item full">
            <span class="form-label">附件路径</span>
            <input v-model="reportModal.form.file_path" type="text" placeholder="PPT / 文档路径（可空）" />
          </label>
        </div>
        <p v-if="reportModal.error" class="form-error">{{ reportModal.error }}</p>
        <div class="modal-actions">
          <button class="btn" @click="reportModal.visible = false">取消</button>
          <button class="btn btn-primary" :disabled="reportModal.saving" @click="onSubmitReport">
            {{ reportModal.saving ? '提交中…' : '提交' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 审阅弹窗 -->
    <div v-if="reviewModal.visible" class="modal-mask" @click.self="reviewModal.visible = false">
      <div class="modal-box">
        <h3 class="modal-title">{{ reviewModal.form.status === 'approved' ? '通过汇报' : '驳回汇报' }}</h3>
        <div class="form-grid">
          <label class="form-item full">
            <span class="form-label">审阅意见</span>
            <textarea v-model="reviewModal.form.review_comment" rows="3" placeholder="审阅意见（可空）"></textarea>
          </label>
        </div>
        <p v-if="reviewModal.error" class="form-error">{{ reviewModal.error }}</p>
        <div class="modal-actions">
          <button class="btn" @click="reviewModal.visible = false">取消</button>
          <button class="btn btn-primary" :disabled="reviewModal.saving" @click="onReview">
            {{ reviewModal.saving ? '提交中…' : '确认' }}
          </button>
        </div>
      </div>
    </div>
    <!-- 组会详情弹窗（只读） -->
    <div v-if="meetingDetail.visible" class="modal-mask" @click.self="meetingDetail.visible = false">
      <div class="modal-box">
        <h3 class="modal-title">组会详情</h3>
        <div v-if="meetingDetail.row" class="detail-grid">
          <div class="detail-item full"><span class="detail-label">主题</span><span class="detail-value">{{ meetingDetail.row.title }}</span></div>
          <div class="detail-item"><span class="detail-label">类型</span><span class="detail-value">{{ typeText(meetingDetail.row.meeting_type) }}</span></div>
          <div class="detail-item"><span class="detail-label">状态</span><span class="detail-value"><span :class="['status-tag', 'st-' + meetingDetail.row.status]">{{ statusText(meetingDetail.row.status) }}</span></span></div>
          <div class="detail-item"><span class="detail-label">开始时间</span><span class="detail-value">{{ fmtDT(meetingDetail.row.start_time) }}</span></div>
          <div class="detail-item"><span class="detail-label">结束时间</span><span class="detail-value">{{ fmtDT(meetingDetail.row.end_time) }}</span></div>
          <div class="detail-item full"><span class="detail-label">地点</span><span class="detail-value">{{ meetingDetail.row.location || '—' }}</span></div>
          <div class="detail-item full"><span class="detail-label">主持人</span><span class="detail-value">{{ nameOf(meetingDetail.row.host_id) }}</span></div>
          <div class="detail-item full"><span class="detail-label">议程 / 议题</span><span class="detail-value detail-text">{{ meetingDetail.row.agenda || '—' }}</span></div>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="meetingDetail.visible = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 组会汇报详情弹窗（只读） -->
    <div v-if="reportDetail.visible" class="modal-mask" @click.self="reportDetail.visible = false">
      <div class="modal-box">
        <h3 class="modal-title">组会汇报详情</h3>
        <div v-if="reportDetail.row" class="detail-grid">
          <div class="detail-item full"><span class="detail-label">所属组会</span><span class="detail-value">{{ meetingTitleOf(reportDetail.row.meeting_id) }}</span></div>
          <div class="detail-item"><span class="detail-label">汇报学生</span><span class="detail-value">{{ nameOf(reportDetail.row.student_id) }}</span></div>
          <div class="detail-item"><span class="detail-label">状态</span><span class="detail-value"><span :class="['status-tag', 'st-' + reportDetail.row.status]">{{ reportStatusText(reportDetail.row.status) }}</span></span></div>
          <div class="detail-item full"><span class="detail-label">汇报主题</span><span class="detail-value">{{ reportDetail.row.topic || '—' }}</span></div>
          <div class="detail-item full"><span class="detail-label">汇报内容</span><span class="detail-value detail-text">{{ reportDetail.row.content || '—' }}</span></div>
          <div class="detail-item full"><span class="detail-label">附件路径</span><span class="detail-value detail-text">{{ reportDetail.row.file_path || '—' }}</span></div>
          <div class="detail-item full"><span class="detail-label">审阅意见</span><span class="detail-value detail-text">{{ reportDetail.row.review_comment || '—' }}</span></div>
          <div class="detail-item"><span class="detail-label">提交时间</span><span class="detail-value">{{ fmtDT(reportDetail.row.created_at) }}</span></div>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="reportDetail.visible = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { dialogAlert } from '../../composables/useDialog'
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useGroupContext } from '../../composables/useGroupContext'
import { useRole } from '../../composables/useRole'
import {
  listMeetings,
  listMeetingReports, submitMeetingReport, reviewMeetingReport,
  listMembers
} from '../../api'

const { currentGroupId, loadGroups } = useGroupContext()
const { isManager, isStudent } = useRole()
const route = useRoute()

const tab = ref('meetings')
const meetings = ref([])
const reports = ref([])
const loading = ref(false)
const loadingReports = ref(false)
const members = ref([])

const TYPE_TEXT = { regular: '常规组会', seminar: '专题研讨', thesis: '开题答辩', other: '其他' }
const STATUS_TEXT = { draft: '草稿', published: '已发布', finished: '已结束', cancelled: '已取消' }
const REPORT_STATUS_TEXT = { pending: '待审阅', approved: '已通过', rejected: '已打回' }

function fmtDT(v) {
  if (!v) return '—'
  return String(v).replace('T', ' ').slice(0, 16)
}
function typeText(t) { return TYPE_TEXT[t] || t || '—' }
function statusText(s) { return STATUS_TEXT[s] || s || '—' }
function reportStatusText(s) { return REPORT_STATUS_TEXT[s] || s || '—' }
// 显示名：有真实姓名显示「姓名（账号）」，无姓名显示账号
function memberLabel(m) {
  return m.real_name ? m.real_name + '（' + m.username + '）' : m.username
}
function nameOf(id) {
  const m = members.value.find((x) => x.id === Number(id))
  return m ? memberLabel(m) : (id ? ('#' + id) : '—')
}
function meetingTitleOf(id) {
  const m = meetings.value.find((x) => x.id === Number(id))
  return m ? m.title : ('#' + id)
}

async function loadMembers() {
  try {
    const res = await listMembers({ group_id: currentGroupId.value })
    if (res && res.success) members.value = res.members || []
  } catch (e) { /* 忽略 */ }
}

async function loadMeetings() {
  if (!currentGroupId.value) { meetings.value = []; return }
  loading.value = true
  try {
    const res = await listMeetings(currentGroupId.value)
    if (res && res.success) {
      meetings.value = res.data || []
    } else {
      meetings.value = []
      if (res && res.message) dialogAlert(res.message)
    }
  } finally { loading.value = false }
}

async function loadReports() {
  if (!currentGroupId.value) { reports.value = []; return }
  loadingReports.value = true
  try {
    const res = await listMeetingReports({ group_id: currentGroupId.value })
    if (res && res.success) {
      reports.value = res.data || []
    } else {
      reports.value = []
      if (res && res.message) dialogAlert(res.message)
    }
  } finally { loadingReports.value = false }
}

function switchTab(t) {
  tab.value = t
  if (t === 'reports') loadReports()
}

// 学生提交汇报时，可选组会仅限「已发布」状态（草稿 / 已取消不可提交）
const publishableMeetings = computed(() => meetings.value.filter((m) => m.status === 'published'))

// ===== 提交汇报弹窗 =====
const reportModal = ref({ visible: false, saving: false, error: '', form: { meeting_id: 0, topic: '', content: '', file_path: '' } })
function openReportModal() {
  reportModal.value.form = { meeting_id: 0, topic: '', content: '', file_path: '' }
  reportModal.value.error = ''
  reportModal.value.visible = true
}
async function onSubmitReport() {
  const f = reportModal.value.form
  if (!f.meeting_id) { reportModal.value.error = '请选择组会'; return }
  reportModal.value.saving = true
  reportModal.value.error = ''
  try {
    const res = await submitMeetingReport({
      meeting_id: Number(f.meeting_id), topic: f.topic, content: f.content, file_path: f.file_path
    })
    if (res && res.success) {
      reportModal.value.visible = false
      tab.value = 'reports'
      loadReports()
    } else {
      reportModal.value.error = (res && res.message) || '提交失败'
    }
  } catch (e) {
    reportModal.value.error = '提交失败，请稍后重试'
  } finally {
    reportModal.value.saving = false
  }
}

// ===== 审阅弹窗 =====
const reviewModal = ref({ visible: false, saving: false, error: '', form: { id: null, status: 'approved', review_comment: '' } })
function openReviewModal(row, status) {
  reviewModal.value.form = { id: row.id, status, review_comment: '' }
  reviewModal.value.error = ''
  reviewModal.value.visible = true
}
async function onReview() {
  const f = reviewModal.value.form
  reviewModal.value.saving = true
  reviewModal.value.error = ''
  try {
    const res = await reviewMeetingReport({ id: f.id, status: f.status, review_comment: f.review_comment })
    if (res && res.success) {
      reviewModal.value.visible = false
      loadReports()
    } else {
      reviewModal.value.error = (res && res.message) || '操作失败'
    }
  } catch (e) {
    reviewModal.value.error = '操作失败，请稍后重试'
  } finally {
    reviewModal.value.saving = false
  }
}

// ===== 详情弹窗 =====
const meetingDetail = ref({ visible: false, row: null })
function openMeetingDetail(row) {
  meetingDetail.value.row = row
  meetingDetail.value.visible = true
}
const reportDetail = ref({ visible: false, row: null })
function openReportDetail(row) {
  reportDetail.value.row = row
  reportDetail.value.visible = true
}

onMounted(() => {
  loadGroups()
  loadMembers()
  loadMeetings()
  // 工作台「待审汇报」跳转：携带 tab=reports 直达组会汇报页签
  if (route.query.tab === 'reports') {
    tab.value = 'reports'
    loadReports()
  }
})
watch(currentGroupId, () => {
  loadMeetings()
  if (tab.value === 'reports') loadReports()
})
</script>

<style scoped>
.header-card {
  display: flex; align-items: center; justify-content: space-between;
  background: #fff; border-radius: 12px; padding: 16px 20px; margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(15, 35, 80, 0.05);
}
.header-left { display: flex; align-items: flex-end; gap: 14px; }
.page-title { margin: 0; font-size: 18px; color: #1f2329; }
.page-desc { margin: 0 0 3px; font-size: 13px; color: #8a9099; }
.header-right { display: flex; gap: 10px; }

.tab-bar { display: flex; gap: 8px; margin-bottom: 12px; }
.tab-btn {
  padding: 7px 18px; border: 1px solid #dfe3e8; border-radius: 8px; background: #fff;
  font-size: 13px; color: #4e5969; cursor: pointer;
}
.tab-btn.active {
  background: linear-gradient(135deg, #0d80e0, #19a558); color: #fff; border-color: transparent;
}

.card {
  background: #fff; border-radius: 12px; padding: 8px;
  box-shadow: 0 2px 8px rgba(15, 35, 80, 0.05); overflow-x: auto;
}
.data-table {
  width: 100%; border-collapse: collapse; font-size: 13px;
  table-layout: fixed; /* 固定布局：列宽按百分比分配，总宽=容器宽，不出现横向滚动条 */
}
.data-table th {
  background: #f7f9fc; text-align: left; padding: 10px 12px; color: #4e5969;
  font-weight: 600; border-bottom: 1px solid #eceff3; white-space: nowrap;
}
.data-table td {
  padding: 10px 12px; border-bottom: 1px solid #eceff3; color: #1f2329;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.data-table tbody tr:nth-child(even) { background: #fafbfc; }
.data-table tbody tr:hover { background: #eef6ff; }
.cell-title { font-weight: 600; }
.cell-time { color: #8a9099; white-space: nowrap; }
.cell-desc { color: #4e5969; }

.status-tag {
  display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px;
  background: #f0f2f5; color: #4e5969; white-space: nowrap;
}
.st-published, .st-approved, .st-ongoing { background: #e8f7ee; color: #19a558; }
.st-draft { background: #f0f2f5; color: #8a9099; }
.st-finished, .st-completed { background: #e8f0fb; color: #0d80e0; }
.st-cancelled, .st-rejected { background: #fdecea; color: #ea4335; }
.st-pending { background: #fff5e6; color: #e8890c; }

.empty-tip { text-align: center; color: #8a9099; font-size: 13px; padding: 36px 0; }

.btn {
  padding: 7px 14px; border-radius: 8px; border: 1px solid #dfe3e8; background: #fff;
  font-size: 13px; color: #1f2329; cursor: pointer;
}
.btn:hover { border-color: #0d80e0; color: #0d80e0; }
.btn-primary {
  background: linear-gradient(135deg, #0d80e0, #19a558); color: #fff; border: none;
}
.btn-primary:hover { opacity: 0.9; color: #fff; }
.btn-danger { color: #ea4335; border-color: #f5c6c2; }
.btn-danger:hover { border-color: #ea4335; color: #ea4335; }
.btn-mini { padding: 4px 10px; font-size: 12px; margin-right: 6px; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }

.modal-mask {
  position: fixed; inset: 0; background: rgba(20, 30, 50, 0.45);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal-box {
  background: #fff; border-radius: 12px; padding: 22px 24px; width: 560px; max-width: 92vw;
  max-height: 86vh; overflow-y: auto; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}
.modal-title { margin: 0 0 16px; font-size: 16px; color: #1f2329; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 14px; }
.form-item { display: flex; flex-direction: column; gap: 5px; }
.form-item.full { grid-column: 1 / -1; }
.form-label { font-size: 12px; color: #4e5969; }
.form-item input, .form-item select, .form-item textarea {
  border: 1px solid #dfe3e8; border-radius: 8px; padding: 8px 10px; font-size: 13px;
  outline: none; background: #fff; color: #1f2329; font-family: inherit;
}
.form-item input:focus, .form-item select:focus, .form-item textarea:focus { border-color: #0d80e0; }
.form-error { color: #ea4335; font-size: 12px; margin: 10px 0 0; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }

.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
.detail-item { display: flex; flex-direction: column; gap: 4px; }
.detail-item.full { grid-column: 1 / -1; }
.detail-label { font-size: 12px; color: #8a9099; }
.detail-value { font-size: 13px; color: #1f2329; }
.detail-value.detail-text { white-space: pre-wrap; line-height: 1.6; }
</style>
