<template>
  <div class="page">
    <div class="head">
      <h3 class="title">日志审计</h3>
      <button class="btn" @click="load">刷新</button>
    </div>

    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>操作时间</th>
            <th>操作人</th>
            <th>动作</th>
            <th>目标表</th>
            <th>目标ID</th>
            <th>详情</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="6" class="state">加载中…</td></tr>
          <tr v-else-if="!list.length"><td colspan="6" class="state">暂无日志</td></tr>
          <tr v-for="row in list" :key="row.id" v-else>
            <td>{{ row.created_at }}</td>
            <td>{{ row.username || row.user_id || '-' }}</td>
            <td>{{ row.action }}</td>
            <td>{{ row.target_table || '-' }}</td>
            <td>{{ row.target_id || '-' }}</td>
            <td :title="row.detail">{{ row.detail || '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { system } from '../../api'

const list = ref([])
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    const res = await system.listLogs()
    list.value = res && res.success ? res.list || [] : []
  } catch (e) {
    list.value = []
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.page {
  background: #fff;
  border: 1px solid #eceff3;
  border-radius: 12px;
  padding: 18px 20px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.btn {
  height: 32px;
  padding: 0 14px;
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
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
}
.data-table th {
  background: #f5f7fa;
  color: #4e5969;
  font-weight: 600;
}
.state {
  text-align: center;
  color: #8a9099;
  padding: 32px 0;
}
</style>
