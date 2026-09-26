<template>
  <div class="grad-page">
    <!-- 头部：标题 + 搜索 + 新增 -->
    <div class="page-head">
      <h3 class="page-title">毕业进度</h3>
      <div class="head-actions">
        <input v-model="keyword" class="search-input" placeholder="搜索学生姓名 / ID" />
        <button class="btn" @click="load">查询</button>
        <button v-if="isManager" class="btn btn-primary" @click="openCreate">新增里程碑</button>
      </div>
    </div>

    <!-- 仪表盘：管理员看全部学生 / 导师看名下学生 / 学生看自己 -->
    <div v-if="overviewLoaded" class="dash">
      <div v-for="s in overviewStudents" :key="s.user_id" class="dash-card" :class="{ 'is-me': Number(s.user_id) === Number(myId) }">
        <div class="dash-head">
          <b>{{ s.real_name || s.username }}</b>
          <span class="dash-count">{{ s.done }}/{{ s.total }}</span>
        </div>
        <div class="dash-bar">
          <div class="dash-fill" :style="{ width: pct(s) + '%' }"></div>
        </div>
        <div class="dash-meta">
          <span v-if="s.next" class="next">
            最近截止：{{ s.next.type }} {{ s.next.deadline }}
            <b :class="s.next.days_left < 0 ? 'red' : 'orange'">
              {{ s.next.days_left < 0 ? '已逾期 ' + (-s.next.days_left) + ' 天' : (s.next.days_left === 0 ? '今天到期' : s.next.days_left + ' 天后') }}
            </b>
          </span>
          <span v-else-if="s.total" class="next done-all">全部完成 ✓</span>
          <span v-else class="next">暂无里程碑</span>
        </div>
        <div v-if="s.alerts.length" class="dash-alerts">
          <div v-for="(a, i) in s.alerts" :key="i" class="alert-item" :class="'alert-' + a.level">⚠ {{ a.text }}</div>
        </div>
      </div>
      <p v-if="overviewStudents.length === 0" class="dash-empty">暂无毕业进度数据</p>
    </div>
    <p v-else class="dash-empty">毕业进度统计加载中…</p>

    <!-- 里程碑列表 -->
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>学生</th>
            <th>里程碑</th>
            <th>截止日期</th>
            <th>状态</th>
            <th>完成日期</th>
            <th>备注</th>
            <th v-if="isManager" class="col-ops">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading" class="state-row"><td :colspan="isManager ? 7 : 6">加载中…</td></tr>
          <tr v-else-if="!filteredList.length" class="state-row"><td :colspan="isManager ? 7 : 6">暂无里程碑</td></tr>
          <tr v-for="row in filteredList" :key="row.id">
            <td>{{ userName(row.user_id) }}</td>
            <td>{{ typeLabel(row.type) }}</td>
            <td>{{ fmtDate(row.deadline) }}</td>
            <td><span class="tag" :class="statusClass(row.status)">{{ statusLabel(row.status) }}</span></td>
            <td>{{ fmtDate(row.completed_at) }}</td>
            <td class="cell-remark">{{ row.remark || '-' }}</td>
            <td v-if="isManager" class="col-ops">
              <button class="btn-link" @click="openEdit(row)">编辑</button>
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
          <h4>{{ formMode === 'create' ? '新增里程碑' : '编辑里程碑' }}</h4>
          <button class="modal-close" @click="closeForm">×</button>
        </div>
        <div class="modal-body">
          <div class="form-item">
            <label class="form-label">学生<span class="req"> *</span></label>
            <select v-model="form.user_id" class="form-input">
              <option :value="null">请选择</option>
              <option v-for="m in studentMembers" :key="m.id" :value="m.id">{{ memberLabel(m) }}</option>
            </select>
          </div>
          <div class="form-item">
            <label class="form-label">里程碑类型<span class="req"> *</span></label>
            <select v-model="form.type" class="form-input">
              <option v-for="o in MILESTONE_TYPE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>
          <div class="form-row">
            <div class="form-item">
              <label class="form-label">截止日期</label>
              <input v-model="form.deadline" type="date" class="form-input" />
            </div>
            <div class="form-item">
              <label class="form-label">完成日期</label>
              <input v-model="form.completed_at" type="date" class="form-input" />
            </div>
          </div>
          <div class="form-item">
            <label class="form-label">材料清单</label>
            <textarea v-model="form.materials" class="form-input form-textarea" rows="2" placeholder="如：开题报告、查重报告"></textarea>
          </div>
          <div class="form-item">
            <label class="form-label">状态</label>
            <select v-model="form.status" class="form-input">
              <option v-for="o in MILESTONE_STATUS_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>
          <div class="form-item">
            <label class="form-label">备注</label>
            <input v-model="form.remark" class="form-input" />
          </div>
          <p v-if="formError" class="form-error">{{ formError }}</p>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="closeForm">取消</button>
          <button class="btn btn-primary" @click="submit" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { research, listMembers } from '../../api'
import { MILESTONE_TYPE_OPTIONS, MILESTONE_STATUS_OPTIONS } from '../../config/fieldOptions'
import { useRole } from '../../composables/useRole'
import { useSession } from '../../composables/useSession'
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'

const { isManager } = useRole()
const { getSessionUser } = useSession()
const myId = getSessionUser() ? getSessionUser().id : null

const list = ref([])
const loading = ref(false)
const keyword = ref('')
const members = ref([])
const overview = ref(null)
const overviewLoaded = ref(false)

const formVisible = ref(false)
const formMode = ref('create')
const form = ref({})
const formError = ref('')
const saving = ref(false)
const editingId = ref(null)

// ===== 展示工具 =====
function memberLabel(m) {
  return m.real_name ? `${m.real_name}（${m.username}）` : m.username
}
function userName(id) {
  const m = members.value.find((x) => x.id === id)
  return m ? memberLabel(m) : (id || '-')
}
function typeLabel(v) {
  const o = MILESTONE_TYPE_OPTIONS.find((x) => x.value === v)
  return o ? o.label : (v || '-')
}
function statusLabel(v) {
  const o = MILESTONE_STATUS_OPTIONS.find((x) => x.value === v)
  return o ? o.label : (v || '-')
}
function statusClass(v) {
  return { done: 'tag-green', in_progress: 'tag-blue', delayed: 'tag-red', pending: 'tag-gray' }[v] || 'tag-gray'
}
function fmtDate(v) {
  return v ? String(v).slice(0, 10) : '-'
}
function pct(s) {
  return s.total ? Math.round((s.done / s.total) * 100) : 0
}

// 学生下拉：默认只列学生；若编辑的是其他角色用户也补上
const studentMembers = computed(() => {
  const st = members.value.filter((m) => m.role === 'student')
  const hasOther = form.value.user_id && !st.some((m) => m.id === form.value.user_id)
  return hasOther ? [members.value.find((m) => m.id === form.value.user_id), ...st].filter(Boolean) : st
})

// 本地过滤：支持学生姓名 / 账号 / ID
const filteredList = computed(() => {
  const kw = String(keyword.value || '').trim().toLowerCase()
  if (!kw) return list.value
  return list.value.filter((row) => {
    const m = members.value.find((x) => x.id === row.user_id)
    const name = m ? `${m.real_name || ''} ${m.username || ''}`.toLowerCase() : ''
    return name.includes(kw) || String(row.user_id).includes(kw)
  })
})

const overviewStudents = computed(() => (overview.value && overview.value.students ? overview.value.students : []))

// ===== 数据加载 =====
async function loadOverview() {
  overviewLoaded.value = false
  try {
    const res = await research.milestoneOverview()
    overview.value = res && res.success ? res : null
  } catch (e) {
    overview.value = null
    console.error('[grad.overview] 异常:', e)
  } finally {
    overviewLoaded.value = true
  }
}

async function load() {
  loading.value = true
  try {
    const res = await research.milestone.list()
    list.value = res && res.success ? res.list || [] : []
  } catch (e) {
    list.value = []
  } finally {
    loading.value = false
  }
}

// ===== 表单 =====
function openCreate() {
  formMode.value = 'create'
  editingId.value = null
  formError.value = ''
  form.value = { status: 'pending' }
  formVisible.value = true
}

function openEdit(row) {
  formMode.value = 'edit'
  editingId.value = row.id
  formError.value = ''
  form.value = {
    user_id: row.user_id || null,
    type: row.type || '',
    deadline: row.deadline ? String(row.deadline).slice(0, 10) : '',
    materials: row.materials || '',
    status: row.status || 'pending',
    completed_at: row.completed_at ? String(row.completed_at).slice(0, 10) : '',
    remark: row.remark || ''
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
  if (!form.value.user_id) {
    formError.value = '请选择学生'
    return
  }
  if (!form.value.type) {
    formError.value = '请选择里程碑类型'
    return
  }
  saving.value = true
  try {
    const payload = {
      user_id: form.value.user_id,
      type: form.value.type,
      deadline: clean(form.value.deadline),
      materials: clean(form.value.materials),
      status: form.value.status || 'pending',
      completed_at: clean(form.value.completed_at),
      remark: clean(form.value.remark)
    }
    const res = formMode.value === 'create'
      ? await research.milestone.create(payload)
      : await research.milestone.update(editingId.value, payload)
    if (res && res.success) {
      formVisible.value = false
      await load()
      await loadOverview()
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
  const ok = await dialogConfirm(`确定删除该里程碑吗？此操作不可恢复。`, '删除里程碑')
  if (!ok) return
  try {
    const res = await research.milestone.remove(row.id)
    if (res && res.success) {
      await load()
      await loadOverview()
    } else {
      await dialogAlert((res && res.message) || '删除失败')
    }
  } catch (e) {
    await dialogAlert('删除过程出现异常，请重试')
  }
}

onMounted(() => {
  load()
  loadOverview()
  listMembers().then((res) => {
    if (res && res.success && Array.isArray(res.members)) members.value = res.members
  }).catch(() => {})
})
</script>

<style scoped>
.grad-page {
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

/* 仪表盘 */
.dash {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}
.dash-card {
  border: 1px solid #eceff3;
  border-radius: 10px;
  padding: 12px 14px;
  background: #fafbfc;
}
.dash-card.is-me {
  border-color: #0d80e0;
  background: #f5f8ff;
}
.dash-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
  color: #1f2329;
}
.dash-count {
  font-size: 12px;
  color: #4e5969;
  background: #fff;
  border: 1px solid #eceff3;
  border-radius: 10px;
  padding: 1px 8px;
}
.dash-bar {
  height: 8px;
  border-radius: 4px;
  background: #eceff3;
  overflow: hidden;
}
.dash-fill {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, #0d80e0, #19a558);
}
.dash-meta {
  margin-top: 8px;
  font-size: 12px;
  color: #4e5969;
}
.dash-meta .red { color: #ea4335; }
.dash-meta .orange { color: #fa8c16; }
.dash-meta .done-all { color: #19a558; }
.dash-alerts {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.alert-item {
  font-size: 12px;
  border-radius: 6px;
  padding: 4px 8px;
}
.alert-danger { background: #fde8e6; color: #ea4335; }
.alert-warn { background: #fff3e0; color: #fa8c16; }
.dash-empty {
  grid-column: 1 / -1;
  text-align: center;
  color: #8a9099;
  font-size: 13px;
  padding: 24px 0;
  border: 1px dashed #eceff3;
  border-radius: 10px;
}

/* 表格 */
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
}
.data-table th {
  background: #f5f7fa;
  color: #4e5969;
  font-weight: 600;
}
.data-table td {
  color: #1f2329;
}
.cell-remark {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.state-row td {
  text-align: center;
  color: #8a9099;
  padding: 32px 0;
}
.col-ops {
  width: 110px;
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
.tag-green { background: #e6f7ec; color: #19a558; }
.tag-blue { background: #e8f3ff; color: #0d80e0; }
.tag-red { background: #fde8e6; color: #ea4335; }
.tag-gray { background: #f2f3f5; color: #8a9099; }

/* 弹窗 */
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
</style>
