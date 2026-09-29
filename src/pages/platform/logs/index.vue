<template>
  <div class="page">
    <div class="page-head">
      <div class="header-left">
        <h2 class="page-title">🕐 操作日志</h2>
        <p class="page-desc">平台操作审计记录，只读（仅超级管理员可见）</p>
      </div>
    </div>

    <div class="card">
      <div class="filter-bar">
        <input v-model="filter.action" class="input" placeholder="动作（精确，如 createUser）" />
        <input v-model="filter.target_type" class="input" placeholder="目标类型（如 user/group）" />
        <input v-model="filter.start_date" type="date" class="input" title="开始日期" />
        <input v-model="filter.end_date" type="date" class="input" title="结束日期" />
        <button class="btn btn-primary" @click="applyFilter">查询</button>
        <button class="btn btn-secondary" @click="resetFilter">重置</button>
      </div>

      <div v-if="loading" class="state">加载中…</div>
      <div v-else-if="errorMsg" class="state error">⚠️ {{ errorMsg }}</div>
      <div v-else-if="!list.length" class="state">🗂️ 暂无日志</div>
      <table v-else class="tbl">
        <thead>
          <tr><th>操作人</th><th>动作</th><th>目标类型</th><th>目标ID</th><th>详情</th><th>时间</th></tr>
        </thead>
        <tbody>
          <tr v-for="l in list" :key="l.id" class="row-click" @click="openDetail(l)">
            <td>{{ l.operator_name || l.operator_id }}</td>
            <td><span class="mono">{{ l.action }}</span></td>
            <td>{{ l.target_type }}</td>
            <td>{{ l.target_id }}</td>
            <td class="detail" :title="l.detail ? fullDetail(l.detail) : ''">{{ detailPreview(l.detail) }}</td>
            <td>{{ l.created_at }}</td>
          </tr>
        </tbody>
      </table>

      <div v-if="total > 0" class="pager">
        <button class="btn btn-secondary" :disabled="page <= 1" @click="changePage(page - 1)">上一页</button>
        <span class="pager-info">第 {{ page }} 页 / 共 {{ total }} 条</span>
        <button class="btn btn-secondary" :disabled="page * pageSize >= total" @click="changePage(page + 1)">下一页</button>
      </div>
    </div>

    <!-- 日志详情弹窗 -->
    <div v-if="current" class="modal-mask" @click.self="current = null">
      <div class="modal-box wide">
        <h3 class="modal-title">日志详情</h3>
        <div class="detail-meta">
          <div class="meta-row"><span class="meta-label">操作人</span><span class="meta-value">{{ current.operator_name || current.operator_id }}</span></div>
          <div class="meta-row"><span class="meta-label">动作</span><span class="meta-value mono">{{ current.action }}</span></div>
          <div class="meta-row"><span class="meta-label">目标类型</span><span class="meta-value">{{ current.target_type }}</span></div>
          <div class="meta-row"><span class="meta-label">目标ID</span><span class="meta-value">{{ current.target_id }}</span></div>
          <div class="meta-row"><span class="meta-label">时间</span><span class="meta-value">{{ current.created_at }}</span></div>
        </div>
        <div class="detail-body">
          <div class="detail-label">详情内容</div>
          <pre class="detail-pre">{{ fullDetail(current.detail) }}</pre>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="current = null">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { listOperationLogs } from '../../../api'

const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const errorMsg = ref('')
const filter = ref({ action: '', target_type: '', start_date: '', end_date: '' })

async function loadList() {
  loading.value = true
  errorMsg.value = ''
  try {
    const payload = { page: page.value, pageSize: pageSize.value }
    if (filter.value.action.trim()) payload.action = filter.value.action.trim()
    if (filter.value.target_type.trim()) payload.target_type = filter.value.target_type.trim()
    if (filter.value.start_date) payload.start_date = filter.value.start_date
    if (filter.value.end_date) payload.end_date = filter.value.end_date + ' 23:59:59'
    const res = await listOperationLogs(payload)
    if (res && res.success) {
      list.value = (res.data && res.data.list) || []
      total.value = (res.data && res.data.total) || 0
    } else {
      list.value = []
      total.value = 0
      errorMsg.value = (res && res.message) || '加载失败'
    }
  } catch (e) {
    list.value = []
    total.value = 0
    errorMsg.value = '网络异常'
  } finally {
    loading.value = false
  }
}

function applyFilter() {
  page.value = 1
  loadList()
}
function resetFilter() {
  filter.value = { action: '', target_type: '', start_date: '', end_date: '' }
  page.value = 1
  loadList()
}
function changePage(p) {
  page.value = p
  loadList()
}

// 详情弹窗
const current = ref(null)
function openDetail(l) {
  current.value = l
}
function detailPreview(d) {
  if (d == null || d === '') return '—'
  const s = typeof d === 'string' ? d : JSON.stringify(d)
  return s.length > 30 ? s.slice(0, 30) + '…' : s
}
function fullDetail(d) {
  if (d == null || d === '') return '（无）'
  return typeof d === 'string' ? d : JSON.stringify(d, null, 2)
}

onMounted(loadList)
</script>

<style scoped>
.page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; justify-content: space-between; align-items: center; }
.header-left { display: flex; align-items: flex-end; gap: 14px; }
.page-title { margin: 0; font-size: 18px; color: #1f2329; }
.page-desc { margin: 0 0 3px; font-size: 13px; color: #8a9099; }
.card { background: #fff; border: 1px solid #eceff3; border-radius: 12px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04); padding: 16px; }
.filter-bar { display: flex; gap: 10px; margin-bottom: 14px; align-items: center; flex-wrap: nowrap; }
.input { height: 34px; padding: 0 10px; font-size: 13px; border: 1px solid #dfe3e8; border-radius: 8px; outline: none; background: #fff; color: #1f2329; }
.input:focus { border-color: #0d80e0; }
.filter-bar .input { width: 150px; min-width: 0; }
.btn { height: 34px; padding: 0 16px; border-radius: 8px; font-size: 13px; cursor: pointer; border: 1px solid #dfe3e8; background: #fff; color: #1f2329; }
.btn-primary { background: linear-gradient(135deg, #0d80e0, #19a558); border: none; color: #fff; font-weight: 600; }
.btn-secondary:hover { border-color: #0d80e0; color: #0d80e0; }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.state { padding: 40px 0; text-align: center; color: #8a9099; font-size: 13px; }
.state.error { color: #ea4335; }
.tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.tbl th { background: #f7f9fc; text-align: left; padding: 10px 12px; color: #4e5969; font-weight: 600; border-bottom: 1px solid #eceff3; white-space: nowrap; }
.tbl td { padding: 10px 12px; border-bottom: 1px solid #eceff3; color: #1f2329; vertical-align: top; white-space: nowrap; }
.tbl tbody tr:nth-child(even) { background: #fafbfc; }
.tbl tbody tr:hover { background: #eef6ff; }
.row-click { cursor: pointer; }
.mono { font-family: Consolas, Monaco, monospace; }
.detail { width: 1%; max-width: 160px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pager { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-top: 14px; }
.pager-info { font-size: 13px; color: #4e5969; }

.modal-mask {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal-box {
  width: 480px; background: #fff; border-radius: 12px; padding: 24px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}
.modal-box.wide { width: 640px; }
.modal-title { margin: 0 0 16px; font-size: 16px; color: #1f2329; }
.modal-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 18px; }
.detail-meta { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.meta-row { display: flex; gap: 10px; font-size: 13px; }
.meta-label { flex: 0 0 64px; color: #8a9099; }
.meta-value { color: #1f2329; word-break: break-all; }
.detail-label { font-size: 13px; color: #4e5969; margin-bottom: 6px; }
.detail-pre {
  margin: 0; max-height: 50vh; overflow: auto; white-space: pre-wrap; word-break: break-all;
  background: #f7f9fc; border: 1px solid #eceff3; border-radius: 8px;
  padding: 10px 12px; font-size: 12px; line-height: 1.7; color: #1f2329;
  font-family: Consolas, Monaco, monospace;
}
</style>
