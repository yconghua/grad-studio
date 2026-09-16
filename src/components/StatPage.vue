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

    <div v-if="!groups.length && !loading" class="empty">暂无数据</div>
    <div v-if="loading" class="empty">加载中…</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({
  title: { type: String, default: '' },
  fetch: { type: Function, required: true },
  groupField: { type: String, default: '' },
  options: { type: Array, default: () => [] }
})

const total = ref(0)
const groups = ref([])
const loading = ref(true)

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
