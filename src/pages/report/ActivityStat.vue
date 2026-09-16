<template>
  <div class="page">
    <h3 class="title">活跃度</h3>
    <p class="tip">各业务模块数据量概览，反映工作室整体活跃情况。</p>

    <div class="grid">
      <div v-for="item in items" :key="item.label" class="card">
        <div class="num">{{ item.count }}</div>
        <div class="label">{{ item.label }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { research, collab, resource, studio } from '../../api'

const items = ref([])

onMounted(async () => {
  const tasks = [
    { label: '在研项目', api: research.project },
    { label: '论文著作', api: research.paper },
    { label: '专利软著', api: research.patent },
    { label: '成果登记', api: research.achievement },
    { label: '科研日志', api: research.log },
    { label: '协作任务', api: collab.task },
    { label: '组会', api: collab.meeting },
    { label: '共享资源', api: resource.item },
    { label: '设备', api: studio.device },
    { label: '活动', api: collab.activity }
  ]
  const results = await Promise.allSettled(tasks.map((t) => t.api.list()))
  items.value = tasks.map((t, i) => {
    const r = results[i]
    const count = r.status === 'fulfilled' && r.value.success ? (r.value.list || []).length : 0
    return { label: t.label, count }
  })
})
</script>

<style scoped>
.page {
  background: #fff;
  border: 1px solid #eceff3;
  border-radius: 12px;
  padding: 18px 20px;
}
.title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.tip {
  margin: 6px 0 16px;
  font-size: 13px;
  color: #8a9099;
}
.grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14px;
}
.card {
  background: #f8fafc;
  border: 1px solid #eceff3;
  border-radius: 10px;
  padding: 18px;
  text-align: center;
}
.num {
  font-size: 26px;
  font-weight: 600;
  color: #0d80e0;
}
.label {
  margin-top: 4px;
  font-size: 13px;
  color: #8a9099;
}
</style>
