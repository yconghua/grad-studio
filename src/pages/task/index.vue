<template>
  <div class="task-page">
    <div class="header-card">
      <div class="header-left">
        <h2 class="page-title">📋 任务管理</h2>
      </div>
      <div class="header-right">
        <button class="btn btn-primary" @click="openTaskModal()">＋ 新增任务</button>
      </div>
    </div>

    <div v-if="!currentGroupId" class="empty-tip">请先在页头选择或输入课题组ID</div>
    <div v-else class="card">
      <p v-if="loading" class="empty-tip">加载中…</p>
      <p v-else-if="!tasks.length" class="empty-tip">暂无任务</p>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th></th>
            <th>任务标题</th>
            <th>负责人</th>
            <th>优先级</th>
            <th>状态</th>
            <th>进度</th>
            <th>截止时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="t in tasks" :key="t.id">
            <tr class="row-main" @click="toggleExpand(t.id)">
              <td class="cell-arrow">{{ expandedId === t.id ? '▼' : '▶' }}</td>
              <td class="cell-title">{{ t.title }}</td>
              <td>{{ nameOf(t.assignee_id) }}</td>
              <td><span :class="['pri-tag', 'pri-' + t.priority]">{{ priorityText(t.priority) }}</span></td>
              <td><span :class="['status-tag', 'st-' + t.status]">{{ statusText(t.status) }}</span></td>
              <td>
                <div class="progress-wrap">
                  <div class="progress-bar"><div class="progress-inner" :style="{ width: (t.progress_percent || 0) + '%' }"></div></div>
                  <span class="progress-num">{{ t.progress_percent || 0 }}%</span>
                </div>
              </td>
              <td class="cell-time">{{ fmtDT(t.deadline) }}</td>
              <td @click.stop>
                <button class="btn btn-mini" @click="openTaskModal(t)">编辑</button>
                <button class="btn btn-mini btn-danger" @click="onRemoveTask(t)">删除</button>
              </td>
            </tr>
            <tr v-if="expandedId === t.id">
              <td colspan="8" class="member-cell">
                <div class="member-panel">
                  <span class="member-title">进展记录（{{ progressOf(t.id).length }}）</span>
                  <p v-if="loadingProgress" class="empty-tip small">加载中…</p>
                  <p v-else-if="!progressOf(t.id).length" class="empty-tip small">暂无进展记录</p>
                  <div v-else class="progress-list">
                    <div v-for="p in progressOf(t.id)" :key="p.id" class="progress-item">
                      <div class="progress-item-head">
                        <span class="pi-user">{{ nameOf(p.user_id) }}</span>
                        <span class="pi-pct">进度 {{ p.progress_percent }}%</span>
                        <span class="pi-time">{{ fmtDT(p.created_at) }}</span>
                      </div>
                      <div class="pi-content">{{ p.content || '（无说明）' }}</div>
                      <div v-if="p.attachment" class="pi-attach">附件：{{ p.attachment }}</div>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- 任务新增/编辑弹窗 -->
    <div v-if="taskModal.visible" class="modal-mask" @click.self="taskModal.visible = false">
      <div class="modal-box">
        <h3 class="modal-title">{{ taskModal.form.id ? '编辑任务' : '新增任务' }}</h3>
        <div class="form-grid">
          <label class="form-item full">
            <span class="form-label">任务标题 *</span>
            <input v-model="taskModal.form.title" type="text" placeholder="任务标题" />
          </label>
          <label class="form-item">
            <span class="form-label">执行人 <i>*</i></span>
            <select v-model="taskModal.form.assignee_id">
              <option :value="0" disabled>请选择执行人</option>
              <option v-for="m in assigneeOptions" :key="m.id" :value="m.id">{{ memberLabel(m) }}</option>
            </select>
          </label>
          <label class="form-item">
            <span class="form-label">关联课题</span>
            <select v-model="taskModal.form.subject_id">
              <option :value="0">不挂课题</option>
              <option v-for="s in subjects" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </label>
          <label class="form-item">
            <span class="form-label">优先级</span>
            <select v-model="taskModal.form.priority">
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
          </label>
          <label class="form-item">
            <span class="form-label">状态</span>
            <select v-model="taskModal.form.status">
              <option value="todo">待办</option>
              <option value="in_progress">进行中</option>
              <option value="completed">已完成</option>
              <option value="cancelled">已取消</option>
            </select>
          </label>
          <label class="form-item">
            <span class="form-label">截止时间</span>
            <input v-model="taskModal.form.deadline" type="datetime-local" />
          </label>
          <label class="form-item">
            <span class="form-label">当前进度（0-100）</span>
            <input v-model.number="taskModal.form.progress_percent" type="number" min="0" max="100" />
          </label>
          <label class="form-item full">
            <span class="form-label">任务说明</span>
            <textarea v-model="taskModal.form.description" rows="3" placeholder="任务要求 / 说明"></textarea>
          </label>
          <label class="form-item full">
            <span class="form-label">备注</span>
            <input v-model="taskModal.form.remark" type="text" />
          </label>
        </div>
        <p v-if="taskModal.error" class="form-error">{{ taskModal.error }}</p>
        <div class="modal-actions">
          <button class="btn" @click="taskModal.visible = false">取消</button>
          <button class="btn btn-primary" :disabled="taskModal.saving" @click="onSaveTask">
            {{ taskModal.saving ? '保存中…' : '保存' }}
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
import {
  listTasks, createTask, updateTask, removeTask,
  listTaskProgress, listSubjects, listMembers
} from '../../api'

const { currentGroupId, loadGroups } = useGroupContext()

const tasks = ref([])
const members = ref([])
const subjects = ref([])
const progressMap = ref({})
const loading = ref(false)
const loadingProgress = ref(false)
const expandedId = ref(null)

const PRIORITY_TEXT = { high: '高', medium: '中', low: '低' }
const STATUS_TEXT = { todo: '待办', in_progress: '进行中', completed: '已完成', cancelled: '已取消' }

function fmtDT(v) {
  if (!v) return '—'
  return String(v).replace('T', ' ').slice(0, 16)
}
function priorityText(p) { return PRIORITY_TEXT[p] || p || '—' }
function statusText(s) { return STATUS_TEXT[s] || s || '—' }
// 显示名：有真实姓名显示「姓名（账号）」，无姓名显示账号
function memberLabel(m) {
  return m.real_name ? m.real_name + '（' + m.username + '）' : m.username
}
// 执行人候选：仅学生（导师/组管不接受任务派发）
const assigneeOptions = computed(() => members.value.filter((m) => m.role === 'student'))
function nameOf(id) {
  const m = members.value.find((x) => x.id === Number(id))
  return m ? memberLabel(m) : (id ? ('#' + id) : '—')
}
function progressOf(taskId) {
  return progressMap.value[taskId] || []
}

async function loadOptions() {
  try {
    const [memRes, subRes] = await Promise.all([listMembers({ group_id: currentGroupId.value }), listSubjects(currentGroupId.value)])
    if (memRes && memRes.success) members.value = memRes.members || []
    if (subRes && subRes.success) subjects.value = subRes.data || []
  } catch (e) { /* 忽略 */ }
}

async function loadTasks() {
  if (!currentGroupId.value) { tasks.value = []; return }
  loading.value = true
  try {
    const res = await listTasks({ group_id: currentGroupId.value })
    if (res && res.success) {
      tasks.value = res.data || []
    } else {
      tasks.value = []
      if (res && res.message) dialogAlert(res.message)
    }
  } finally { loading.value = false }
}

async function toggleExpand(id) {
  if (expandedId.value === id) { expandedId.value = null; return }
  expandedId.value = id
  await loadProgress(id)
}

async function loadProgress(taskId) {
  loadingProgress.value = true
  try {
    const res = await listTaskProgress(taskId)
    if (res && res.success) {
      progressMap.value = { ...progressMap.value, [taskId]: res.data || [] }
    }
  } finally { loadingProgress.value = false }
}

// ===== 任务弹窗 =====
const emptyForm = () => ({
  id: null, title: '', description: '', assignee_id: 0, subject_id: 0,
  priority: 'medium', status: 'todo', progress_percent: 0, deadline: '', remark: ''
})
const taskModal = ref({ visible: false, saving: false, error: '', form: emptyForm() })

function toLocal(v) { return v ? String(v).replace(' ', 'T').slice(0, 16) : '' }
function fromLocal(v) { return v ? v.replace('T', ' ') + (v.length === 16 ? ':00' : '') : '' }

function openTaskModal(row) {
  if (row) {
    taskModal.value.form = {
      id: row.id, title: row.title, description: row.description || '',
      assignee_id: row.assignee_id || 0, subject_id: row.subject_id || 0,
      priority: row.priority || 'medium', status: row.status || 'todo',
      progress_percent: row.progress_percent || 0, deadline: toLocal(row.deadline), remark: row.remark || ''
    }
  } else {
    taskModal.value.form = emptyForm()
  }
  taskModal.value.error = ''
  taskModal.value.visible = true
}

async function onSaveTask() {
  const f = taskModal.value.form
  if (!f.title.trim()) { taskModal.value.error = '任务标题不能为空'; return }
  if (!f.assignee_id) { taskModal.value.error = '请选择执行人'; return }
  taskModal.value.saving = true
  taskModal.value.error = ''
  const payload = {
    group_id: currentGroupId.value,
    title: f.title.trim(), description: f.description,
    assignee_id: Number(f.assignee_id), subject_id: Number(f.subject_id) || 0,
    priority: f.priority, status: f.status,
    progress_percent: Number(f.progress_percent) || 0,
    deadline: fromLocal(f.deadline), remark: f.remark
  }
  try {
    const res = f.id ? await updateTask({ id: f.id, ...payload }) : await createTask(payload)
    if (res && res.success) {
      taskModal.value.visible = false
      loadTasks()
    } else {
      taskModal.value.error = (res && res.message) || '保存失败'
    }
  } catch (e) {
    taskModal.value.error = '保存失败，请稍后重试'
  } finally {
    taskModal.value.saving = false
  }
}

async function onRemoveTask(row) {
  if (!await dialogConfirm(`确认删除任务「${row.title}」？`)) return
  const res = await removeTask(row.id)
  if (res && res.success) loadTasks()
  else dialogAlert((res && res.message) || '删除失败')
}

onMounted(() => {
  loadGroups()
})
watch(currentGroupId, () => {
  loadTasks()
  loadOptions()
}, { immediate: true })
</script>

<style scoped>
.header-card {
  display: flex; align-items: center; justify-content: space-between;
  background: #fff; border-radius: 12px; padding: 16px 20px; margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(15, 35, 80, 0.05);
}
.header-left { display: flex; align-items: center; gap: 16px; }
.page-title { margin: 0; font-size: 18px; color: #1f2329; }

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
.row-main { cursor: pointer; }
.cell-arrow { width: 28px; color: #8a9099; }
.cell-title { font-weight: 600; }
.cell-time { color: #8a9099; white-space: nowrap; }
.member-cell { background: #fafbfc !important; }
.member-panel { padding: 6px 8px; }
.member-title { font-size: 13px; font-weight: 600; color: #1f2329; }
.progress-list { margin-top: 10px; display: flex; flex-direction: column; gap: 10px; }
.progress-item {
  border: 1px solid #eceff3; border-radius: 8px; padding: 10px 12px; background: #fff;
}
.progress-item-head { display: flex; gap: 14px; align-items: center; margin-bottom: 6px; }
.pi-user { font-weight: 600; color: #1f2329; }
.pi-pct { color: #0d80e0; font-size: 12px; }
.pi-time { color: #8a9099; font-size: 12px; margin-left: auto; }
.pi-content { font-size: 13px; color: #4e5969; }
.pi-attach { font-size: 12px; color: #8a9099; margin-top: 4px; }

.progress-wrap { display: flex; align-items: center; gap: 8px; min-width: 120px; }
.progress-bar { flex: 1 1 auto; height: 6px; background: #eceff3; border-radius: 999px; overflow: hidden; }
.progress-inner { height: 100%; background: linear-gradient(135deg, #0d80e0, #19a558); border-radius: 999px; }
.progress-num { font-size: 12px; color: #4e5969; width: 38px; }

.status-tag {
  display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px;
  background: #f0f2f5; color: #4e5969; white-space: nowrap;
}
.st-todo { background: #f0f2f5; color: #8a9099; }
.st-in_progress { background: #e8f0fb; color: #0d80e0; }
.st-completed { background: #e8f7ee; color: #19a558; }
.st-cancelled { background: #fdecea; color: #ea4335; }
.pri-tag { font-size: 12px; }
.pri-high { color: #ea4335; }
.pri-medium { color: #e8890c; }
.pri-low { color: #8a9099; }

.empty-tip { text-align: center; color: #8a9099; font-size: 13px; padding: 36px 0; }
.empty-tip.small { padding: 14px 0; font-size: 12px; }

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
  background: #fff; border-radius: 12px; padding: 22px 24px; width: 600px; max-width: 92vw;
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
