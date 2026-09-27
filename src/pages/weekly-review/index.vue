<template>
  <div class="page">
    <div class="page-head card">
      <div>
        <h2 class="page-title">📋 周报批阅</h2>
        <p class="page-desc">批阅学生提交的周报（组管可见管理组学生，导师可见名下学生）。</p>
      </div>
      <div class="head-actions">
        <select v-model="statusFilter" class="filter-select" @change="load">
          <option value="">全部状态</option>
          <option value="submitted">待批阅</option>
          <option value="reviewed">已批阅</option>
          <option value="draft">草稿</option>
        </select>
      </div>
    </div>

    <div class="card">
      <div v-if="loading" class="state">加载中…</div>
      <div v-else-if="error" class="state error">{{ error }}</div>
      <div v-else-if="!rows.length" class="state">📭 暂无周报，学生提交后将在此显示。</div>

      <table v-else class="tbl">
        <thead>
          <tr>
            <th>学生</th>
            <th>周次</th>
            <th>本周工作</th>
            <th>状态</th>
            <th>提交时间</th>
            <th>批阅人</th>
            <th style="width:100px">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td class="nowrap">{{ displayName(r) }}</td>
            <td class="nowrap">{{ r.week_start }} ~ {{ r.week_end }}</td>
            <td class="content-cell">{{ r.work_content || '—' }}</td>
            <td><span class="badge" :class="badgeClass(r.status)">{{ statusText(r.status) }}</span></td>
            <td class="nowrap muted">{{ r.submitted_at ? fmtTime(r.submitted_at) : '—' }}</td>
            <td class="nowrap muted">{{ reviewerName(r) }}</td>
            <td>
              <button v-if="r.status === 'submitted'" class="link primary-link" @click="openReview(r)">批阅</button>
              <button v-else class="link" @click="openDetail(r)">查看</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 批阅弹窗 -->
    <div v-if="modal.show" class="modal-mask" @click.self="modal.show = false">
      <div class="modal-box wide">
        <h3 class="modal-title">{{ modal.reviewed ? '周报详情' : '批阅周报' }}</h3>
        <div class="detail">
          <p class="detail-line"><b>学生：</b>{{ displayName(modal.row) }}</p>
          <p class="detail-line"><b>周次：</b>{{ modal.row.week_start }} ~ {{ modal.row.week_end }}</p>
          <p class="detail-line"><b>本周工作：</b>{{ modal.row.work_content || '—' }}</p>
          <p class="detail-line"><b>下周计划：</b>{{ modal.row.plan_content || '—' }}</p>
          <p class="detail-line"><b>问题 / 求助：</b>{{ modal.row.problem_content || '—' }}</p>
          <p v-if="modal.reviewed" class="detail-line"><b>批阅意见：</b>{{ modal.row.review_comment || '（未填写）' }}</p>
        </div>
        <label v-if="!modal.reviewed" class="form-item">
          <span class="form-label">批阅意见</span>
          <textarea rows="3" v-model="modal.comment" placeholder="填写批阅意见，提交后学生将收到站内通知"></textarea>
        </label>
        <p v-if="modal.error" class="form-error">{{ modal.error }}</p>
        <div class="modal-actions">
          <button class="btn" @click="modal.show = false">取消</button>
          <button v-if="!modal.reviewed" class="btn primary" :disabled="modal.saving" @click="onSubmit">
            {{ modal.saving ? '提交中…' : '确认批阅' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { listAllWeeklyReports, reviewWeeklyReport } from '../../api'

const rows = ref([])
const loading = ref(false)
const error = ref('')
const statusFilter = ref('')

const modal = ref({
  show: false, saving: false, error: '', reviewed: false, comment: '', row: null
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await listAllWeeklyReports({})
    if (res && res.success) {
      let list = res.data || []
      if (statusFilter.value) list = list.filter((x) => x.status === statusFilter.value)
      rows.value = list
    } else {
      rows.value = []
      error.value = (res && res.message) || '加载失败'
    }
  } catch (e) {
    rows.value = []
    error.value = '网络异常，请重试'
  } finally {
    loading.value = false
  }
}

function displayName(r) {
  if (!r) return ''
  return r.student_real_name ? `${r.student_real_name}（${r.student_username}）` : (r.student_username || ('#' + r.student_id))
}

function reviewerName(r) {
  if (!r.reviewed_by) return '—'
  return r.reviewer_real_name || r.reviewer_username || ('#' + r.reviewed_by)
}

function statusText(s) {
  return { draft: '草稿', submitted: '待批阅', reviewed: '已批阅' }[s] || s
}
function badgeClass(s) {
  return { draft: 'b-gray', submitted: 'b-blue', reviewed: 'b-green' }[s] || 'b-gray'
}
function fmtTime(t) {
  if (!t) return ''
  return String(t).replace('T', ' ').slice(0, 16)
}

function openReview(r) {
  modal.value = { show: true, saving: false, error: '', reviewed: false, comment: '', row: r }
}

function openDetail(r) {
  modal.value = { show: true, saving: false, error: '', reviewed: true, comment: '', row: r }
}

async function onSubmit() {
  const r = modal.value.row
  modal.value.saving = true
  modal.value.error = ''
  try {
    const res = await reviewWeeklyReport({ id: r.id, review_comment: modal.value.comment })
    if (res && res.success) {
      modal.value.show = false
      await load()
    } else {
      modal.value.error = (res && res.message) || '批阅失败'
    }
  } catch (e) {
    modal.value.error = '网络异常，请重试'
  } finally {
    modal.value.saving = false
  }
}

load()
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
.head-actions { display: flex; gap: 10px; align-items: center; }
.filter-select {
  height: 34px; padding: 0 10px; border: 1px solid #dfe3e8; border-radius: 8px;
  font-size: 13px; color: #1f2329; background: #fff; outline: none;
}
.filter-select:focus { border-color: #0d80e0; }

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
.badge { padding: 2px 10px; border-radius: 999px; font-size: 12px; }
.b-gray { background: #f2f3f5; color: #4e5969; }
.b-blue { background: #e6f4ff; color: #0d80e0; }
.b-green { background: #e8f7ef; color: #19a558; }

.link { background: none; border: none; color: #0d80e0; cursor: pointer; font-size: 13px; padding: 0 6px; }
.link:hover { text-decoration: underline; }
.link.primary-link { font-weight: 600; }

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
.detail { background: #fafbfc; border: 1px solid #eceff3; border-radius: 10px; padding: 14px; margin-bottom: 14px; }
.detail-line { margin: 0 0 8px; font-size: 13px; color: #4e5969; line-height: 1.7; }
.detail-line:last-child { margin-bottom: 0; }
.form-item { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.form-label { font-size: 13px; color: #4e5969; }
.form-item textarea {
  padding: 8px 10px; border: 1px solid #dfe3e8; border-radius: 8px;
  font-size: 13px; outline: none; font-family: inherit; resize: vertical;
}
.form-item textarea:focus { border-color: #0d80e0; }
.form-error { color: #ea4335; font-size: 12px; margin: 0 0 10px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }
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
</style>
