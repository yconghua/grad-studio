<template>
  <div class="meeting-page">
    <div class="header-card">
      <div class="header-left">
        <h2 class="page-title">📅 组会管理</h2>
      </div>
      <div class="header-right">
        <button v-if="isGroupAdmin" class="btn btn-primary" @click="openMeetingModal()">＋ 新增组会</button>
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
              <th>主题</th>
              <th>类型</th>
              <th>时间</th>
              <th>地点</th>
              <th>主持人</th>
              <th>状态</th>
              <th v-if="isGroupAdmin">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in meetings" :key="m.id">
              <td class="cell-title">{{ m.title }}</td>
              <td>{{ typeText(m.meeting_type) }}</td>
              <td class="cell-time">{{ fmtDT(m.start_time) }} ~ {{ fmtDT(m.end_time) }}</td>
              <td>{{ m.location || '—' }}</td>
              <td>{{ nameOf(m.host_id) }}</td>
              <td><span :class="['status-tag', 'st-' + m.status]">{{ statusText(m.status) }}</span></td>
              <td v-if="isGroupAdmin">
                <button class="btn btn-mini" @click="openMeetingModal(m)">编辑</button>
                <button class="btn btn-mini btn-danger" @click="onRemoveMeeting(m)">删除</button>
              </td>
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
              <th>组会主题</th>
              <th>汇报学生</th>
              <th>汇报主题</th>
              <th>内容</th>
              <th>状态</th>
              <th>审阅意见</th>
              <th>提交时间</th>
              <th v-if="isManager">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in reports" :key="r.id">
              <td class="cell-title">{{ meetingTitleOf(r.meeting_id) }}</td>
              <td>{{ nameOf(r.student_id) }}</td>
              <td>{{ r.topic || '—' }}</td>
              <td class="cell-desc">{{ r.content || '—' }}</td>
              <td><span :class="['status-tag', 'st-' + r.status]">{{ reportStatusText(r.status) }}</span></td>
              <td class="cell-desc">{{ r.review_comment || '—' }}</td>
              <td class="cell-time">{{ fmtDT(r.created_at) }}</td>
              <td v-if="isManager">
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

    <!-- 组会新增/编辑弹窗 -->
    <div v-if="meetingModal.visible" class="modal-mask" @click.self="meetingModal.visible = false">
      <div class="modal-box">
        <h3 class="modal-title">{{ meetingModal.form.id ? '编辑组会' : '新增组会' }}</h3>
        <div class="form-grid">
          <label class="form-item full">
            <span class="form-label">主题 *</span>
            <input v-model="meetingModal.form.title" type="text" placeholder="组会主题" />
          </label>
          <label class="form-item">
            <span class="form-label">类型</span>
            <select v-model="meetingModal.form.meeting_type">
              <option value="regular">常规组会</option>
              <option value="seminar">专题研讨</option>
              <option value="thesis">开题答辩</option>
              <option value="other">其他</option>
            </select>
          </label>
          <label class="form-item">
            <span class="form-label">状态</span>
            <select v-model="meetingModal.form.status">
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
              <option value="finished">已结束</option>
              <option value="cancelled">已取消</option>
            </select>
          </label>
          <label class="form-item">
            <span class="form-label">开始时间</span>
            <input v-model="meetingModal.form.start_time" type="datetime-local" />
          </label>
          <label class="form-item">
            <span class="form-label">结束时间</span>
            <input v-model="meetingModal.form.end_time" type="datetime-local" />
          </label>
          <label class="form-item full">
            <span class="form-label">地点</span>
            <input v-model="meetingModal.form.location" type="text" placeholder="线下地址或线上会议链接" />
          </label>
          <label class="form-item full">
            <span class="form-label">主持人</span>
            <select v-model="meetingModal.form.host_id">
              <option :value="0">未指定</option>
              <option v-for="m in hostOptions" :key="m.id" :value="m.id">{{ memberLabel(m) }}</option>
            </select>
          </label>
          <label class="form-item full">
            <span class="form-label">议程 / 议题</span>
            <textarea v-model="meetingModal.form.agenda" rows="3" placeholder="议程说明"></textarea>
          </label>
        </div>
        <p v-if="meetingModal.error" class="form-error">{{ meetingModal.error }}</p>
        <div class="modal-actions">
          <button class="btn" @click="meetingModal.visible = false">取消</button>
          <button class="btn btn-primary" :disabled="meetingModal.saving" @click="onSaveMeeting">
            {{ meetingModal.saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 学生提交汇报弹窗 -->
    <div v-if="reportModal.visible" class="modal-mask" @click.self="reportModal.visible = false">
      <div class="modal-box">
        <h3 class="modal-title">提交组会汇报</h3>
        <div class="form-grid">
          <label class="form-item full">
            <span class="form-label">选择组会 *</span>
            <select v-model="reportModal.form.meeting_id">
              <option :value="0" disabled>请选择组会</option>
              <option v-for="m in meetings" :key="m.id" :value="m.id">{{ m.title }}（{{ fmtDT(m.start_time) }}）</option>
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
  </div>
</template>

<script setup>
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'
import { ref, computed, watch, onMounted } from 'vue'
import { useGroupContext } from '../../composables/useGroupContext'
import { useRole } from '../../composables/useRole'
import {
  listMeetings, createMeeting, updateMeeting, removeMeeting,
  listMeetingReports, submitMeetingReport, reviewMeetingReport,
  listMembers
} from '../../api'

const { currentGroupId, loadGroups } = useGroupContext()
const { isGroupAdmin, isManager, isStudent } = useRole()

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
// 主持人候选：仅当前课题组的导师 / 学生（课题组管理员不可作为主持人）
const hostOptions = computed(() => members.value.filter((m) => m.role !== 'group_admin'))
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

// ===== 组会弹窗 =====
const emptyMeetingForm = () => ({
  id: null, title: '', meeting_type: 'regular', location: '',
  start_time: '', end_time: '', host_id: 0, agenda: '', status: 'draft'
})
const meetingModal = ref({ visible: false, saving: false, error: '', form: emptyMeetingForm() })

function toLocal(v) { return v ? String(v).replace(' ', 'T').slice(0, 16) : '' }
function fromLocal(v) { return v ? v.replace('T', ' ') + (v.length === 16 ? ':00' : '') : '' }

function openMeetingModal(row) {
  if (row) {
    meetingModal.value.form = {
      id: row.id, title: row.title, meeting_type: row.meeting_type || 'regular',
      location: row.location || '', start_time: toLocal(row.start_time), end_time: toLocal(row.end_time),
      host_id: row.host_id || 0, agenda: row.agenda || '', status: row.status || 'draft'
    }
  } else {
    meetingModal.value.form = emptyMeetingForm()
  }
  meetingModal.value.error = ''
  meetingModal.value.visible = true
}

async function onSaveMeeting() {
  const f = meetingModal.value.form
  if (!f.title.trim()) { meetingModal.value.error = '组会主题不能为空'; return }
  meetingModal.value.saving = true
  meetingModal.value.error = ''
  const payload = {
    group_id: currentGroupId.value,
    title: f.title.trim(), meeting_type: f.meeting_type, location: f.location,
    start_time: fromLocal(f.start_time), end_time: fromLocal(f.end_time),
    host_id: Number(f.host_id) || 0, agenda: f.agenda, status: f.status
  }
  try {
    const res = f.id ? await updateMeeting({ id: f.id, ...payload }) : await createMeeting(payload)
    if (res && res.success) {
      meetingModal.value.visible = false
      loadMeetings()
    } else {
      meetingModal.value.error = (res && res.message) || '保存失败'
    }
  } catch (e) {
    meetingModal.value.error = '保存失败，请稍后重试'
  } finally {
    meetingModal.value.saving = false
  }
}

async function onRemoveMeeting(row) {
  if (!await dialogConfirm(`确认删除组会「${row.title}」？`)) return
  const res = await removeMeeting(row.id)
  if (res && res.success) loadMeetings()
  else dialogAlert((res && res.message) || '删除失败')
}

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

onMounted(() => {
  loadGroups()
  loadMembers()
  loadMeetings()
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
.header-left { display: flex; align-items: center; gap: 16px; }
.page-title { margin: 0; font-size: 18px; color: #1f2329; }
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
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th {
  background: #f7f9fc; text-align: left; padding: 10px 12px; color: #4e5969;
  font-weight: 600; border-bottom: 1px solid #eceff3; white-space: nowrap;
}
.data-table td { padding: 10px 12px; border-bottom: 1px solid #eceff3; color: #1f2329; }
.data-table tbody tr:nth-child(even) { background: #fafbfc; }
.data-table tbody tr:hover { background: #eef6ff; }
.cell-title { font-weight: 600; }
.cell-time { color: #8a9099; white-space: nowrap; }
.cell-desc { max-width: 240px; color: #4e5969; }

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
</style>
