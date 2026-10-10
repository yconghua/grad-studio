<template>
  <div>
    <div class="panel-title">期刊信息查询
      <span class="tip">ShowJCR（本地数据集）· 聚合数据 JCR · Web of Science · 中科院分区，多源并行；点击表头排序、拖动表头右缘调整列宽、点击行查看详情</span>
    </div>

    <div class="toolbar">
      <input v-model="input" class="input" style="width: 300px" placeholder="输入期刊名 / ISSN" @keyup.enter="doQuery" />
      <button class="btn btn-primary" :disabled="loading" @click="doQuery">{{ loading ? '查询中…' : '查询' }}</button>
      <div class="spacer"></div>
      <template v-if="states.length">
        <span v-for="s in states" :key="s.name" class="tag" :class="stateTag(s.status)">{{ s.label }}：{{ stateText(s) }}</span>
      </template>
    </div>
    <div v-if="warnings.length" class="tool-warn">
      <div v-for="(w, i) in warnings" :key="i" class="tool-warn-line">⚠ {{ w }}</div>
    </div>

    <div v-if="loading" class="panel-empty">正在向各数据源并行查询…</div>

    <div v-else-if="displayList.length" class="tbl-wrap">
      <table
        v-resizable-columns="{ min: 48, minByIndex: { 6: 90 } }"
        v-sortable-columns="{ field: sortField, order: sortOrder, onSort }"
        class="tbl"
      >
        <thead>
          <tr>
            <th data-sort="name">期刊名</th>
            <th data-sort="issn">ISSN</th>
            <th data-sort="impactFactor">影响因子</th>
            <th data-sort="casZone">中科院分区</th>
            <th data-sort="warning">预警</th>
            <th data-sort="publisher">出版社</th>
            <th data-sort="source">来源</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(j, i) in displayList" :key="i" @click="openDetail(j)">
            <td class="ellipsis" style="max-width: 260px" :title="j.name">{{ j.name }}</td>
            <td>{{ j.issn || '-' }}</td>
            <td>{{ j.impactFactor || '-' }}</td>
            <td>
              <span v-if="j.casZone" class="tag tag-blue">{{ j.casZone }}</span>
              <span v-else>-</span>
            </td>
            <td>
              <span v-if="j.warning" class="tag tag-red">预警</span>
              <span v-else class="muted-text">-</span>
            </td>
            <td class="ellipsis" style="max-width: 160px" :title="j.publisher">{{ j.publisher || '-' }}</td>
            <td>{{ j.source || '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else-if="searched" class="panel-empty">未找到相关信息（或所有数据源均不可用）</div>

    <RowDetailDialog v-model:visible="detailVisible" title="期刊详情" :row="detailRow" :fields="detailFields" size="lg" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { showToast } from '../../../composables/useToast'
import { queryJournal } from '../../../api/tool'
import RowDetailDialog from '../../../components/common/RowDetailDialog.vue'

const input = ref('')
const loading = ref(false)
const searched = ref(false)
const list = ref([])
const states = ref([])
const warnings = ref([])
const sortField = ref('')
const sortOrder = ref('')

// 行详情
const detailVisible = ref(false)
const detailRow = ref(null)
const detailFields = [
  { key: 'name', label: '期刊名' },
  { key: 'issn', label: 'ISSN' },
  { key: 'eissn', label: 'eISSN' },
  { key: 'impactFactor', label: '影响因子' },
  { key: 'casZone', label: '中科院分区' },
  { key: 'xrZone', label: '新锐分区' },
  { key: 'warning', label: '预警', render: (v) => (v ? '是' : '否') },
  { key: 'publisher', label: '出版社' },
  { key: 'source', label: '数据来源' }
]

// 本地排序后的展示列表（结果集为多源合并全量，前端排序即可）
const displayList = computed(() => {
  const arr = list.value.slice()
  if (!sortField.value) return arr
  const dir = sortOrder.value === 'desc' ? -1 : 1
  const num = (v) => Number(parseFloat(String(v).replace(/[^0-9.\-]/g, '')) || 0)
  arr.sort((a, b) => {
    let av = a[sortField.value]
    let bv = b[sortField.value]
    if (sortField.value === 'impactFactor' || sortField.value === 'issn') {
      av = num(av); bv = num(bv)
      return (av - bv) * dir
    }
    return String(av ?? '').localeCompare(String(bv ?? ''), 'zh') * dir
  })
  return arr
})

function onSort(field, order) {
  sortField.value = field
  sortOrder.value = order
}

function stateTag(status) {
  return { ok: 'tag-green', timeout: 'tag-orange', skipped: 'tag-gray', fail: 'tag-red' }[status] || 'tag-gray'
}
function stateText(s) {
  if (s.status === 'ok') return `成功 ${s.resultCount} 条`
  if (s.status === 'skipped') return '未配置 Key'
  if (s.status === 'timeout') return '超时'
  return s.error || '失败'
}

function openDetail(row) {
  detailRow.value = row
  detailVisible.value = true
}

async function doQuery() {
  const v = input.value.trim()
  if (!v) { showToast('请输入期刊名或 ISSN', 'info'); return }
  loading.value = true
  searched.value = true
  list.value = []
  sortField.value = ''
  sortOrder.value = ''
  try {
    // ISSN 形态（xxxx-xxxx 或纯 8 位数字）按 ISSN 查，否则按刊名查
    const issn = /^[0-9]{4}-?[0-9]{3}[0-9Xx]$/.test(v) ? v.replace(/-/g, '') : ''
    const res = await queryJournal(issn ? { issn } : { keyword: v })
    list.value = res.list || []
    states.value = res.states || []
    warnings.value = res.warnings || []
  } catch (e) {
    showToast(e.message || '查询失败', 'error')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.tool-warn { margin: -6px 0 10px; }
.tool-warn-line { color: var(--warning); font-size: 12px; line-height: 1.7; }
.muted-text { color: var(--text-3); }
</style>
