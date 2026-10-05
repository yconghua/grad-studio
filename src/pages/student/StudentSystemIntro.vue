<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">系统简介</h2>
        <p class="page-sub">学生视角的系统简介</p>
      </div>
    </div>
    <div class="panel">
      <div v-if="loading" class="empty">加载中…</div>
      <template v-else-if="info">
        <div class="info-row"><span class="label">系统名称</span><span>{{ info.name || '-' }}</span></div>
        <div class="info-row"><span class="label">当前版本</span><span>v{{ info.version || '-' }}</span></div>
        <div class="info-row"><span class="label">系统简介</span><span class="intro">{{ info.introduction || '暂无简介' }}</span></div>
      </template>
      <div v-else class="empty">暂无系统简介信息</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getIntroduction } from '../../api'
import { useAutoRefresh } from '../../composables/useAutoRefresh'

// 学生独立页面：系统简介
const info = ref(null)
const loading = ref(true)
// 加载系统简介（挂载时与数据变动时共用）
async function refreshAll() {
  try {
    const res = await getIntroduction()
    if (res && res.success) info.value = res.data
  } finally {
    loading.value = false
  }
}

onMounted(refreshAll)
// 数据变动（本页写操作或外部改动）后后台静默重拉
useAutoRefresh(refreshAll)
</script>

<style scoped>
.info-row {
  display: flex;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-light);
  font-size: 14px;
}
.info-row:last-child { border-bottom: none; }
.label {
  width: 90px;
  color: var(--muted);
  flex-shrink: 0;
}
.intro { white-space: pre-wrap; line-height: 1.8; }
</style>
