<template>
  <div class="page">
    <!-- 页头 -->
    <div class="page-head card">
      <div>
        <h2 class="page-title">📝 科研记录</h2>
        <p class="page-desc">维护个人科研日志与每周周报，周报提交后不可再编辑。</p>
      </div>
      <div class="head-actions">
        <button v-if="tab === 'log'" class="btn primary" @click="openLogModal()">＋ 写日志</button>
        <button v-else class="btn primary" @click="openWeeklyModal()">＋ 写周报</button>
      </div>
    </div>

    <!-- Tab 切换 -->
    <div class="tabs">
      <button class="tab" :class="{ active: tab === 'log' }" @click="switchTab('log')">科研日志</button>
      <button class="tab" :class="{ active: tab === 'weekly' }" @click="switchTab('weekly')">周报</button>
    </div>

    <!-- 科研日志 -->
    <div v-show="tab === 'log'" class="card">
      <div v-if="logLoading" class="state">加载中…</div>
      <div v-else-if="logError" class="state error">{{ logError }}</div>
      <div v-else-if="!logs.length" class="state">暂无科研日志，点击右上角「写日志」开始记录。</div>
      <table v-else class="tbl">
        <thead>
          <tr><th>日期</th><th>标签</th><th>内容</th><th>创建时间</th><th style="width:140px">操作</th></tr>
        </thead>
        <tbody>
          <tr v-for="item in logs" :key="item.id">
            <td class="nowrap">{{ item.log_date }}</td>
            <td>
              <span v-if="item.tags" class="tag">{{ item.tags }}</span>
              <span v-else class="muted">—</span>
            </td>
            <td class="content-cell">{{ item.content || '—' }}</td>
            <td class="nowrap muted">{{ fmtTime(item.created_at) }}</td>
            <td>
              <button class="link" @click="openLogModal(item)">编辑</button>
              <button class="link danger" @click="onRemoveLog(item)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 周报 -->
    <div v-show="tab === 'weekly'" class="card">
      <div v-if="weeklyLoading" class="state">加载中…</div>
      <div v-else-if="weeklyError" class="state error">{{ weeklyError }}</div>
      <div v-else-if="!weeklies.length" class="state">暂无周报，点击右上角「写周报」创建草稿。</div>
      <table v-else class="tbl">
        <thead>
          <tr><th>周次</th><th>本周工作</th><th>下周计划</th><th>状态</th><th>提交时间</th><th style="width:170px">操作</th></tr>
        </thead>
        <tbody>
          <tr v-for="item in weeklies" :key="item.id">
            <td class="nowrap">{{ item.week_start }} ~ {{ item.week_end }}</td>
            <td class="content-cell">{{ item.work_content || '—' }}</td>
            <td class="content-cell">{{ item.plan_content || '—' }}</td>
            <td><span class="badge" :class="statusClass(item.status)">{{ statusText(item.status) }}</span></td>
            <td class="nowrap muted">{{ item.submitted_at ? fmtTime(item.submitted_at) : '—' }}</td>
            <td>
              <button v-if="item.status === 'draft'" class="link" @click="openWeeklyModal(item)">编辑</button>
              <button v-if="item.status === 'draft'" class="link primary-link" @click="onSubmitWeekly(item)">提交</button>
              <span v-else class="muted">已锁定</span>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="reviewTip" class="review-tip">{{ reviewTip }}</div>
    </div>

    <!-- 日志弹窗 -->
    <div v-if="logModal.show" class="modal-mask" @click.self="logModal.show = false">
      <div class="modal-box wide">
        <h3 class="modal-title">{{ logModal.form.id ? '编辑科研日志' : '写科研日志' }}</h3>
        <label class="form-item">
          <span class="form-label">日志日期 <i>*</i></span>
          <input type="date" v-model="logModal.form.log_date" />
        </label>
        <label class="form-item">
          <span class="form-label">标签</span>
          <input type="text" v-model="logModal.form.tags" placeholder="多个标签用逗号分隔，如 实验,阅读" />
        </label>
        <label class="form-item">
          <span class="form-label">日志内容 <i>*</i></span>
          <textarea rows="5" v-model="logModal.form.content" placeholder="记录今日研究进展 / 问题 / 思考"></textarea>
        </label>
        <p v-if="logModal.error" class="form-error">{{ logModal.error }}</p>
        <div class="modal-actions">
          <button class="btn" @click="logModal.show = false">取消</button>
          <button class="btn primary" :disabled="logModal.saving" @click="onSaveLog">
            {{ logModal.saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 周报弹窗 -->
    <div v-if="weeklyModal.show" class="modal-mask" @click.self="weeklyModal.show = false">
      <div class="modal-box wide">
        <h3 class="modal-title">{{ weeklyModal.form.id ? '编辑周报草稿' : '写周报草稿' }}</h3>
        <div class="form-row">
          <label class="form-item">
            <span class="form-label">周起始（周一）<i>*</i></span>
            <input type="date" v-model="weeklyModal.form.week_start" />
          </label>
          <label class="form-item">
            <span class="form-label">周结束（周日）<i>*</i></span>
            <input type="date" v-model="weeklyModal.form.week_end" />
          </label>
        </div>
        <label class="form-item">
          <span class="form-label">本周完成工作</span>
          <textarea rows="4" v-model="weeklyModal.form.work_content"></textarea>
        </label>
        <label class="form-item">
          <span class="form-label">下周计划</span>
          <textarea rows="3" v-model="weeklyModal.form.plan_content"></textarea>
        </label>
        <label class="form-item">
          <span class="form-label">遇到的问题 / 求助</span>
          <textarea rows="2" v-model="weeklyModal.form.problem_content"></textarea>
        </label>
        <p v-if="weeklyModal.error" class="form-error">{{ weeklyModal.error }}</p>
        <div class="modal-actions">
          <button class="btn" @click="weeklyModal.show = false">取消</button>
          <button class="btn primary" :disabled="weeklyModal.saving" @click="onSaveWeekly">
            {{ weeklyModal.saving ? '保存中…' : '保存草稿' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import {
  listMyResearchLogs, createResearchLog, updateResearchLog, removeResearchLog,
  listMyWeeklyReports, createWeeklyReport, updateWeeklyReport, submitWeeklyReport
} from '../../api'

const tab = ref('log')

// ===== 科研日志 =====
const logs = ref([])
const logLoading = ref(false)
const logError = ref('')

const logModal = ref({
  show: false, saving: false, error: '',
  form: { id: null, log_date: '', content: '', tags: '' }
})

async function loadLogs() {
  logLoading.value = true
  logError.value = ''
  try {
    const res = await listMyResearchLogs()
    if (res && res.success) logs.value = res.data || []
    else logError.value = (res && res.message) || '加载失败'
  } catch (e) {
    logError.value = '网络异常，请重试'
  } finally {
    logLoading.value = false
  }
}

function openLogModal(item) {
  logModal.value.error = ''
  if (item) {
    logModal.value.form = { id: item.id, log_date: item.log_date || '', content: item.content || '', tags: item.tags || '' }
  } else {
    logModal.value.form = { id: null, log_date: today(), content: '', tags: '' }
  }
  logModal.value.show = true
}

async function onSaveLog() {
  const f = logModal.value.form
  if (!f.log_date) { logModal.value.error = '请选择日志日期'; return }
  if (!f.content || !f.content.trim()) { logModal.value.error = '日志内容不能为空'; return }
  logModal.value.saving = true
  logModal.value.error = ''
  try {
    const res = f.id ? await updateResearchLog(f) : await createResearchLog(f)
    if (res && res.success) {
      logModal.value.show = false
      await loadLogs()
    } else {
      logModal.value.error = (res && res.message) || '保存失败'
    }
  } catch (e) {
    logModal.value.error = '网络异常，请重试'
  } finally {
    logModal.value.saving = false
  }
}

async function onRemoveLog(item) {
  if (!window.confirm(`确定删除 ${item.log_date} 的科研日志吗？`)) return
  const res = await removeResearchLog(item.id)
  if (res && res.success) await loadLogs()
  else alert((res && res.message) || '删除失败')
}

// ===== 周报 =====
const weeklies = ref([])
const weeklyLoading = ref(false)
const weeklyError = ref('')
const reviewTip = ref('')

const weeklyModal = ref({
  show: false, saving: false, error: '',
  form: { id: null, week_start: '', week_end: '', work_content: '', plan_content: '', problem_content: '' }
})

async function loadWeekly() {
  weeklyLoading.value = true
  weeklyError.value = ''
  try {
    const res = await listMyWeeklyReports()
    if (res && res.success) {
      weeklies.value = res.data || []
      reviewTip.value = weeklies.value.find(w => w.status === 'reviewed' && w.review_comment)?.review_comment || ''
    } else {
      weeklyError.value = (res && res.message) || '加载失败'
    }
  } catch (e) {
    weeklyError.value = '网络异常，请重试'
  } finally {
    weeklyLoading.value = false
  }
}

function openWeeklyModal(item) {
  weeklyModal.value.error = ''
  if (item) {
    weeklyModal.value.form = {
      id: item.id, week_start: item.week_start || '', week_end: item.week_end || '',
      work_content: item.work_content || '', plan_content: item.plan_content || '',
      problem_content: item.problem_content || ''
    }
  } else {
    weeklyModal.value.form = {
      id: null, week_start: '', week_end: '',
      work_content: '', plan_content: '', problem_content: ''
    }
  }
  weeklyModal.value.show = true
}

async function onSaveWeekly() {
  const f = weeklyModal.value.form
  if (!f.week_start || !f.week_end) { weeklyModal.value.error = '请选择周起始与结束日期'; return }
  weeklyModal.value.saving = true
  weeklyModal.value.error = ''
  try {
    const res = f.id ? await updateWeeklyReport(f) : await createWeeklyReport(f)
    if (res && res.success) {
      weeklyModal.value.show = false
      await loadWeekly()
    } else {
      weeklyModal.value.error = (res && res.message) || '保存失败'
    }
  } catch (e) {
    weeklyModal.value.error = '网络异常，请重试'
  } finally {
    weeklyModal.value.saving = false
  }
}

async function onSubmitWeekly(item) {
  if (!window.confirm('提交后周报将不可再编辑，确定提交吗？')) return
  const res = await submitWeeklyReport(item.id)
  if (res && res.success) await loadWeekly()
  else alert((res && res.message) || '提交失败')
}

function switchTab(t) {
  tab.value = t
  if (t === 'log' && !logs.value.length && !logLoading.value) loadLogs()
  if (t === 'weekly' && !weeklies.value.length && !weeklyLoading.value) loadWeekly()
}

function statusText(s) {
  return { draft: '草稿', submitted: '已提交', reviewed: '已批阅' }[s] || s
}
function statusClass(s) {
  return { draft: 'b-gray', submitted: 'b-blue', reviewed: 'b-green' }[s] || 'b-gray'
}
function fmtTime(t) {
  if (!t) return ''
  return String(t).replace('T', ' ').slice(0, 16)
}
function today() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

loadLogs()
loadWeekly()
</script>

<style scoped>
.page { display: flex; flex-direction: column; gap: 16px; }
.card {
  background: #fff; border-radius: 12px; padding: 18px 20px;
  border: 1px solid #eceff3; box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.page-head { display: flex; justify-content: space-between; align-items: center; }
.page-title { margin: 0; font-size: 18px; color: #1f2329; }
.page-desc { margin: 4px 0 0; font-size: 13px; color: #8a9099; }
.head-actions { display: flex; gap: 10px; }

.btn {
  height: 34px; padding: 0 16px; border-radius: 8px; font-size: 13px;
  border: 1px solid #dfe3e8; background: #fff; color: #4e5969; cursor: pointer;
}
.btn:hover { border-color: #0d80e0; color: #0d80e0; }
.btn.primary {
  background: linear-gradient(135deg, #0d80e0, #19a558);
  border: none; color: #fff; font-weight: 600;
}
.btn.primary:hover { opacity: 0.92; color: #fff; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.tabs { display: flex; gap: 8px; }
.tab {
  padding: 9px 20px; border-radius: 8px; cursor: pointer; font-size: 14px;
  border: 1px solid #eceff3; background: #fff; color: #4e5969;
}
.tab.active {
  background: linear-gradient(135deg, #0d80e0, #19a558);
  border-color: transparent; color: #fff; font-weight: 600;
}

.state { padding: 40px 0; text-align: center; color: #8a9099; font-size: 13px; }
.state.error { color: #ea4335; }

.tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.tbl th {
  background: #f7f9fc; text-align: left; padding: 10px 12px;
  border-bottom: 1px solid #eceff3; color: #4e5969; font-weight: 600;
}
.tbl td { padding: 10px 12px; border-bottom: 1px solid #eceff3; color: #1f2329; }
.tbl tbody tr:nth-child(even) { background: #fafbfc; }
.tbl tbody tr:hover { background: #eef6ff; }
.nowrap { white-space: nowrap; }
.muted { color: #8a9099; }
.content-cell {
  max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tag {
  display: inline-block; padding: 2px 10px; border-radius: 999px;
  background: #eef6ff; color: #0d80e0; font-size: 12px;
}

.badge { padding: 2px 10px; border-radius: 999px; font-size: 12px; }
.b-gray { background: #f2f3f5; color: #4e5969; }
.b-blue { background: #e6f4ff; color: #0d80e0; }
.b-green { background: #e8f7ef; color: #19a558; }

.link { background: none; border: none; color: #0d80e0; cursor: pointer; font-size: 13px; padding: 0 6px; }
.link:hover { text-decoration: underline; }
.link.danger { color: #ea4335; }
.review-tip { margin-top: 12px; padding: 10px 14px; background: #f6ffed; border: 1px solid #b7eb8f; border-radius: 8px; font-size: 13px; color: #19a558; }

.modal-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal-box {
  background: #fff; border-radius: 12px; padding: 24px; width: 420px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.18);
}
.modal-box.wide { width: 560px; }
.modal-title { margin: 0 0 18px; font-size: 16px; color: #1f2329; }
.form-item { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.form-row { display: flex; gap: 14px; }
.form-row .form-item { flex: 1; }
.form-label { font-size: 13px; color: #4e5969; }
.form-label i { color: #ea4335; font-style: normal; }
.form-item input, .form-item textarea {
  padding: 8px 10px; border: 1px solid #dfe3e8; border-radius: 8px;
  font-size: 13px; outline: none; font-family: inherit; resize: vertical;
}
.form-item input:focus, .form-item textarea:focus { border-color: #0d80e0; }
.form-error { color: #ea4335; font-size: 12px; margin: 0 0 10px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }
</style>
