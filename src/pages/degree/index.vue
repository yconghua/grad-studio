<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">🗓️ 学位节点管理</h2>
      <div class="ph-right">
      </div>
    </div>

    <div v-if="!currentGroupId" class="empty-block"><p>请先选择/输入课题组ID</p></div>

    <template v-else>
      <div class="tabs">
        <button class="tab" :class="{ active: tab === 'nodes' }" @click="tab = 'nodes'">学位节点</button>
        <button class="tab" :class="{ active: tab === 'records' }" @click="switchRecords">学生学位记录</button>
      </div>

      <!-- 学位节点 Tab -->
      <div v-if="tab === 'nodes'" class="card">
        <div class="card-header">
          <span class="card-desc">维护本组学位培养节点（如开题报告 / 中期考核 / 预答辩 / 毕业答辩）</span>
          <button class="btn btn-primary" @click="openNodeForm()">＋ 新增节点</button>
        </div>
        <div v-if="loadingNodes" class="empty-block"><p>加载中…</p></div>
        <div v-else-if="nodeError" class="error-block">{{ nodeError }}</div>
        <div v-else-if="!nodes.length" class="empty-block"><p>📭 暂无学位节点</p></div>
        <table v-else class="data-table">
          <thead>
            <tr>
              <th style="width:70px">顺序</th>
              <th>节点名称</th>
              <th>要求</th>
              <th>节点说明</th>
              <th class="col-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="n in nodes" :key="n.id">
              <td>{{ n.node_order }}</td>
              <td>{{ n.name }}</td>
              <td>
                <span class="tag" :class="n.is_required === 1 ? 'tag-req' : 'tag-opt'">
                  {{ n.is_required === 1 ? '必达' : '选做' }}
                </span>
              </td>
              <td class="cell-remark">{{ n.description || '-' }}</td>
              <td class="col-actions">
                <button class="btn btn-ghost" @click="openNodeForm(n)">编辑</button>
                <button class="btn btn-danger" @click="askRemoveNode(n)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 学生学位记录 Tab -->
      <div v-else class="card">
        <div class="card-header">
          <div class="filter-row">
            <label class="filter-label">学生</label>
            <select v-model="recordStudentId" class="form-input form-inline" @change="loadRecords">
              <option :value="''">全部学生</option>
              <option v-for="s in myStudents" :key="s.student_id" :value="s.student_id">
                {{ s.student_username || ('#' + s.student_id) }}
              </option>
            </select>
            <span v-if="!myStudents.length" class="filter-empty">当前课题组暂无学生成员</span>
          </div>
          <button class="btn btn-primary" @click="openRecordForm()">＋ 保存记录</button>
        </div>
        <div v-if="loadingRecords" class="empty-block"><p>加载中…</p></div>
        <div v-else-if="recordError" class="error-block">{{ recordError }}</div>
        <div v-else-if="!records.length" class="empty-block"><p>📭 暂无学位记录</p></div>
        <table v-else class="data-table">
          <thead>
            <tr>
              <th>学生</th>
              <th>学位节点</th>
              <th>状态</th>
              <th>完成日期</th>
              <th>成绩</th>
              <th>备注</th>
              <th class="col-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in records" :key="r.id">
              <td>{{ studentName(r.student_id) }}</td>
              <td>{{ nodeName(r.node_id) }}</td>
              <td>
                <span class="status" :class="'st-' + r.status">{{ recordStatusText(r.status) }}</span>
              </td>
              <td>{{ r.complete_date || '-' }}</td>
              <td>{{ r.score != null ? r.score : '-' }}</td>
              <td class="cell-remark">{{ r.remark || '-' }}</td>
              <td class="col-actions">
                <button class="btn btn-ghost" @click="openRecordForm(r)">编辑</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- 节点表单弹窗 -->
    <div v-if="nodeFormVisible" class="modal-mask" @click.self="nodeFormVisible = false">
      <div class="modal-box">
        <h3 class="modal-title">{{ nodeForm.id ? '编辑节点' : '新增节点' }}</h3>
        <div class="form-item">
          <label class="form-label">节点名称 <span class="req">*</span></label>
          <input v-model="nodeForm.name" class="form-input" maxlength="100" placeholder="如：开题报告" />
        </div>
        <div class="form-item">
          <label class="form-label">顺序（数值小在前）</label>
          <input v-model.number="nodeForm.node_order" type="number" min="0" class="form-input" />
        </div>
        <div class="form-item">
          <label class="check-label">
            <input type="checkbox" v-model="nodeForm.is_requiredBool" />
            必达节点
          </label>
        </div>
        <div class="form-item">
          <label class="form-label">节点说明 / 考核要求</label>
          <textarea v-model="nodeForm.description" class="form-textarea" rows="4" placeholder="选填"></textarea>
        </div>
        <p v-if="nodeFormError" class="form-error">{{ nodeFormError }}</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="nodeFormVisible = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="onSaveNode">
            {{ saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 删除节点确认 -->
    <div v-if="removeNodeTarget" class="modal-mask" @click.self="removeNodeTarget = null">
      <div class="modal-box">
        <p class="modal-text">确定删除节点「{{ removeNodeTarget.name }}」吗？</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="removeNodeTarget = null">取消</button>
          <button class="btn btn-danger" :disabled="removing" @click="onRemoveNode">
            {{ removing ? '删除中…' : '确认删除' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 学位记录表单弹窗 -->
    <div v-if="recordFormVisible" class="modal-mask" @click.self="recordFormVisible = false">
      <div class="modal-box">
        <h3 class="modal-title">学生学位记录</h3>
        <div class="form-item">
          <label class="form-label">学生 <span class="req">*</span></label>
          <select v-model="recordForm.student_id" class="form-input">
            <option :value="null" disabled>请选择学生</option>
            <option v-if="!myStudents.length" :value="null" disabled>当前课题组暂无学生成员</option>
            <option v-for="s in myStudents" :key="s.student_id" :value="s.student_id">
              {{ s.student_username || ('#' + s.student_id) }}
            </option>
          </select>
        </div>
        <div class="form-item">
          <label class="form-label">学位节点 <span class="req">*</span></label>
          <select v-model="recordForm.node_id" class="form-input">
            <option :value="null" disabled>请选择节点</option>
            <option v-for="n in nodes" :key="n.id" :value="n.id">{{ n.name }}</option>
          </select>
        </div>
        <div class="form-item">
          <label class="form-label">状态</label>
          <select v-model="recordForm.status" class="form-input">
            <option value="not_started">未开始</option>
            <option value="in_progress">进行中</option>
            <option value="completed">已完成</option>
            <option value="failed">未通过</option>
          </select>
        </div>
        <div class="form-item">
          <label class="form-label">完成日期</label>
          <input v-model="recordForm.complete_date" type="date" class="form-input" />
        </div>
        <div class="form-item">
          <label class="form-label">成绩</label>
          <input v-model="recordForm.score" type="number" step="0.01" min="0" max="999" class="form-input" placeholder="选填" />
        </div>
        <div class="form-item">
          <label class="form-label">备注</label>
          <input v-model="recordForm.remark" class="form-input" maxlength="500" />
        </div>
        <p v-if="recordFormError" class="form-error">{{ recordFormError }}</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="recordFormVisible = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="onSaveRecord">
            {{ saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'
import { ref, watch, onMounted } from 'vue'
import {
  listDegreeNodes, saveDegreeNode, removeDegreeNode,
  listDegreeRecords, saveDegreeRecord, listGroupStudents
} from '../../api'
import { useGroupContext } from '../../composables/useGroupContext'

const { currentGroupId, loadGroups } = useGroupContext()

const tab = ref('nodes')

// 节点
const nodes = ref([])
const loadingNodes = ref(false)
const nodeError = ref('')
const nodeFormVisible = ref(false)
const nodeForm = ref({ id: null, name: '', node_order: 0, is_requiredBool: true, description: '' })
const nodeFormError = ref('')
const removeNodeTarget = ref(null)

// 记录
const records = ref([])
const myStudents = ref([])
const loadingRecords = ref(false)
const recordError = ref('')
const recordStudentId = ref('')
const recordFormVisible = ref(false)
const recordForm = ref({ student_id: null, node_id: null, status: 'not_started', complete_date: '', score: '', remark: '' })
const recordFormError = ref('')

const saving = ref(false)
const removing = ref(false)

const RECORD_STATUS_TEXT = { not_started: '未开始', in_progress: '进行中', completed: '已完成', failed: '未通过' }
function recordStatusText(s) { return RECORD_STATUS_TEXT[s] || s || '-' }

function nodeName(id) {
  const n = nodes.value.find((x) => x.id === id)
  return n ? n.name : ('#' + id)
}
function studentName(id) {
  const s = myStudents.value.find((x) => x.student_id === id)
  return s ? (s.student_username || ('#' + id)) : ('#' + id)
}

async function loadNodes() {
  if (!currentGroupId.value) { nodes.value = []; return }
  loadingNodes.value = true
  nodeError.value = ''
  try {
    const res = await listDegreeNodes(currentGroupId.value)
    if (res && res.success) {
      nodes.value = res.data || []
    } else {
      nodes.value = []
      nodeError.value = (res && res.message) || '加载失败'
    }
  } catch (e) {
    nodes.value = []
    nodeError.value = '网络错误，加载失败'
  } finally {
    loadingNodes.value = false
  }
}

function openNodeForm(n) {
  nodeForm.value = n
    ? { id: n.id, name: n.name, node_order: n.node_order, is_requiredBool: n.is_required === 1, description: n.description || '' }
    : { id: null, name: '', node_order: nodes.value.length + 1, is_requiredBool: true, description: '' }
  nodeFormError.value = ''
  nodeFormVisible.value = true
}

async function onSaveNode() {
  if (!nodeForm.value.name.trim()) { nodeFormError.value = '节点名称不能为空'; return }
  saving.value = true
  nodeFormError.value = ''
  const payload = {
    group_id: currentGroupId.value,
    name: nodeForm.value.name.trim(),
    node_order: Number(nodeForm.value.node_order) || 0,
    description: nodeForm.value.description,
    is_required: nodeForm.value.is_requiredBool ? 1 : 0
  }
  if (nodeForm.value.id) payload.id = nodeForm.value.id
  try {
    const res = await saveDegreeNode(payload)
    if (res && res.success) {
      nodeFormVisible.value = false
      loadNodes()
    } else {
      nodeFormError.value = (res && res.message) || '保存失败'
    }
  } catch (e) {
    nodeFormError.value = '网络错误，保存失败'
  } finally {
    saving.value = false
  }
}

function askRemoveNode(n) { removeNodeTarget.value = n }
async function onRemoveNode() {
  removing.value = true
  try {
    const res = await removeDegreeNode(removeNodeTarget.value.id)
    if (res && res.success) {
      removeNodeTarget.value = null
      loadNodes()
    } else {
      dialogAlert((res && res.message) || '删除失败')
    }
  } catch (e) {
    dialogAlert('网络错误，删除失败')
  } finally {
    removing.value = false
  }
}

async function loadStudents() {
  try {
    const res = await listGroupStudents({ group_id: currentGroupId.value })
    if (res && res.success) myStudents.value = res.students || []
  } catch (e) { /* 不阻断 */ }
}

async function loadRecords() {
  if (!currentGroupId.value) { records.value = []; return }
  loadingRecords.value = true
  recordError.value = ''
  try {
    const payload = { group_id: currentGroupId.value }
    if (recordStudentId.value) payload.student_id = recordStudentId.value
    const res = await listDegreeRecords(payload)
    if (res && res.success) {
      records.value = res.data || []
    } else {
      records.value = []
      recordError.value = (res && res.message) || '加载失败'
    }
  } catch (e) {
    records.value = []
    recordError.value = '网络错误，加载失败'
  } finally {
    loadingRecords.value = false
  }
}

function switchRecords() {
  tab.value = 'records'
  loadRecords()
}

function openRecordForm(r) {
  recordForm.value = r
    ? {
        student_id: r.student_id, node_id: r.node_id, status: r.status || 'not_started',
        complete_date: r.complete_date || '', score: r.score != null ? String(r.score) : '', remark: r.remark || ''
      }
    : { student_id: recordStudentId.value || null, node_id: null, status: 'not_started', complete_date: '', score: '', remark: '' }
  recordFormError.value = ''
  recordFormVisible.value = true
}

async function onSaveRecord() {
  if (!recordForm.value.student_id) { recordFormError.value = '请选择学生'; return }
  if (!recordForm.value.node_id) { recordFormError.value = '请选择学位节点'; return }
  saving.value = true
  recordFormError.value = ''
  const payload = {
    group_id: currentGroupId.value,
    student_id: recordForm.value.student_id,
    node_id: recordForm.value.node_id,
    status: recordForm.value.status,
    complete_date: recordForm.value.complete_date || undefined,
    score: recordForm.value.score === '' ? undefined : recordForm.value.score,
    remark: recordForm.value.remark
  }
  try {
    const res = await saveDegreeRecord(payload)
    if (res && res.success) {
      recordFormVisible.value = false
      loadRecords()
    } else {
      recordFormError.value = (res && res.message) || '保存失败'
    }
  } catch (e) {
    recordFormError.value = '网络错误，保存失败'
  } finally {
    saving.value = false
  }
}

watch(currentGroupId, () => {
  loadNodes()
  loadStudents()
  if (tab.value === 'records') loadRecords()
})

onMounted(() => {
  loadGroups()
  loadNodes()
  loadStudents()
})
</script>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.page-title { font-size: 18px; font-weight: 600; color: #1f2329; margin: 0; }
.ph-right { display: flex; align-items: center; gap: 10px; }

.tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.tab {
  height: 34px; padding: 0 18px; border-radius: 8px; cursor: pointer;
  border: 1px solid #dfe3e8; background: #fff; font-size: 13px; color: #4e5969;
}
.tab.active {
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  color: #fff; border: none; font-weight: 600;
}

.card {
  background: #fff; border: 1px solid #eceff3; border-radius: 12px;
  box-shadow: 0 1px 3px rgba(16, 24, 40, 0.04); overflow: hidden;
}
.card-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; border-bottom: 1px solid #eceff3;
}
.card-desc { font-size: 13px; color: #8a9099; }
.filter-row { display: flex; align-items: center; gap: 8px; }
.filter-label { font-size: 13px; color: #4e5969; }
.filter-empty { font-size: 12px; color: #8a9099; }
.empty-block { padding: 48px 20px; text-align: center; color: #8a9099; font-size: 14px; }
.error-block { padding: 24px; text-align: center; color: #ea4335; font-size: 14px; }

.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th {
  background: #f7f9fc; color: #4e5969; font-weight: 600;
  text-align: left; padding: 10px 12px; border-bottom: 1px solid #eceff3;
}
.data-table td { padding: 10px 12px; border-bottom: 1px solid #eceff3; color: #1f2329; }
.data-table tbody tr:nth-child(even) { background: #fafbfc; }
.data-table tbody tr:hover { background: #eef6ff; }
.col-actions { white-space: nowrap; text-align: right; }
.cell-remark { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #4e5969; }

.tag { padding: 2px 8px; border-radius: 6px; font-size: 12px; }
.tag-req { background: #e6f4ff; color: #0d80e0; }
.tag-opt { background: #f2f3f5; color: #4e5969; }
.status { font-size: 12px; }
.st-not_started { color: #8a9099; }
.st-in_progress { color: #0d80e0; }
.st-completed { color: #19a558; }
.st-failed { color: #ea4335; }

.btn {
  height: 30px; padding: 0 12px; border-radius: 8px; font-size: 13px;
  cursor: pointer; border: 1px solid #dfe3e8; background: #fff; color: #1f2329;
}
.btn + .btn { margin-left: 6px; }
.btn-primary { background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%); border: none; color: #fff; font-weight: 600; height: 32px; }
.btn-ghost { background: #fff; color: #4e5969; }
.btn-ghost:hover { border-color: #0d80e0; color: #0d80e0; }
.btn-danger { background: #fff; color: #ea4335; border-color: #f5c6c2; }
.btn-danger:hover { background: #ea4335; color: #fff; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.modal-mask {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal-box {
  background: #fff; border-radius: 12px; padding: 24px; width: 440px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18); max-height: 86vh; overflow-y: auto;
}
.modal-title { margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #1f2329; }
.modal-text { font-size: 15px; margin: 0 0 20px; color: #1f2329; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }

.form-item { margin-bottom: 14px; }
.form-label { display: block; font-size: 13px; color: #4e5969; margin-bottom: 6px; }
.req { color: #ea4335; }
.form-input {
  box-sizing: border-box; border: 1px solid #dfe3e8; border-radius: 8px;
  padding: 8px 10px; font-size: 13px; outline: none; color: #1f2329; background: #fff; height: 36px;
}
.form-inline { width: 200px; }
.form-textarea {
  width: 100%; box-sizing: border-box; border: 1px solid #dfe3e8; border-radius: 8px;
  padding: 8px 10px; font-size: 13px; outline: none; color: #1f2329; resize: vertical; font-family: inherit;
}
.form-input:focus, .form-textarea:focus { border-color: #0d80e0; }
.check-label { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #4e5969; cursor: pointer; }
.form-error { color: #ea4335; font-size: 13px; margin: 8px 0 0; }
</style>
