<template>
  <div class="ms">
    <div class="ms-head">
      <span class="ms-title">{{ title }}</span>
      <span v-if="rows && rows.length" class="ms-count">{{ rows.length }} 条</span>
      <button v-if="rows && rows.length" class="btn btn-mini" @click="doExport">⬇ 导出CSV</button>
    </div>
    <div v-if="!rows || !rows.length" class="ms-empty">{{ emptyText || '暂无数据' }}</div>
    <div v-else class="ms-table-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th v-for="c in columns" :key="c.key">{{ c.label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in rows" :key="i">
            <td v-for="c in columns" :key="c.key">{{ cellText(r[c.key]) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { exportCsv } from '../../../utils/csvExport'

const props = defineProps({
  title: { type: String, default: '' },
  rows: { type: Array, default: null },
  columns: { type: Array, default: () => [] },
  filename: { type: String, default: '导出.csv' },
  emptyText: { type: String, default: '暂无数据' }
})

// 单元格文本：空值 / 对象 / ISO 时间分别处理
function cellText(v) {
  if (v === null || v === undefined || v === '') return ''
  if (typeof v === 'object') {
    if (v instanceof Date) return fmtTime(v.toISOString())
    try {
      return JSON.stringify(v)
    } catch (e) {
      return String(v)
    }
  }
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(v)) {
    return fmtTime(v)
  }
  return String(v)
}

function fmtTime(s) {
  return s.replace('T', ' ').replace(/\.\d{3}Z$/, '').replace(/\.\d{3}$/, '').replace('Z', '')
}

function doExport() {
  exportCsv(props.filename, props.rows, props.columns)
}
</script>

<style scoped>
.ms { border: 1px solid #eceff3; border-radius: 10px; background: #fff; }
.ms-head {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; border-bottom: 1px solid #eceff3;
}
.ms-title { font-size: 14px; font-weight: 600; color: #1f2329; }
.ms-count { font-size: 12px; color: #8a9099; }
.ms-head .btn-mini { margin-left: auto; }
.ms-empty { padding: 24px 14px; text-align: center; color: #8a9099; font-size: 13px; }
.ms-table-wrap { overflow-x: auto; }
.ms-table-wrap .tbl { min-width: 640px; }
</style>
