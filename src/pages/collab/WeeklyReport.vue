<template>
  <div class="page">
    <div class="page-head">
      <h3 class="page-title">周报管理</h3>
      <div class="head-actions">
        <button v-if="!isManager" class="btn btn-primary" @click="openCreate">提交本周周报</button>
      </div>
    </div>

    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th v-if="isManager">学生</th>
            <th>周次</th>
            <th>本周进展</th>
            <th>遇到问题</th>
            <th>下周计划</th>
            <th>状态</th>
            <th>导师打分</th>
            <th class="col-ops">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td :colspan="isManager ? 8 : 7" class="state">加载中…</td></tr>
          <tr v-else-if="!list.length"><td :colspan="isManager ? 8 : 7" class="state">暂无周报</td></tr>
          <tr v-for="row in list" :key="row.id" v-else>
            <td v-if="isManager">{{ studentName(row.student_id) }}</td>
            <td>{{ row.week_start }} ~ {{ row.week_end }}</td>
            <td class="cell-text">{{ (row.progress || '').slice(0, 40) }}{{ (row.progress || '').length > 40 ? '…' : '' }}</td>
            <td class="cell-text">{{ (row.issues || '').slice(0, 30) }}{{ (row.issues || '').length > 30 ? '…' : '' }}</td>
            <td class="cell-text">{{ (row.plan_next || '').slice(0, 30) }}{{ (row.plan_next || '').length > 30 ? '…' : '' }}</td>
            <td><span :class="['tag', statusClass(row.status)]">{{ statusLabel(row.status) }}</span></td>
            <td>{{ row.mentor_score != null ? row.mentor_score : '-' }}</td>
            <td class="col-ops">
              <button class="btn-link" @click="openDetail(row)">查看</button>
              <button v-if="isManager" class="btn-link" @click="openReview(row)">批注</button>
              <button v-if="isManager" class="btn-link" @click="toTask(row)">转待办</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 提交周报弹窗 -->
    <div v-if="formVisible" class="modal-mask" @click.self="formVisible = false">
      <div class="modal-box">
        <div class="modal-head">
          <h4>提交周报</h4>
          <button class="modal-close" @click="formVisible = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-item">
              <label class="form-label">本周一<span class="req"> *</span></label>
              <input v-model="form.week_start" type="date" class="form-input" />
            </div>
            <div class="form-item">
              <label class="form-label">本周日<span class="req"> *</span></label>
              <input v-model="form.week_end" type="date" class="form-input" />
            </div>
          </div>
          <div class="form-item">
            <label class="form-label">本周进展</label>
            <textarea v-model="form.progress" class="form-input" rows="4" placeholder="本周完成了什么…"></textarea>
          </div>
          <div class="form-item">
            <label class="form-label">遇到的问题</label>
            <textarea v-model="form.issues" class="form-input" rows="3" placeholder="遇到什么困难…"></textarea>
          </div>
          <div class="form-item">
            <label class="form-label">下周计划</label>
            <textarea v-model="form.plan_next" class="form-input" rows="3" placeholder="下周打算做什么…"></textarea>
          </div>
          <p v-if="formError" class="form-error">{{ formError }}</p>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="formVisible = false">取消</button>
          <button class="btn btn-primary" @click="submit" :disabled="saving">{{ saving ? '提交中…' : '提交' }}</button>
        </div>
      </div>
    </div>

    <!-- 详情弹窗 -->
    <div v-if="detailVisible" class="modal-mask" @click.self="detailVisible = false">
      <div class="modal-box">
        <div class="modal-head">
          <h4>周报详情（{{ current.week_start }} ~ {{ current.week_end }}）</h4>
          <button class="modal-close" @click="detailVisible = false">×</button>
        </div>
        <div class="modal-body">
          <p class="detail-label">本周进展</p>
          <p class="detail-text">{{ current.progress || '（无）' }}</p>
          <p class="detail-label">遇到问题</p>
          <p class="detail-text">{{ current.issues || '（无）' }}</p>
          <p class="detail-label">下周计划</p>
          <p class="detail-text">{{ current.plan_next || '（无）' }}</p>
          <div v-if="current.mentor_comment" class="mentor-box">
            <p class="detail-label">导师批注（{{ current.mentor_score != null ? '打分：' + current.mentor_score : '' }}）</p>
            <p class="detail-text">{{ current.mentor_comment }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 批注弹窗 -->
    <div v-if="reviewVisible" class="modal-mask" @click.self="reviewVisible = false">
      <div class="modal-box">
        <div class="modal-head">
          <h4>批注周报</h4>
          <button class="modal-close" @click="reviewVisible = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-item">
            <label class="form-label">打分（0-100）</label>
            <input v-model.number="reviewScore" type="number" min="0" max="100" class="form-input" />
          </div>
          <div class="form-item">
            <label class="form-label">批注内容</label>
            <textarea v-model="reviewComment" class="form-input" rows="4" placeholder="给学生的评语…"></textarea>
          </div>
          <p v-if="reviewError" class="form-error">{{ reviewError }}</p>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="reviewVisible = false">取消</button>
          <button class="btn btn-primary" @click="submitReview" :disabled="reviewSaving">{{ reviewSaving ? '提交中…' : '提交批注' }}</button>
        </div>
      </div>
    </div>

    <!-- 转待办弹窗 -->
    <div v-if="taskVisible" class="modal-mask" @click.self="taskVisible = false">
      <div class="modal-box">
        <div class="modal-head">
          <h4>转为待办任务</h4>
          <button class="modal-close" @click="taskVisible = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-item">
            <label class="form-label">任务标题<span class="req"> *</span></label>
            <input v-model="taskTitle" class="form-input" />
          </div>
          <div class="form-item">
            <label class="form-label">截止日期（可选）</label>
            <input v-model="taskDue" type="date" class="form-input" />
          </div>
          <p v-if="taskError" class="form-error">{{ taskError }}</p>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="taskVisible = false">取消</button>
          <button class="btn btn-primary" @click="submitTask" :disabled="taskSaving">{{ taskSaving ? '创建中…' : '创建任务' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { collab, listMembers } from '../../api'
import { WEEKLY_REPORT_STATUS_OPTIONS } from '../../config/fieldOptions'
import { useRole } from '../../composables/useRole'
import { dialogAlert } from '../../composables/useDialog'

const { isManager } = useRole()
const list = ref([])
const members = ref([])
const loading = ref(false)

const formVisible = ref(false)
const form = ref({})
const formError = ref('')
const saving = ref(false)

const detailVisible = ref(false)
const current = ref({})

const reviewVisible = ref(false)
const reviewTarget = ref(null)
const reviewScore = ref(null)
const reviewComment = ref('')
const reviewError = ref('')
const reviewSaving = ref(false)

const taskVisible = ref(false)
const taskTarget = ref(null)
const taskTitle = ref('')
const taskDue = ref('')
const taskError = ref('')
const taskSaving = ref(false)

function statusLabel(v) {
  const o = WEEKLY_REPORT_STATUS_OPTIONS.find((x) => x.value === v)
  return o ? o.label : (v || '-')
}
function statusClass(v) {
  return { draft: 'tag-gray', submitted: 'tag-blue', reviewed: 'tag-green', archived: 'tag-gray' }[v] || 'tag-gray'
}
function studentName(id) {
  const m = members.value.find((x) => x.id === id)
  return m ? (m.real_name || m.username) : id
}

async function load() {
  loading.value = true
  try {
    const res = await collab.weeklyReport.list()
    list.value = res && res.success ? res.list || [] : []
  } catch (e) {
    list.value = []
  } finally {
    loading.value = false
  }
}

function openCreate() {
  const now = new Date()
  const day = now.getDay() || 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + 1)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (d) => d.toISOString().slice(0, 10)
  form.value = { week_start: fmt(monday), week_end: fmt(sunday), progress: '', issues: '', plan_next: '' }
  formError.value = ''
  formVisible.value = true
}

async function submit() {
  formError.value = ''
  if (!form.value.week_start || !form.value.week_end) {
    formError.value = '请选择周次'
    return
  }
  saving.value = true
  try {
    const payload = {
      week_start: form.value.week_start,
      week_end: form.value.week_end,
      progress: form.value.progress || '',
      issues: form.value.issues || '',
      plan_next: form.value.plan_next || '',
      status: 'submitted'
    }
    const res = await collab.weeklyReport.create(payload)
    if (res && res.success) {
      formVisible.value = false
      await load()
    } else {
      formError.value = (res && res.message) || '提交失败'
    }
  } catch (e) {
    formError.value = '提交过程出现异常，请重试'
  } finally {
    saving.value = false
  }
}

function openDetail(row) {
  current.value = row
  detailVisible.value = true
}

function openReview(row) {
  reviewTarget.value = row
  reviewScore.value = row.mentor_score != null ? row.mentor_score : null
  reviewComment.value = row.mentor_comment || ''
  reviewError.value = ''
  reviewVisible.value = true
}

async function submitReview() {
  reviewError.value = ''
  reviewSaving.value = true
  try {
    const res = await collab.reviewReport(reviewTarget.value.id, reviewComment.value, reviewScore.value)
    if (res && res.success) {
      reviewVisible.value = false
      await load()
    } else {
      reviewError.value = (res && res.message) || '批注失败'
    }
  } catch (e) {
    reviewError.value = '批注过程出现异常，请重试'
  } finally {
    reviewSaving.value = false
  }
}

function toTask(row) {
  taskTarget.value = row
  taskTitle.value = `周报事项：${row.week_start}`
  taskDue.value = ''
  taskError.value = ''
  taskVisible.value = true
}

async function submitTask() {
  taskError.value = ''
  if (!taskTitle.value || !taskTitle.value.trim()) {
    taskError.value = '请填写任务标题'
    return
  }
  taskSaving.value = true
  try {
    const res = await collab.reportToTask(taskTarget.value.id, taskTitle.value.trim(), taskTarget.value.student_id, taskDue.value || null)
    if (res && res.success) {
      taskVisible.value = false
      await dialogAlert('已创建待办任务')
    } else {
      taskError.value = (res && res.message) || '创建失败'
    }
  } catch (e) {
    taskError.value = '创建过程出现异常，请重试'
  } finally {
    taskSaving.value = false
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
.page { background: #fff; border: 1px solid #eceff3; border-radius: 12px; padding: 16px 18px; }
.page-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.page-title { margin: 0; font-size: 16px; font-weight: 600; }
.head-actions { display: flex; gap: 8px; }
.btn { height: 34px; padding: 0 16px; font-size: 13px; border: 1px solid #dfe3e8; border-radius: 8px; background: #fff; color: #4e5969; cursor: pointer; }
.btn-primary { border: none; background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%); color: #fff; font-weight: 600; }
.btn-primary:disabled { opacity: 0.6; }
.table-wrap { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th, .data-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #eceff3; }
.data-table th { background: #f5f7fa; color: #4e5969; font-weight: 600; }
.state { text-align: center; color: #8a9099; padding: 32px 0; }
.col-ops { width: 180px; }
.btn-link { border: none; background: none; color: #0d80e0; font-size: 13px; cursor: pointer; padding: 0 6px; }
.cell-text { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
.tag-gray { background: #f2f3f5; color: #86909c; }
.tag-blue { background: #e8f3ff; color: #0d80e0; }
.tag-green { background: #e8ffea; color: #19a558; }
.modal-mask { position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; }
.modal-box { width: 520px; max-width: 92vw; max-height: 85vh; background: #fff; border-radius: 12px; display: flex; flex-direction: column; }
.modal-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #eceff3; }
.modal-head h4 { margin: 0; font-size: 16px; font-weight: 600; }
.modal-close { width: 28px; height: 28px; border: none; border-radius: 8px; background: #f2f3f5; color: #4e5969; font-size: 20px; cursor: pointer; }
.modal-body { padding: 16px 20px; overflow-y: auto; }
.modal-foot { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 20px; border-top: 1px solid #eceff3; }
.form-item { margin-bottom: 12px; }
.form-row { display: flex; gap: 12px; }
.form-row .form-item { flex: 1; }
.form-label { display: block; font-size: 13px; color: #4e5969; margin-bottom: 6px; }
.req { color: #ea4335; }
.form-input { width: 100%; min-height: 36px; padding: 8px 10px; font-size: 13px; border: 1px solid #dfe3e8; border-radius: 8px; outline: none; box-sizing: border-box; }
.form-error { margin: 8px 0 0; font-size: 13px; color: #ea4335; }
.detail-label { font-size: 13px; font-weight: 600; color: #4e5969; margin: 12px 0 4px; }
.detail-text { font-size: 13px; line-height: 1.7; color: #1f2329; white-space: pre-wrap; margin: 0; }
.mentor-box { margin-top: 16px; padding: 12px; background: #f6ffed; border-radius: 8px; border-left: 3px solid #19a558; }
</style>
