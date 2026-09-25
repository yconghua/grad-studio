<template>
  <div class="meeting-page">
    <!-- 头部：标题 + 搜索 + 新增 -->
    <div class="page-head">
      <h3 class="page-title">组会管理</h3>
      <div class="head-actions">
        <input v-model="keyword" class="search-input" placeholder="搜索会议主题" @keyup.enter="load" />
        <button class="btn" @click="load">查询</button>
        <button v-if="isManager" class="btn btn-primary" @click="openCreate">新增组会</button>
      </div>
    </div>

    <!-- 表格 -->
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>主题</th>
            <th>类型</th>
            <th>时间</th>
            <th>地点</th>
            <th>主持人</th>
            <th>状态</th>
            <th v-if="isManager" class="col-ops">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading" class="state-row"><td :colspan="isManager ? 7 : 6">加载中…</td></tr>
          <tr v-else-if="!list.length" class="state-row"><td :colspan="isManager ? 7 : 6">暂无组会</td></tr>
          <tr v-for="row in list" :key="row.id" class="data-row" @click="openDetail(row)">
            <td>{{ row.title }}</td>
            <td>{{ row.type || '-' }}</td>
            <td>{{ fmtDateTime(row.meeting_date) }}</td>
            <td>{{ row.location || '-' }}</td>
            <td>{{ memberName(row.host_id) }}</td>
            <td>
              <span class="tag" :class="statusClass(row.status)">{{ statusLabel(row.status) }}</span>
            </td>
            <td v-if="isManager" class="col-ops" @click.stop>
              <button class="btn-link" @click="openEdit(row)">编辑</button>
              <button class="btn-link" @click="openReadStatus(row)">已读情况</button>
              <button class="btn-link danger" @click="confirmRemove(row)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 新增 / 编辑弹窗 -->
    <div v-if="formVisible" class="modal-mask" @click.self="closeForm">
      <div class="modal-box">
        <div class="modal-head">
          <h4>{{ formMode === 'create' ? '新增组会' : '编辑组会' }}</h4>
          <button class="modal-close" @click="closeForm">×</button>
        </div>
        <div class="modal-body">
          <div class="form-item">
            <label class="form-label">会议主题<span class="req"> *</span></label>
            <input v-model="form.title" class="form-input" placeholder="必填" />
          </div>
          <div class="form-item">
            <label class="form-label">类型</label>
            <input v-model="form.type" class="form-input" placeholder="如 周会/学术研讨/专题" />
          </div>
          <div class="form-item">
            <label class="form-label">会议时间</label>
            <input v-model="form.meeting_date" type="datetime-local" class="form-input" />
          </div>
          <div class="form-row">
            <div class="form-item">
              <label class="form-label">地点</label>
              <input v-model="form.location" class="form-input" />
            </div>
            <div class="form-item">
              <label class="form-label">主持人</label>
              <select v-model="form.host_id" class="form-input">
                <option :value="null">请选择</option>
                <option v-for="m in members" :key="m.id" :value="m.id">{{ memberLabel(m) }}</option>
              </select>
            </div>
          </div>
          <div class="form-item">
            <label class="form-label">参会人</label>
            <!-- 点击打开成员选择器 -->
            <div class="attendee-picker" @click="openPicker">
              <span v-if="!selectedAttendees.length" class="picker-placeholder">点击选择参会人</span>
              <span v-for="m in selectedAttendees" :key="m.username" class="attendee-tag">
                {{ m.real_name || m.username }}
                <i class="tag-x" @click.stop="removeAttendee(m)">×</i>
              </span>
              <span class="picker-add">＋</span>
            </div>
          </div>
          <div class="form-item">
            <label class="form-label">状态</label>
            <select v-model="form.status" class="form-input">
              <option v-for="o in MEETING_STATUS_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>
          <div class="form-item">
            <label class="form-label">会议纪要</label>
            <textarea v-model="form.summary" class="form-input form-textarea" rows="4" placeholder="会议内容 / 结论（发布后学生可确认已读）"></textarea>
          </div>
          <p v-if="formError" class="form-error">{{ formError }}</p>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="closeForm">取消</button>
          <button class="btn btn-primary" @click="submit" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button>
        </div>
      </div>
    </div>

    <!-- 成员选择器弹窗 -->
    <div v-if="pickerVisible" class="modal-mask" @click.self="pickerVisible = false">
      <div class="modal-box picker-box">
        <div class="modal-head">
          <h4>选择参会人</h4>
          <button class="modal-close" @click="pickerVisible = false">×</button>
        </div>
        <div class="modal-body">
          <input v-model="pickerKeyword" class="form-input picker-search" placeholder="搜索姓名 / 账号" />
          <div class="picker-summary">已选 {{ pickerChecked.length }} 人</div>
          <div v-for="g in pickerGroups" :key="g.key" class="picker-group">
            <div class="group-title">{{ g.label }}（{{ g.items.length }}）</div>
            <div v-if="!g.items.length" class="group-empty">无匹配成员</div>
            <label v-for="m in g.items" :key="m.id" class="picker-row" :class="{ checked: isPicked(m.username) }" @click="togglePick(m)">
              <span class="picker-checkbox" :class="{ on: isPicked(m.username) }">
                <i v-if="isPicked(m.username)" class="check-mark">✓</i>
              </span>
              <span class="picker-name">{{ m.real_name || m.username }}</span>
              <span class="picker-account">{{ m.username }}</span>
            </label>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-primary" @click="pickerVisible = false">完成</button>
        </div>
      </div>
    </div>

    <!-- 详情弹窗（只读；学生打开即自动确认已读） -->
    <div v-if="detailVisible" class="modal-mask" @click.self="detailVisible = false">
      <div class="modal-box">
        <div class="modal-head">
          <h4>{{ current.title }}</h4>
          <button class="modal-close" @click="detailVisible = false">×</button>
        </div>
        <div class="modal-body">
          <div class="detail-item"><div class="detail-label">类型</div><div class="detail-value">{{ current.type || '-' }}</div></div>
          <div class="detail-item"><div class="detail-label">时间</div><div class="detail-value">{{ fmtDateTime(current.meeting_date) }}</div></div>
          <div class="detail-item"><div class="detail-label">地点</div><div class="detail-value">{{ current.location || '-' }}</div></div>
          <div class="detail-item"><div class="detail-label">主持人</div><div class="detail-value">{{ memberName(current.host_id) }}</div></div>
          <div class="detail-item">
            <div class="detail-label">参会人</div>
            <div class="detail-value">
              <span v-for="n in attendeeNames(current.attendees)" :key="n" class="detail-tag">{{ n }}</span>
              <span v-if="!attendeeNames(current.attendees).length">-</span>
            </div>
          </div>
          <div class="detail-item"><div class="detail-label">状态</div><div class="detail-value">{{ statusLabel(current.status) }}</div></div>
          <div class="detail-item">
            <div class="detail-label">会议纪要</div>
            <div class="detail-value">{{ current.summary || '暂无纪要' }}</div>
          </div>
          <div v-if="readMarked" class="read-marked">✓ 你已确认阅读该会议纪要</div>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="detailVisible = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 已读情况弹窗（导师 / 管理员） -->
    <div v-if="readVisible" class="modal-mask" @click.self="readVisible = false">
      <div class="modal-box">
        <div class="modal-head">
          <h4>已读情况：{{ readTitle }}</h4>
          <button class="modal-close" @click="readVisible = false">×</button>
        </div>
        <div class="modal-body">
          <p class="read-summary">
            参会 {{ readTotal }} 人，已读 <b class="ok-num">{{ readCount }}</b> 人，未读 <b class="bad-num">{{ readTotal - readCount }}</b> 人
          </p>
          <table class="read-table">
            <thead>
              <tr><th>参会人</th><th>状态</th><th>阅读时间</th></tr>
            </thead>
            <tbody>
              <tr v-if="!readRows.length"><td colspan="3" class="state-cell">暂无参会人（请先在编辑里选择参会人）</td></tr>
              <tr v-for="r in readRows" :key="r.name">
                <td>{{ r.name }}<span v-if="!r.recognized" class="unrecognized">（未识别）</span></td>
                <td>
                  <span v-if="r.recognized && r.read" class="read-ok">✓ 已读</span>
                  <span v-else-if="r.recognized && !r.read" class="read-bad">✗ 未读</span>
                  <span v-else class="read-unknown">—</span>
                </td>
                <td>{{ r.read_at ? fmtDateTime(r.read_at) : '-' }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="reminding" class="remind-tip">正在提醒未读成员…</p>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="readVisible = false">关闭</button>
          <button class="btn btn-primary" @click="remindUnread" :disabled="reminding || readTotal - readCount <= 0">
            {{ reminding ? '提醒中…' : `提醒未读（${readTotal - readCount} 人）` }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { collab, listMembers } from '../../api'
import { MEETING_STATUS_OPTIONS } from '../../config/fieldOptions'
import { useRole } from '../../composables/useRole'
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'

const { isManager } = useRole()

const list = ref([])
const loading = ref(false)
const keyword = ref('')
const members = ref([])

// 表单状态
const formVisible = ref(false)
const formMode = ref('create')
const form = ref({})
const formError = ref('')
const saving = ref(false)
const editingId = ref(null)

// 参会人选择
const selectedAttendees = ref([]) // [{ id, username, real_name, unknown? }]
const pickerVisible = ref(false)
const pickerKeyword = ref('')
const pickerChecked = ref([]) // username 数组

// 详情 / 已读
const detailVisible = ref(false)
const current = ref({})
const readMarked = ref(false)
const readVisible = ref(false)
const readTitle = ref('')
const readRows = ref([])
const readTotal = ref(0)
const readCount = ref(0)
const reminding = ref(false)

// ===== 成员 / 展示工具 =====
function memberLabel(m) {
  return m.real_name ? `${m.real_name}（${m.username}）` : m.username
}
function memberName(id) {
  const m = members.value.find((x) => x.id === id)
  return m ? memberLabel(m) : (id || '-')
}
function fmtDateTime(v) {
  if (!v) return '-'
  return String(v).slice(0, 16)
}
function statusLabel(v) {
  const o = MEETING_STATUS_OPTIONS.find((x) => x.value === v)
  return o ? o.label : (v || '-')
}
function statusClass(v) {
  return { scheduled: 'tag-blue', done: 'tag-green', cancelled: 'tag-gray' }[v] || 'tag-gray'
}

// 详情里参会人显示姓名（按 username / real_name 匹配）
function attendeeNames(raw) {
  if (!raw) return []
  return String(raw).split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
    const m = members.value.find((x) => x.username === s || x.real_name === s)
    return m ? (m.real_name || m.username) : s
  })
}

// ===== 参会人选择器 =====
// 分组：学生 / 导师 / 其他（管理员等兜底）
const pickerGroups = computed(() => {
  const kw = String(pickerKeyword.value || '').trim().toLowerCase()
  const filtered = members.value.filter((m) => {
    if (!kw) return true
    const name = (m.real_name || '').toLowerCase()
    const account = (m.username || '').toLowerCase()
    return name.includes(kw) || account.includes(kw)
  })
  const student = filtered.filter((m) => m.role === 'student')
  const mentor = filtered.filter((m) => m.role === 'mentor')
  const other = filtered.filter((m) => m.role !== 'student' && m.role !== 'mentor')
  const groups = []
  if (student.length) groups.push({ key: 'student', label: '学生', items: student })
  if (mentor.length) groups.push({ key: 'mentor', label: '导师', items: mentor })
  if (other.length) groups.push({ key: 'other', label: '其他', items: other })
  return groups
})

function isPicked(username) {
  return pickerChecked.value.includes(username)
}

// 勾选即时生效：勾选/取消的同时同步 selectedAttendees 与 form.attendees，
// 弹窗只是关闭（点完成 / × / 遮罩都保留勾选），不再有"确定后丢失"的问题。
function togglePick(m) {
  const i = pickerChecked.value.indexOf(m.username)
  if (i >= 0) {
    pickerChecked.value.splice(i, 1)
    selectedAttendees.value = selectedAttendees.value.filter((x) => x.username !== m.username)
  } else {
    pickerChecked.value.push(m.username)
    selectedAttendees.value.push({ id: m.id, username: m.username, real_name: m.real_name })
  }
  syncAttendees()
}

function syncAttendees() {
  const usernames = selectedAttendees.value.map((x) => x.username).filter(Boolean)
  form.value.attendees = usernames.length ? usernames.join(',') : null
}

function openPicker() {
  pickerKeyword.value = ''
  pickerChecked.value = selectedAttendees.value.map((m) => m.username).filter(Boolean)
  pickerVisible.value = true
}

function removeAttendee(m) {
  selectedAttendees.value = selectedAttendees.value.filter((x) => x.username !== m.username)
  syncAttendees()
}

// 编辑回显：把 attendees 文本解析成成员对象（优先 username，其次 real_name；匹配不到保留原文可删）
function parseAttendees(raw) {
  if (!raw) return []
  return String(raw).split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
    const m = members.value.find((x) => x.username === s || x.real_name === s)
    if (m) return { id: m.id, username: m.username, real_name: m.real_name }
    return { username: s, real_name: s, unknown: true }
  })
}

// ===== 列表 =====
async function load() {
  loading.value = true
  try {
    const res = await collab.meeting.list(keyword.value.trim() ? { title: { op: 'LIKE', value: `%${keyword.value.trim()}%` } } : {})
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
  form.value = { status: 'scheduled' }
  selectedAttendees.value = []
  formVisible.value = true
}

function openEdit(row) {
  formMode.value = 'edit'
  editingId.value = row.id
  formError.value = ''
  form.value = {
    title: row.title || '',
    type: row.type || '',
    meeting_date: row.meeting_date ? String(row.meeting_date).slice(0, 16).replace(' ', 'T') : '',
    location: row.location || '',
    host_id: row.host_id || null,
    attendees: row.attendees || '',
    status: row.status || 'scheduled',
    summary: row.summary || ''
  }
  selectedAttendees.value = parseAttendees(row.attendees)
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
    formError.value = '请填写会议主题'
    return
  }
  saving.value = true
  try {
    // 参会人统一以已选标签为准兜底生成（防止任何环节不同步导致丢数据）
    const pickedUsernames = selectedAttendees.value.map((x) => x.username).filter(Boolean)
    const payload = {
      title: String(form.value.title).trim(),
      type: clean(form.value.type),
      meeting_date: form.value.meeting_date ? String(form.value.meeting_date).replace('T', ' ') + ':00' : null,
      location: clean(form.value.location),
      host_id: form.value.host_id || null,
      attendees: pickedUsernames.length ? pickedUsernames.join(',') : null,
      status: form.value.status || 'scheduled',
      summary: clean(form.value.summary)
    }
    const res = formMode.value === 'create'
      ? await collab.meeting.create(payload)
      : await collab.meeting.update(editingId.value, payload)
    if (res && res.success) {
      formVisible.value = false
      await load()
    } else {
      formError.value = (res && res.message) || '保存失败'
    }
  } catch (e) {
    formError.value = '保存过程出现异常，请重试'
  } finally {
    saving.value = false
  }
}

// 详情：学生打开即自动确认已读（后端幂等，重复打开不会重复写）
async function openDetail(row) {
  current.value = row
  readMarked.value = false
  detailVisible.value = true
  if (!isManager) {
    try {
      const res = await collab.markMeetingRead(row.id)
      if (res && res.success) readMarked.value = true
    } catch (e) {
      console.error('[meeting.markRead] 异常:', e)
    }
  }
}

// 已读情况：导师 / 管理员查看参会人已读 / 未读
async function openReadStatus(row) {
  current.value = row
  readTitle.value = row.title || '组会'
  readRows.value = []
  readTotal.value = 0
  readCount.value = 0
  readVisible.value = true
  try {
    const res = await collab.meetingReadStatus(row.id)
    if (res && res.success) {
      readRows.value = res.list || []
      readTotal.value = res.total || 0
      readCount.value = res.readCount || 0
    } else {
      readRows.value = []
    }
  } catch (e) {
    console.error('[meeting.readStatus] 异常:', e)
  }
}

async function remindUnread() {
  reminding.value = true
  try {
    const res = await collab.remindMeetingUnread(current.value.id)
    if (res && res.success) {
      await dialogAlert(res.message || '已提醒')
      // 刷新状态
      const st = await collab.meetingReadStatus(current.value.id)
      if (st && st.success) {
        readRows.value = st.list || []
        readTotal.value = st.total || 0
        readCount.value = st.readCount || 0
      }
    } else {
      await dialogAlert((res && res.message) || '提醒失败')
    }
  } catch (e) {
    await dialogAlert('提醒过程出现异常，请重试')
  } finally {
    reminding.value = false
  }
}

async function confirmRemove(row) {
  const ok = await dialogConfirm(`确定删除组会「${row.title}」吗？此操作不可恢复。`, '删除组会')
  if (!ok) return
  try {
    const res = await collab.meeting.remove(row.id)
    if (res && res.success) {
      await load()
    } else {
      await dialogAlert((res && res.message) || '删除失败')
    }
  } catch (e) {
    await dialogAlert('删除过程出现异常，请重试')
  }
}

onMounted(() => {
  load()
  listMembers().then((res) => {
    if (res && res.success && Array.isArray(res.members)) members.value = res.members
  }).catch(() => {})
})
</script>

<style scoped>
.meeting-page {
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
  gap: 8px;
}
.search-input {
  height: 34px;
  width: 200px;
  padding: 0 12px;
  font-size: 13px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  outline: none;
}
.search-input:focus {
  border-color: #0d80e0;
}
.btn {
  height: 34px;
  padding: 0 16px;
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
.data-row {
  cursor: pointer;
}
.data-row:hover td {
  background: #f9fafb;
}
.state-row td {
  text-align: center;
  color: #8a9099;
  padding: 32px 0;
}
.col-ops {
  width: 190px;
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
.tag {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
}
.tag-blue { background: #e8f3ff; color: #0d80e0; }
.tag-green { background: #e6f7ec; color: #19a558; }
.tag-gray { background: #f2f3f5; color: #8a9099; }
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

/* 参会人选择区 */
.attendee-picker {
  min-height: 38px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  padding: 6px 10px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  background: #fafbfc;
  box-sizing: border-box;
}
.attendee-picker:hover {
  border-color: #0d80e0;
}
.picker-placeholder {
  color: #b8bec4;
  font-size: 13px;
}
.attendee-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #e8f3ff;
  color: #0d80e0;
  font-size: 12px;
  border-radius: 8px;
  padding: 2px 8px;
}
.attendee-tag .tag-x {
  font-style: normal;
  cursor: pointer;
  color: #7ba8dc;
  font-size: 14px;
  line-height: 1;
}
.attendee-tag .tag-x:hover {
  color: #ea4335;
}
.picker-add {
  color: #0d80e0;
  font-size: 15px;
  line-height: 1;
}

/* 成员选择器弹窗 */
.picker-box {
  width: 460px;
}
.picker-search {
  margin-bottom: 10px;
}
.picker-summary {
  font-size: 13px;
  color: #4e5969;
  margin-bottom: 10px;
}
.picker-group {
  margin-bottom: 14px;
}
.group-title {
  font-size: 13px;
  font-weight: 600;
  color: #1f2329;
  margin-bottom: 6px;
  border-left: 3px solid #0d80e0;
  padding-left: 8px;
}
.group-empty {
  font-size: 12px;
  color: #b8bec4;
  padding: 6px 8px;
}
.picker-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.12s;
}
.picker-row:hover {
  background: #f5f8ff;
}
.picker-row.checked {
  background: #eef5ff;
}
.picker-checkbox {
  width: 16px;
  height: 16px;
  border: 1.5px solid #c3c9d1;
  border-radius: 4px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.picker-checkbox.on {
  background: #0d80e0;
  border-color: #0d80e0;
}
.check-mark {
  font-style: normal;
  color: #fff;
  font-size: 11px;
  line-height: 1;
}
.picker-name {
  color: #1f2329;
  font-weight: 500;
}
.picker-account {
  color: #8a9099;
  font-size: 12px;
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
.detail-tag {
  display: inline-block;
  background: #f2f3f5;
  color: #4e5969;
  font-size: 12px;
  border-radius: 8px;
  padding: 2px 8px;
  margin: 2px 4px 2px 0;
}
.read-marked {
  margin-top: 10px;
  font-size: 13px;
  color: #19a558;
  background: #e6f7ec;
  border-radius: 8px;
  padding: 8px 12px;
}
.read-summary {
  margin: 0 0 10px;
  font-size: 13px;
  color: #4e5969;
}
.ok-num { color: #19a558; }
.bad-num { color: #ea4335; }
.read-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.read-table th,
.read-table td {
  border-bottom: 1px solid #eceff3;
  padding: 8px 10px;
  text-align: left;
}
.read-table th {
  background: #f5f7fa;
  color: #4e5969;
  font-weight: 600;
}
.state-cell {
  text-align: center;
  color: #8a9099;
  padding: 20px 0;
}
.read-ok { color: #19a558; }
.read-bad { color: #ea4335; }
.read-unknown { color: #8a9099; }
.unrecognized {
  margin-left: 6px;
  font-size: 12px;
  color: #fa8c16;
}
.remind-tip {
  margin: 10px 0 0;
  font-size: 12px;
  color: #0d80e0;
}
</style>
