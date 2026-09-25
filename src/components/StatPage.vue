<template>
  <div class="stat-page">
    <div class="head">
      <h3 class="title">{{ title }}</h3>
    </div>

    <div class="total card">
      <div class="total-num">{{ total }}</div>
      <div class="total-label">总计</div>
    </div>

    <div class="group-grid">
      <div v-for="g in groups" :key="g.label" class="group card">
        <div class="group-num">{{ g.count }}</div>
        <div class="group-label">{{ g.label }}</div>
      </div>
    </div>

    <!-- 近 12 周创建趋势（提供 timeField 时渲染，零依赖 SVG 折线） -->
    <div v-if="timeField" class="trend card">
      <div class="trend-title">近 12 周创建趋势</div>
      <svg v-if="trend.length" class="trend-svg" viewBox="0 0 640 210" preserveAspectRatio="none">
        <line v-for="(t, i) in trend" :key="'g' + i" :x1="px(i)" y1="20" :x2="px(i)" y2="150" stroke="#eceff3" stroke-width="1" />
        <line x1="40" y1="150" x2="600" y2="150" stroke="#dfe3e8" stroke-width="1" />
        <polyline :points="trendPoints" fill="none" stroke="#0d80e0" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        <circle v-for="(t, i) in trend" :key="'c' + i" :cx="px(i)" :cy="py(t.count)" r="3.5" fill="#0d80e0" />
        <text v-for="(t, i) in trend" :key="'x' + i" :x="px(i)" y="175" text-anchor="middle" class="trend-label">{{ t.label }}</text>
        <text v-for="(t, i) in trend" :key="'n' + i" v-if="t.count > 0" :x="px(i)" :y="py(t.count) - 8" text-anchor="middle" class="trend-num">{{ t.count }}</text>
      </svg>
      <div v-else class="empty">暂无趋势数据</div>
    </div>

    <div v-if="!groups.length && !loading" class="empty">暂无数据</div>
    <div v-if="loading" class="empty">加载中…</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const props = defineProps({
  title: { type: String, default: '' },
  fetch: { type: Function, required: true },
  groupField: { type: String, default: '' },
  options: { type: Array, default: () => [] },
  timeField: { type: String, default: '' }
})

const total = ref(0)
const groups = ref([])
const loading = ref(true)
const trend = ref([])
const trendMax = ref(1)

function fmt(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
// 某日期所在周的周一（YYYY-MM-DD）
function mondayOf(dateStr) {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1)
  return fmt(d)
}
// 折线 X 坐标（12 个点均分 40~600）
function px(i) {
  const n = Math.max(1, trend.value.length - 1)
  return 40 + i * (560 / n)
}
// 折线 Y 坐标（20~150，按最大值缩放）
function py(c) {
  return 150 - (c / trendMax.value) * 110
}
const trendPoints = computed(() => trend.value.map((t, i) => `${px(i)},${py(t.count)}`).join(' '))

function buildTrend(list) {
  trend.value = []
  trendMax.value = 1
  if (!props.timeField || !Array.isArray(list)) return
  // 最近 12 周的周一序列
  const now = new Date()
  const day = now.getDay() || 7
  const thisMonday = new Date(now)
  thisMonday.setDate(now.getDate() - day + 1)
  const weeks = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(thisMonday)
    d.setDate(thisMonday.getDate() - i * 7)
    weeks.push({ key: fmt(d), label: `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })
  }
  const map = {}
  for (const row of list) {
    const v = row[props.timeField]
    if (!v) continue
    const key = mondayOf(v)
    if (!key) continue
    map[key] = (map[key] || 0) + 1
  }
  const arr = weeks.map((w) => ({ label: w.label, count: map[w.key] || 0 }))
  trend.value = arr
  trendMax.value = Math.max(1, ...arr.map((x) => x.count))
}

onMounted(async () => {
  try {
    const res = await props.fetch()
    const list = res && res.success ? res.list || [] : []
    total.value = list.length
    // 按 groupField 分组计数
    const map = {}
    for (const row of list) {
      const v = row[props.groupField]
      const key = v === null || v === undefined || v === '' ? '未分类' : v
      map[key] = (map[key] || 0) + 1
    }
    // 转成带 label 的数组，按 options 顺序优先
    const labelMap = {}
    for (const o of props.options) labelMap[o.value] = o.label
    const ordered = []
    for (const [value, count] of Object.entries(map)) {
      ordered.push({ value, label: labelMap[value] || value, count })
    }
    ordered.sort((a, b) => b.count - a.count)
    groups.value = ordered
    buildTrend(list)
  } catch (e) {
    total.value = 0
    groups.value = []
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.stat-page {
  background: #fff;
  border: 1px solid #eceff3;
  border-radius: 12px;
  padding: 18px 20px;
}
.head {
  margin-bottom: 16px;
}
.title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.card {
  background: #f8fafc;
  border: 1px solid #eceff3;
  border-radius: 10px;
  padding: 18px;
  text-align: center;
}
.total {
  margin-bottom: 16px;
}
.total-num {
  font-size: 34px;
  font-weight: 600;
  color: #0d80e0;
}
.total-label {
  margin-top: 4px;
  font-size: 13px;
  color: #8a9099;
}
.group-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}
.trend {
  margin-top: 16px;
  text-align: left;
}
.trend-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
}
.trend-svg {
  width: 100%;
  height: 210px;
}
.trend-label {
  font-size: 11px;
  fill: #8a9099;
}
.trend-num {
  font-size: 11px;
  fill: #0d80e0;
}
.group-num {
  font-size: 24px;
  font-weight: 600;
  color: #1f2329;
}
.group-label {
  margin-top: 4px;
  font-size: 13px;
  color: #8a9099;
}
.empty {
  text-align: center;
  color: #8a9099;
  padding: 30px 0;
}
</style>
