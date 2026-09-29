<template>
  <div class="page">
    <!-- 页头 -->
    <div class="page-head card">
      <div class="header-left">
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
          <tr><th>日期</th><th>标签</th><th>内容</th><th>创建时间</th><th style="width:170px">操作</th></tr>
        </thead>
        <tbody>
          <tr v-for="item in logs" :key="item.id" class="row-clickable" @click="openLogDetail(item)">
            <td class="nowrap">{{ item.log_date }}</td>
            <td>
              <span v-if="item.tags" class="tag">{{ item.tags }}</span>
              <span v-else class="muted">—</span>
            </td>
            <td class="content-cell">{{ item.content || '—' }}</td>
            <td class="nowrap muted">{{ fmtTime(item.created_at) }}</td>
            <td @click.stop>
              <button class="link" @click="openLogDetail(item)">查看</button>
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
          <tr v-for="item in weeklies" :key="item.id" :class="{ 'row-focus': focusWeeklyId && item.id === focusWeeklyId }" class="row-clickable" @click="openWeeklyDetail(item)">
            <td class="nowrap">{{ item.week_start }} ~ {{ item.week_end }}</td>
            <td class="content-cell">{{ item.work_content || '—' }}</td>
            <td class="content-cell">{{ item.plan_content || '—' }}</td>
            <td><span class="badge" :class="statusClass(item.status)">{{ statusText(item.status) }}</span></td>
            <td class="nowrap muted">{{ item.submitted_at ? fmtTime(item.submitted_at) : '—' }}</td>
            <td @click.stop>
              <button class="link" @click="openWeeklyDetail(item)">查看</button>
              <button v-if="item.status === 'draft'" class="link" @click="openWeeklyModal(item)">编辑</button>
              <button v-if="item.status === 'draft'" class="link primary-link" @click="onSubmitWeekly(item)">提交</button>
              <span v-else class="muted">已锁定</span>
            </td>
          </tr>
        </tbody>
      </table>
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
          <textarea rows="5" maxlength="16000" v-model="logModal.form.content" placeholder="记录今日研究进展 / 问题 / 思考"></textarea>
          <span class="char-count">{{ logModal.form.content.length }}/16000</span>
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

    <!-- 日志详情弹窗：点击表格行弹出，展示日志完整内容 -->
    <div v-if="logDetail.show" class="modal-mask" @click.self="logDetail.show = false">
      <div class="modal-box wide detail-box">
        <h3 class="modal-title">科研日志详情</h3>
        <div class="detail">
          <p class="detail-line"><b>日期：</b>{{ logDetail.row.log_date }}</p>
          <p class="detail-line"><b>标签：</b>{{ logDetail.row.tags || '—' }}</p>
          <p class="detail-line"><b>创建时间：</b>{{ fmtTime(logDetail.row.created_at) }}</p>
          <p v-if="logDetail.row.updated_at && logDetail.row.updated_at !== logDetail.row.created_at" class="detail-line">
            <b>更新时间：</b>{{ fmtTime(logDetail.row.updated_at) }}
          </p>
          <div class="detail-block">
            <div class="detail-block-label">日志内容</div>
            <div class="detail-block-body">{{ logDetail.row.content || '—' }}</div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="logDetail.show = false">关闭</button>
          <button class="btn" @click="onLogDetailEdit">编辑</button>
          <button class="btn danger" @click="onLogDetailRemove">删除</button>
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
          <textarea rows="4" maxlength="16000" v-model="weeklyModal.form.work_content"></textarea>
          <span class="char-count">{{ weeklyModal.form.work_content.length }}/16000</span>
        </label>
        <label class="form-item">
          <span class="form-label">下周计划</span>
          <textarea rows="3" maxlength="16000" v-model="weeklyModal.form.plan_content"></textarea>
          <span class="char-count">{{ weeklyModal.form.plan_content.length }}/16000</span>
        </label>
        <label class="form-item">
          <span class="form-label">遇到的问题 / 求助</span>
          <textarea rows="2" maxlength="16000" v-model="weeklyModal.form.problem_content"></textarea>
          <span class="char-count">{{ weeklyModal.form.problem_content.length }}/16000</span>
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
    <!-- 周报详情弹窗：点击表格行弹出，展示周报完整内容与批阅意见 -->
    <div v-if="weeklyDetail.show" class="modal-mask" @click.self="weeklyDetail.show = false">
      <div class="modal-box wide detail-box">
        <h3 class="modal-title">周报详情</h3>
        <div class="detail">
          <p class="detail-line"><b>周次：</b>{{ weeklyDetail.row.week_start }} ~ {{ weeklyDetail.row.week_end }}</p>
          <p class="detail-line">
            <b>状态：</b>
            <span class="badge" :class="statusClass(weeklyDetail.row.status)">{{ statusText(weeklyDetail.row.status) }}</span>
          </p>
          <p class="detail-line"><b>提交时间：</b>{{ weeklyDetail.row.submitted_at ? fmtTime(weeklyDetail.row.submitted_at) : '—' }}</p>
          <div class="detail-block">
            <div class="detail-block-label">本周工作</div>
            <div class="detail-block-body">{{ weeklyDetail.row.work_content || '—' }}</div>
          </div>
          <div class="detail-block">
            <div class="detail-block-label">下周计划</div>
            <div class="detail-block-body">{{ weeklyDetail.row.plan_content || '—' }}</div>
          </div>
          <div class="detail-block">
            <div class="detail-block-label">遇到的问题 / 求助</div>
            <div class="detail-block-body">{{ weeklyDetail.row.problem_content || '—' }}</div>
          </div>
          <template v-if="weeklyDetail.row.status === 'reviewed'">
            <div class="detail-block review-block">
              <div class="detail-block-label">导师批阅意见</div>
              <div class="detail-block-body">{{ weeklyDetail.row.review_comment || '（未填写）' }}</div>
            </div>
            <p class="detail-line"><b>批阅时间：</b>{{ weeklyDetail.row.reviewed_at ? fmtTime(weeklyDetail.row.reviewed_at) : '—' }}</p>
          </template>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="weeklyDetail.show = false">关闭</button>
          <template v-if="weeklyDetail.row.status === 'draft'">
            <button class="btn" @click="onWeeklyDetailEdit">编辑</button>
            <button class="btn primary" @click="onWeeklyDetailSubmit">提交</button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  listMyResearchLogs, createResearchLog, updateResearchLog, removeResearchLog,
  listMyWeeklyReports, createWeeklyReport, updateWeeklyReport, submitWeeklyReport
} from '../../api'

const route = useRoute()
const tab = ref('log')

// 从站内消息跳转带入的定位参数：tab=weekly 直达周报 Tab，focus=周报 id 高亮对应行
const focusWeeklyId = ref(Number(route.query.focus) || 0)
if (route.query.tab === 'weekly') tab.value = 'weekly'

// ===== 科研日志 =====
const logs = ref([])
const logLoading = ref(false)
const logError = ref('')

const logModal = ref({
  show: false, saving: false, error: '',
  form: { id: null, log_date: '', content: '', tags: '' }
})

// 日志详情弹窗（点击表格行弹出，只读展示完整内容）
const logDetail = ref({ show: false, row: null })

function openLogDetail(item) {
  logDetail.value = { show: true, row: item }
}

function onLogDetailEdit() {
  const row = logDetail.value.row
  logDetail.value.show = false
  openLogModal(row)
}

async function onLogDetailRemove() {
  const row = logDetail.value.row
  logDetail.value.show = false
  await onRemoveLog(row)
}

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
    const res = f.id ? await updateResearchLog({ ...f }) : await createResearchLog({ ...f })
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
  if (!await dialogConfirm(`确定删除 ${item.log_date} 的科研日志吗？`)) return
  const res = await removeResearchLog(item.id)
  if (res && res.success) await loadLogs()
  else dialogAlert((res && res.message) || '删除失败')
}

// ===== 周报 =====
const weeklies = ref([])
const weeklyLoading = ref(false)
const weeklyError = ref('')

const weeklyModal = ref({
  show: false, saving: false, error: '',
  form: { id: null, week_start: '', week_end: '', work_content: '', plan_content: '', problem_content: '' }
})

// 周报详情弹窗（点击表格行弹出，只读展示完整内容与批阅意见）
const weeklyDetail = ref({ show: false, row: null })

function openWeeklyDetail(item) {
  weeklyDetail.value = { show: true, row: item }
}

function onWeeklyDetailEdit() {
  const row = weeklyDetail.value.row
  weeklyDetail.value.show = false
  openWeeklyModal(row)
}

async function onWeeklyDetailSubmit() {
  const row = weeklyDetail.value.row
  weeklyDetail.value.show = false
  await onSubmitWeekly(row)
}

async function loadWeekly() {
  weeklyLoading.value = true
  weeklyError.value = ''
  try {
    const res = await listMyWeeklyReports()
    if (res && res.success) {
      weeklies.value = res.data || []
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
    const res = f.id ? await updateWeeklyReport({ ...f }) : await createWeeklyReport({ ...f })
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
  if (!await dialogConfirm('提交后周报将不可再编辑，确定提交吗？')) return
  const res = await submitWeeklyReport(item.id)
  if (res && res.success) await loadWeekly()
  else dialogAlert((res && res.message) || '提交失败')
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
.header-left { display: flex; align-items: flex-end; gap: 14px; }
.page-title { margin: 0; font-size: 18px; color: #1f2329; }
.page-desc { margin: 0 0 3px; font-size: 13px; color: #8a9099; }
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
.row-clickable { cursor: pointer; }
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
.btn.danger { color: #ea4335; border-color: #ea4335; }
.btn.danger:hover { background: #ea4335; color: #fff; }
.row-focus { background: #fffbe6 !important; }

.modal-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal-box {
  background: #fff; border-radius: 12px; padding: 24px; width: 420px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.18);
}
.modal-box.wide { width: 560px; max-height: 86vh; overflow-y: auto; }
.modal-title { margin: 0 0 18px; font-size: 16px; color: #1f2329; }
.form-item { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.form-row { display: flex; gap: 14px; }
.form-row .form-item { flex: 1; }
.form-label { font-size: 13px; color: #4e5969; }
.form-label i { color: #ea4335; font-style: normal; }
.form-item input, .form-item textarea {
  padding: 8px 10px; border: 1px solid #dfe3e8; border-radius: 8px;
  font-size: 13px; outline: none; font-family: inherit; resize: vertical;
  max-height: 320px; /* 拖拽上限，避免输入框把弹窗撑得超出窗口高度 */
}
.form-item input:focus, .form-item textarea:focus { border-color: #0d80e0; }
.char-count { align-self: flex-end; font-size: 12px; color: #8a9099; }
.form-error { color: #ea4335; font-size: 12px; margin: 0 0 10px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }

.detail { background: #fafbfc; border: 1px solid #eceff3; border-radius: 10px; padding: 14px; margin-bottom: 14px; }
.detail-line { margin: 0 0 8px; font-size: 13px; color: #4e5969; line-height: 1.7; }
.detail-line:last-child { margin-bottom: 0; }
.detail-block { margin-top: 14px; }
.detail-block-label { font-size: 12px; font-weight: 600; color: #8a9099; margin-bottom: 6px; }
.detail-block-body {
  font-size: 13px; color: #1f2329; line-height: 1.8;
  white-space: pre-wrap; word-break: break-word;
  background: #fff; border: 1px solid #eceff3; border-radius: 8px; padding: 10px 12px;
  max-height: 40vh; overflow-y: auto;
}
.review-block .detail-block-body { background: #f6ffed; border-color: #b7eb8f; color: #19a558; }

/* ===== 详情弹窗美化（仅 .detail-box 容器内生效，与组会管理/科研成果风格一致） ===== */
.detail-box {
  padding: 0;
  overflow: hidden;
  border: 1px solid #eef1f5;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(15, 35, 80, 0.22);
  display: flex;
  flex-direction: column;
  max-height: 86vh;
}
.detail-box .modal-title {
  margin: 0;
  padding: 16px 24px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  color: #1f2329;
  background: linear-gradient(135deg, #f2f8ff 0%, #f2faf6 100%);
  border-bottom: 1px solid #eef1f5;
  flex: 0 0 auto;
}
.detail-box .modal-title::before {
  content: '';
  flex: 0 0 auto;
  width: 4px;
  height: 16px;
  border-radius: 999px;
  background: linear-gradient(180deg, #0d80e0, #19a558);
}
.detail-box .detail {
  margin: 0;
  padding: 20px 24px;
  background: transparent;
  border: none;
  border-radius: 0;
  flex: 1 1 auto;
  overflow-y: auto;
  min-height: 0;
}
.detail-box .detail > .detail-line {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: #f8fafc;
  border: 1px solid #eef1f5;
  border-radius: 10px;
  padding: 10px 12px;
  margin: 0 0 12px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.detail-box .detail > .detail-line:hover {
  border-color: #cfe4f7;
  box-shadow: 0 2px 8px rgba(13, 128, 224, 0.06);
}
.detail-box .detail > .detail-line:last-child { margin-bottom: 0; }
.detail-box .detail-line b {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #8a9099;
  line-height: 1.7;
}
.detail-box .detail-line b::before {
  content: '';
  flex: 0 0 auto;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0d80e0, #19a558);
  opacity: 0.75;
}
.detail-box .detail-block { margin-top: 14px; }
.detail-box .detail-block-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #8a9099;
  margin-bottom: 8px;
}
.detail-box .detail-block-label::before {
  content: '';
  flex: 0 0 auto;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0d80e0, #19a558);
  opacity: 0.75;
}
.detail-box .detail-block-body {
  background: #fff;
  border: 1px solid #eceff3;
  border-radius: 8px;
  padding: 12px 14px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.7;
  color: #4e5969;
  font-size: 13px;
  max-height: 40vh;
  overflow-y: auto;
}
/* 批阅意见块保留绿色高亮 */
.detail-box .review-block .detail-block-body {
  background: #f6ffed;
  border-color: #b7eb8f;
  color: #19a558;
}
.detail-box .modal-actions {
  margin: 0;
  padding: 14px 24px;
  background: #fafbfc;
  border-top: 1px solid #eef1f5;
  flex: 0 0 auto;
}
/* 首个按钮（关闭）升级为主按钮，编辑/删除/提交保持各自样式 */
.detail-box .modal-actions .btn:first-child {
  background: linear-gradient(135deg, #0d80e0, #19a558);
  border: none;
  color: #fff;
  font-weight: 600;
  min-width: 80px;
}
.detail-box .modal-actions .btn:first-child:hover {
  opacity: 0.92;
  color: #fff;
  border-color: transparent;
}
</style>
