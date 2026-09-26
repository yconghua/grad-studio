<template>
  <div class="task-page">
    <!-- 头部：标题 + 搜索 + 新增 -->
    <div class="page-head">
      <h3 class="page-title">任务协作</h3>
      <div class="head-actions">
        <input v-model="keyword" class="search-input" placeholder="搜索任务标题" @keyup.enter="load" />
        <button class="btn" @click="load">查询</button>
        <button class="btn btn-primary" @click="openCreate">新增任务</button>
      </div>
    </div>

    <!-- 看板 -->
    <div class="kanban">
      <div
        v-for="col in columns"
        :key="col.key"
        class="kanban-col"
        :class="{ 'drop-over': dragOver === col.key }"
        @dragover.prevent="dragOver = col.key"
        @dragleave="dragOver === col.key && (dragOver = null)"
        @drop.prevent="dropTo(col.key)"
      >
        <div class="col-head" :style="{ borderColor: col.color }">
          <span class="col-dot" :style="{ background: col.color }"></span>
          <span class="col-label">{{ col.label }}</span>
          <span class="col-count">{{ tasksIn(col.key).length }}</span>
        </div>
        <div class="col-body">
          <div
            v-for="t in tasksIn(col.key)"
            :key="t.id"
            class="task-card"
            :draggable="canEdit(t)"
            @dragstart="dragStart(t)"
            @click="openDetail(t)"
          >
            <div class="card-title">{{ t.title }}</div>
            <div class="card-meta">
              <span v-if="t.assignee_id" class="assignee">👤 {{ memberName(t.assignee_id) }}</span>
              <span v-if="t.source_type" class="src-chip" :class="'src-' + t.source_type">{{ srcLabel(t.source_type) }}</span>
            </div>
            <div class="card-tags">
              <span class="prio" :class="prioClass(t.priority)">{{ prioLabel(t.priority) }}</span>
              <span v-if="t.tags" v-for="tag in tagList(t.tags)" :key="tag" class="tag-chip">{{ tag }}</span>
            </div>
            <div class="card-foot">
              <span v-if="t.due_date" class="due" :class="{ overdue: isOverdue(t) }">
                {{ isOverdue(t) ? '已逾期 ' : '' }}{{ t.due_date }}
              </span>
              <span v-if="t.progress" class="progress">{{ t.progress }}%</span>
            </div>
          </div>
          <div v-if="!tasksIn(col.key).length" class="col-empty">拖拽任务到这里</div>
        </div>
      </div>
    </div>

    <!-- 新增 / 编辑弹窗 -->
    <div v-if="formVisible" class="modal-mask" @click.self="closeForm">
      <div class="modal-box">
        <div class="modal-head">
          <h4>{{ formMode === 'create' ? '新增任务' : '编辑任务' }}</h4>
          <button class="modal-close" @click="closeForm">×</button>
        </div>
        <div class="modal-body">
          <div class="form-item">
            <label class="form-label">任务标题<span class="req"> *</span></label>
            <input v-model="form.title" class="form-input" placeholder="必填" />
          </div>
          <div class="form-item">
            <label class="form-label">任务描述</label>
            <textarea v-model="form.description" class="form-input form-textarea" rows="3"></textarea>
          </div>
          <div class="form-row">
            <div class="form-item">
              <label class="form-label">负责人</label>
              <select v-model="form.assignee_id" class="form-input">
                <option :value="null">请选择</option>
                <option v-for="m in members" :key="m.id" :value="m.id">{{ memberLabel(m) }}</option>
              </select>
            </div>
            <div class="form-item">
              <label class="form-label">优先级</label>
              <select v-model="form.priority" class="form-input">
                <option v-for="o in PRIORITY_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-item">
              <label class="form-label">状态</label>
              <select v-model="form.status" class="form-input">
                <option v-for="o in TASK_STATUS_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </div>
            <div class="form-item">
              <label class="form-label">进度 (0-100)</label>
              <input v-model.number="form.progress" type="number" min="0" max="100" class="form-input" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-item">
              <label class="form-label">截止日期</label>
              <input v-model="form.due_date" type="date" class="form-input" />
            </div>
            <div class="form-item">
              <label class="form-label">关联项目ID</label>
              <input v-model.number="form.project_id" type="number" class="form-input" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-item">
              <label class="form-label">来源类型</label>
              <select v-model="form.source_type" class="form-input">
                <option :value="null">无来源</option>
                <option value="weekly_report">周报</option>
                <option value="meeting">组会</option>
                <option value="paper">论文</option>
                <option value="other">其他</option>
              </select>
            </div>
            <div class="form-item">
              <label class="form-label">来源记录</label>
              <select v-if="form.source_type && form.source_type !== 'other'" v-model="form.source_id" class="form-input">
                <option :value="null">请选择</option>
                <option v-if="form.source_type === 'weekly_report'" v-for="s in weeklyReports" :key="s.id" :value="s.id">周报 {{ s.week_start }}（学生 {{ s.student_id }}）</option>
                <option v-if="form.source_type === 'meeting'" v-for="s in meetings" :key="s.id" :value="s.id">{{ s.title }}</option>
                <option v-if="form.source_type === 'paper'" v-for="s in papers" :key="s.id" :value="s.id">{{ s.title }}</option>
              </select>
              <input v-else-if="form.source_type === 'other'" v-model.number="form.source_id" type="number" class="form-input" placeholder="来源记录 ID（可选）" />
              <input v-else class="form-input" placeholder="先选择来源类型" disabled />
            </div>
          </div>
          <div class="form-item">
            <label class="form-label">标签</label>
            <input v-model="form.tags" class="form-input" placeholder="逗号分隔，如：紧急,导师安排" />
          </div>
          <p v-if="formError" class="form-error">{{ formError }}</p>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="closeForm">取消</button>
          <button class="btn btn-primary" @click="submit" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button>
        </div>
      </div>
    </div>

    <!-- 详情弹窗 -->
    <div v-if="detailVisible" class="modal-mask" @click.self="detailVisible = false">
      <div class="modal-box">
        <div class="modal-head">
          <h4>{{ current.title }}</h4>
          <button class="modal-close" @click="detailVisible = false">×</button>
        </div>
        <div class="modal-body">
          <div class="detail-item"><div class="detail-label">描述</div><div class="detail-value">{{ current.description || '-' }}</div></div>
          <div class="detail-item"><div class="detail-label">负责人</div><div class="detail-value">{{ memberName(current.assignee_id) }}</div></div>
          <div class="detail-item"><div class="detail-label">优先级</div><div class="detail-value">{{ prioLabel(current.priority) }}</div></div>
          <div class="detail-item"><div class="detail-label">状态</div><div class="detail-value">{{ statusLabel(current.status) }}</div></div>
          <div class="detail-item"><div class="detail-label">进度</div><div class="detail-value">{{ current.progress != null ? current.progress + '%' : '-' }}</div></div>
          <div class="detail-item"><div class="detail-label">截止日期</div><div class="detail-value">{{ current.due_date || '-' }}</div></div>
          <div class="detail-item"><div class="detail-label">来源</div><div class="detail-value">{{ srcLabel(current.source_type) || '-' }}{{ current.source_type ? ' #' + (current.source_id != null ? current.source_id : '?') : '' }}</div></div>
          <div class="detail-item"><div class="detail-label">标签</div><div class="detail-value">{{ current.tags || '-' }}</div></div>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="openComment(current)">评论</button>
          <button v-if="canEdit(current)" class="btn" @click="openEdit(current); detailVisible = false">编辑</button>
          <button v-if="canDelete(current)" class="btn danger" @click="confirmRemove(current)">删除</button>
          <button class="btn btn-primary" @click="detailVisible = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 任务评论 -->
    <TaskComment
      :visible="commentVisible"
      :task-id="currentTask?.id"
      :task-title="currentTask?.title"
      @close="commentVisible = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import TaskComment from '../../components/TaskComment.vue'
import { collab, research, listMembers } from '../../api'
import { TASK_STATUS_OPTIONS, PRIORITY_OPTIONS } from '../../config/fieldOptions'
import { useSession } from '../../composables/useSession'
import { useRole } from '../../composables/useRole'
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'

const { getSessionUser } = useSession()
const { isAdmin } = useRole()
const me = getSessionUser()
const myId = me ? me.id : null

const list = ref([])
const loading = ref(false)
const keyword = ref('')
const members = ref([])

const formVisible = ref(false)
const formMode = ref('create')
const form = ref({})
const formError = ref('')
const saving = ref(false)
const editingId = ref(null)

const detailVisible = ref(false)
const current = ref({})
const commentVisible = ref(false)
const currentTask = ref(null)

const dragTaskId = ref(null)
const dragOver = ref(null)

// ===== 任务来源（周报 / 组会 / 论文 关联）=====
const weeklyReports = ref([])
const meetings = ref([])
const papers = ref([])
const SRC_LABELS = {
  weekly_report: '周报',
  meeting: '组会',
  paper: '论文',
  other: '其他'
}

function srcLabel(v) {
  return SRC_LABELS[v] || ''
}

async function loadSourceOptions(type) {
  if (type === 'weekly_report') {
    const res = await collab.weeklyReport.list({}).catch(() => null)
    weeklyReports.value = res && res.success ? res.list || [] : []
  } else if (type === 'meeting') {
    const res = await collab.meeting.list({}).catch(() => null)
    meetings.value = res && res.success ? res.list || [] : []
  } else if (type === 'paper') {
    const res = await research.paper.list({}).catch(() => null)
    papers.value = res && res.success ? res.list || [] : []
  }
}

// 切换来源类型：清空已选来源，按需加载来源列表
watch(
  () => form.value.source_type,
  (v, old) => {
    if (v !== old) form.value.source_id = null
    if (v && v !== 'other') loadSourceOptions(v)
  }
)

const columns = [
  { key: 'todo', label: '待办', color: '#0d80e0' },
  { key: 'doing', label: '进行中', color: '#fa8c16' },
  { key: 'done', label: '已完成', color: '#19a558' },
  { key: 'delayed', label: '延期', color: '#ea4335' }
]

function memberLabel(m) {
  return m.real_name ? `${m.real_name}（${m.username}）` : m.username
}
function memberName(id) {
  const m = members.value.find((x) => x.id === id)
  return m ? memberLabel(m) : (id || '-')
}
function prioLabel(v) {
  const o = PRIORITY_OPTIONS.find((x) => x.value === v)
  return o ? o.label : (v || '-')
}
function prioClass(v) {
  return { high: 'prio-high', medium: 'prio-medium', low: 'prio-low' }[v] || 'prio-medium'
}
function statusLabel(v) {
  const o = TASK_STATUS_OPTIONS.find((x) => x.value === v)
  return o ? o.label : (v || '-')
}
function tagList(tags) {
  return String(tags || '').split(',').map((s) => s.trim()).filter(Boolean)
}
function isOverdue(t) {
  return !!t.overdue || (t.due_date && t.status !== 'done' && String(t.due_date) < todayStr())
}
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function canEdit(row) {
  // 管理员全部；导师/学生只能编辑自己创建或被分配的任务
  return isAdmin || Number(row.created_by) === Number(myId) || Number(row.assignee_id) === Number(myId)
}
function canDelete(row) {
  // 管理员全部；导师/学生只能删除自己创建的任务
  return isAdmin || Number(row.created_by) === Number(myId)
}

// 按列归类：延期列 = status=delayed 或 已逾期未完成
function tasksIn(colKey) {
  return list.value.filter((t) => {
    if (colKey === 'delayed') return t.status === 'delayed' || isOverdue(t)
    if (colKey === 'done') return t.status === 'done'
    return t.status === colKey && !isOverdue(t)
  })
}

async function load() {
  loading.value = true
  try {
    const filters = keyword.value.trim() ? { title: { op: 'LIKE', value: `%${keyword.value.trim()}%` } } : {}
    const res = await collab.task.list(filters)
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
  form.value = { priority: 'medium', status: 'todo', progress: 0, source_type: null, source_id: null }
  formVisible.value = true
}

function openEdit(row) {
  formMode.value = 'edit'
  editingId.value = row.id
  formError.value = ''
  form.value = {
    title: row.title || '',
    description: row.description || '',
    project_id: row.project_id || null,
    assignee_id: row.assignee_id || null,
    priority: row.priority || 'medium',
    status: row.status || 'todo',
    progress: row.progress != null ? row.progress : 0,
    due_date: row.due_date || '',
    tags: row.tags || '',
    source_type: row.source_type || null,
    source_id: row.source_id != null ? row.source_id : null
  }
  if (row.source_type && row.source_type !== 'other') loadSourceOptions(row.source_type)
  detailVisible.value = false
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
    formError.value = '请填写任务标题'
    return
  }
  saving.value = true
  try {
    const payload = {
      title: String(form.value.title).trim(),
      description: clean(form.value.description),
      project_id: form.value.project_id || null,
      assignee_id: form.value.assignee_id || null,
      priority: form.value.priority || 'medium',
      status: form.value.status || 'todo',
      progress: form.value.progress != null ? Number(form.value.progress) : 0,
      due_date: clean(form.value.due_date),
      tags: clean(form.value.tags),
      source_type: form.value.source_type || null,
      source_id: form.value.source_id != null ? Number(form.value.source_id) : null
    }
    const res = formMode.value === 'create'
      ? await collab.task.create(payload)
      : await collab.task.update(editingId.value, payload)
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

// 看板拖拽
function dragStart(t) {
  dragTaskId.value = t.id
}
function dropTo(colKey) {
  const id = dragTaskId.value
  dragTaskId.value = null
  dragOver.value = null
  if (!id) return
  const targetStatus = colKey === 'delayed' ? 'delayed' : colKey
  const task = list.value.find((t) => t.id === id)
  if (!task || task.status === targetStatus) return
  // 直接更新状态（后端走通用 update，权限与编辑一致）
  collab.task.update(id, { status: targetStatus })
    .then((res) => {
      if (!res || !res.success) {
        console.error('[task.move] 更新失败:', res)
        dialogAlert((res && res.message) || '移动失败')
      }
      return load()
    })
    .catch((e) => {
      console.error('[task.move] 异常:', e)
      dialogAlert('移动过程出现异常，请重试')
    })
}

function openDetail(row) {
  current.value = row
  detailVisible.value = true
}

function openComment(row) {
  currentTask.value = row
  commentVisible.value = true
  detailVisible.value = false
}

async function confirmRemove(row) {
  const ok = await dialogConfirm(`确定删除任务「${row.title}」吗？此操作不可恢复。`, '删除任务')
  if (!ok) return
  try {
    const res = await collab.task.remove(row.id)
    if (res && res.success) {
      detailVisible.value = false
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
.task-page {
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
.danger {
  color: #ea4335;
  border-color: #f3d8d5;
}
.danger:hover {
  border-color: #ea4335;
  color: #ea4335;
}

/* 看板 */
.kanban {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.kanban-col {
  flex: 1;
  min-width: 0;
  background: #f5f7fa;
  border-radius: 10px;
  padding: 8px;
  border: 2px solid transparent;
  transition: border-color 0.15s, background 0.15s;
}
.kanban-col.drop-over {
  border-color: #0d80e0;
  background: #eef5ff;
}
.col-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px 10px;
  border-bottom: 2px solid;
}
.col-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.col-label {
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}
.col-count {
  margin-left: auto;
  background: #fff;
  border-radius: 10px;
  padding: 0 8px;
  font-size: 12px;
  color: #4e5969;
}
.col-body {
  min-height: 160px;
  padding-top: 8px;
}
.task-card {
  background: #fff;
  border: 1px solid #eceff3;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 8px;
  cursor: grab;
  transition: box-shadow 0.15s;
}
.task-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
.card-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
  margin-bottom: 6px;
  word-break: break-all;
}
.card-meta {
  font-size: 12px;
  color: #8a9099;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.src-chip {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 8px;
}
.src-weekly_report { background: #e6f7ec; color: #19a558; }
.src-meeting { background: #e8f3ff; color: #0d80e0; }
.src-paper { background: #fff3e0; color: #fa8c16; }
.src-other { background: #f2f3f5; color: #8a9099; }
.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}
.prio {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 8px;
}
.prio-high { background: #fde8e6; color: #ea4335; }
.prio-medium { background: #fff3e0; color: #fa8c16; }
.prio-low { background: #f2f3f5; color: #8a9099; }
.tag-chip {
  font-size: 11px;
  background: #e8f3ff;
  color: #0d80e0;
  padding: 1px 8px;
  border-radius: 8px;
}
.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #8a9099;
}
.due.overdue {
  color: #ea4335;
  font-weight: 600;
}
.progress {
  color: #4e5969;
}
.col-empty {
  text-align: center;
  color: #b8bec4;
  font-size: 12px;
  padding: 24px 0;
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
</style>
