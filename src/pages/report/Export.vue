<template>
  <div class="page">
    <div class="head">
      <h3 class="title">报表导出</h3>
      <button class="btn btn-primary" @click="doExport" :disabled="exporting">
        {{ exporting ? '导出中…' : '导出数据库备份' }}
      </button>
    </div>
    <p class="tip">导出当前数据库为 SQL 备份文件（表结构 + 全量数据），可用于备份或迁移。</p>

    <p v-if="exportMsg" class="msg" :class="exportOk ? 'ok' : 'err'">{{ exportMsg }}</p>

    <h4 class="subtitle">当前数据表（{{ tables.length }} 张）</h4>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr><th>表名</th><th>行数</th><th>字段数</th></tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="3" class="state">加载中…</td></tr>
          <tr v-else-if="!tables.length"><td colspan="3" class="state">暂无数据表</td></tr>
          <tr v-for="t in tables" :key="t.name" v-else>
            <td>{{ t.name }}</td>
            <td>{{ t.count }}</td>
            <td>{{ t.columns ? t.columns.length : 0 }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getTablesInfo, exportDatabase } from '../../api'

const tables = ref([])
const loading = ref(true)
const exporting = ref(false)
const exportMsg = ref('')
const exportOk = ref(false)

async function load() {
  loading.value = true
  try {
    const res = await getTablesInfo()
    tables.value = res && res.success ? res.tables || [] : []
  } catch (e) {
    tables.value = []
  } finally {
    loading.value = false
  }
}

async function doExport() {
  exporting.value = true
  exportMsg.value = ''
  try {
    const res = await exportDatabase()
    if (res && res.success) {
      exportOk.value = true
      exportMsg.value = `导出成功：${res.path || ''}（${res.tables} 张表 / ${res.rows} 行）`
    } else if (res && res.canceled) {
      exportOk.value = false
      exportMsg.value = ''
    } else {
      exportOk.value = false
      exportMsg.value = (res && res.message) || '导出失败'
    }
  } catch (e) {
    exportOk.value = false
    exportMsg.value = '导出过程出现异常，请重试'
  } finally {
    exporting.value = false
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
}
.title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.tip {
  margin: 8px 0 0;
  font-size: 13px;
  color: #8a9099;
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
.btn-primary {
  border: none;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  color: #fff;
  font-weight: 600;
}
.btn-primary:disabled {
  opacity: 0.6;
}
.msg {
  margin: 12px 0;
  font-size: 13px;
}
.msg.ok {
  color: #19a558;
}
.msg.err {
  color: #ea4335;
}
.subtitle {
  margin: 18px 0 10px;
  font-size: 14px;
  font-weight: 600;
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
}
.data-table th {
  background: #f5f7fa;
  color: #4e5969;
  font-weight: 600;
}
.state {
  text-align: center;
  color: #8a9099;
  padding: 24px 0;
}
</style>
