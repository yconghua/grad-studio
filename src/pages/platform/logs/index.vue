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
          <tr v-for="l in list" :key="l.id">
            <td>{{ l.operator_name || l.operator_id }}</td>
            <td><span class="mono">{{ l.action }}</span></td>
            <td>{{ l.target_type }}</td>
            <td>{{ l.target_id }}</td>
            <td class="detail">{{ l.detail || '—' }}</td>
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

onMounted(loadList)
</script>

<style scoped>
.page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; justify-content: space-between; align-items: center; }
.header-left { display: flex; align-items: flex-end; gap: 14px; }
.page-title { margin: 0; font-size: 18px; color: #1f2329; }
.page-desc { margin: 0 0 3px; font-size: 13px; color: #8a9099; }
.card { background: #fff; border: 1px solid #eceff3; border-radius: 12px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04); padding: 16px; }
.filter-bar { display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; align-items: center; }
.input { height: 34px; padding: 0 10px; font-size: 13px; border: 1px solid #dfe3e8; border-radius: 8px; outline: none; background: #fff; color: #1f2329; }
.input:focus { border-color: #0d80e0; }
.filter-bar .input { min-width: 150px; }
.btn { height: 34px; padding: 0 16px; border-radius: 8px; font-size: 13px; cursor: pointer; border: 1px solid #dfe3e8; background: #fff; color: #1f2329; }
.btn-primary { background: linear-gradient(135deg, #0d80e0, #19a558); border: none; color: #fff; font-weight: 600; }
.btn-secondary:hover { border-color: #0d80e0; color: #0d80e0; }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.state { padding: 40px 0; text-align: center; color: #8a9099; font-size: 13px; }
.state.error { color: #ea4335; }
.tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.tbl th { background: #f7f9fc; text-align: left; padding: 10px 12px; color: #4e5969; font-weight: 600; border-bottom: 1px solid #eceff3; }
.tbl td { padding: 10px 12px; border-bottom: 1px solid #eceff3; color: #1f2329; vertical-align: top; }
.tbl tbody tr:nth-child(even) { background: #fafbfc; }
.tbl tbody tr:hover { background: #eef6ff; }
.mono { font-family: Consolas, Monaco, monospace; }
.detail { max-width: 360px; }
.pager { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-top: 14px; }
.pager-info { font-size: 13px; color: #4e5969; }
</style>
