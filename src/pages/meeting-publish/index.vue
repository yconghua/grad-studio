<template>
  <div class="meeting-page">
    <div class="header-card">
      <div class="header-left">
        <h2 class="page-title">📅 组会发布</h2>
        <p class="page-desc">发布组会通知、维护本课题组组会记录。</p>
      </div>
      <div class="header-right">
        <button class="btn btn-primary" @click="openMeetingModal()">＋ 新增组会</button>
      </div>
    </div>

    <div v-if="!currentGroupId" class="empty-tip">请先在页头选择或输入课题组ID</div>
    <div v-else class="card">
      <p v-if="loading" class="empty-tip">加载中…</p>
      <p v-else-if="!meetings.length" class="empty-tip">暂无组会记录，点击右上角「新增组会」发布。</p>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th style="width:18%">主题</th>
            <th style="width:8%">类型</th>
            <th style="width:22%">时间</th>
            <th style="width:10%">地点</th>
            <th style="width:13%">主持人</th>
            <th style="width:96px">状态</th>
            <th style="width:150px">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in meetings" :key="m.id" @click="openMeetingDetail(m)" style="cursor:pointer">
            <td class="cell-title">{{ m.title }}</td>
            <td>{{ typeText(m.meeting_type) }}</td>
            <td class="cell-time">{{ fmtDT(m.start_time) }} ~ {{ fmtDT(m.end_time) }}</td>
            <td>{{ m.location || '—' }}</td>
            <td class="cell-name">{{ nameOf(m.host_id) }}</td>
            <td class="cell-status"><span :class="['status-tag', 'st-' + m.status]">{{ statusText(m.status) }}</span></td>
            <td class="cell-actions" @click.stop>
              <button class="btn btn-mini" @click="openMeetingModal(m)">编辑</button>
              <button class="btn btn-mini btn-danger" @click="onRemoveMeeting(m)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

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
  </div>
</template>

<script setup>
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'
import { ref, computed, watch, onMounted } from 'vue'
import { useGroupContext } from '../../composables/useGroupContext'
import { listMeetings, createMeeting, updateMeeting, removeMeeting, listMembers } from '../../api'

const { currentGroupId, loadGroups } = useGroupContext()

const meetings = ref([])
const loading = ref(false)
const members = ref([])

const TYPE_TEXT = { regular: '常规组会', seminar: '专题研讨', thesis: '开题答辩', other: '其他' }
const STATUS_TEXT = { draft: '草稿', published: '已发布', finished: '已结束', cancelled: '已取消' }

function fmtDT(v) {
  if (!v) return '—'
  return String(v).replace('T', ' ').slice(0, 16)
}
function typeText(t) { return TYPE_TEXT[t] || t || '—' }
function statusText(s) { return STATUS_TEXT[s] || s || '—' }
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
      if (res.message) dialogAlert(res.message)
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

// ===== 详情弹窗 =====
const meetingDetail = ref({ visible: false, row: null })
function openMeetingDetail(row) {
  meetingDetail.value.row = row
  meetingDetail.value.visible = true
}

onMounted(() => {
  loadGroups()
  loadMembers()
  loadMeetings()
})
watch(currentGroupId, () => {
  loadMeetings()
  loadMembers()
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
/* 状态 / 操作两列保证完整显示：固定列宽足够容纳内容，不做省略号裁切 */
.cell-status, .cell-actions { white-space: nowrap; overflow: visible; text-overflow: clip; }

.status-tag {
  display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px;
  background: #f0f2f5; color: #4e5969; white-space: nowrap;
}
.st-published { background: #e8f7ee; color: #19a558; }
.st-draft { background: #f0f2f5; color: #8a9099; }
.st-finished { background: #e8f0fb; color: #0d80e0; }
.st-cancelled { background: #fdecea; color: #ea4335; }

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
