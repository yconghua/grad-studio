<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">我的学业档案</h2>
        <p class="page-sub">按培养类型时间线记录个人学业节点，提交后由导师确认</p>
      </div>
      <div class="page-actions">
        <button class="btn" :disabled="!data" @click="exportDoc">导出档案</button>
      </div>
    </div>

    <div v-if="!data" class="card card-loading">加载中…</div>

    <template v-else>
      <div class="card ac-overview">
        <div class="ac-overview__item"><span class="ac-overview__label">培养类型</span><b>{{ data.stageTypeLabel }}</b></div>
        <div class="ac-overview__item"><span class="ac-overview__label">课题组</span><b>{{ data.groupName || '未入组' }}</b></div>
        <div class="ac-overview__item"><span class="ac-overview__label">节点进度</span><b>{{ data.summary.done }} / {{ data.summary.total }}</b></div>
        <div class="ac-overview__item"><span class="ac-overview__label">完成率</span><b>{{ progress }}%</b></div>
      </div>

      <div class="card">
        <AcademicTimeline :nodes="data.nodes">
          <template #actions="{ node }">
            <button
              v-if="!node.record || node.record.status !== 'confirmed'"
              class="btn btn-sm"
              @click="openEdit(node)"
            >{{ node.record ? '修改' : '填写' }}</button>
            <button
              v-if="node.record && node.record.status === 'pending'"
              class="btn btn-sm btn-primary"
              @click="submit(node)"
            >提交</button>
          </template>
        </AcademicTimeline>
      </div>
    </template>

    <AcademicEditDialog v-model:visible="editVisible" :node="editNode" @save="saveRecord" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import AcademicTimeline from './AcademicTimeline.vue'
import AcademicEditDialog from './AcademicEditDialog.vue'
import { getAcademicRecords, saveAcademicRecord, submitAcademicRecord, exportAcademic } from '../../api'
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'
import { refreshAfterWrite } from '../../composables/useGlobalRefresh'
import { useAutoRefresh } from '../../composables/useAutoRefresh'

const data = ref(null)
const editVisible = ref(false)
const editNode = ref(null)

const progress = computed(() => {
  if (!data.value || !data.value.summary || !data.value.summary.total) return 0
  return Math.round((data.value.summary.done / data.value.summary.total) * 100)
})

async function load() {
  const res = await getAcademicRecords()
  if (res && res.success) {
    data.value = res.data
  } else {
    dialogAlert((res && res.message) || '加载失败')
  }
}

function openEdit(node) {
  editNode.value = node
  editVisible.value = true
}

async function saveRecord(payload) {
  const res = await saveAcademicRecord(payload)
  if (res && res.success) {
    editVisible.value = false
    await refreshAfterWrite('已保存，请提交待导师确认')
    load()
  } else {
    dialogAlert((res && res.message) || '保存失败')
  }
}

async function submit(node) {
  const ok = await dialogConfirm(`确认提交「${node.nodeName}」？提交后需导师确认`)
  if (!ok) return
  const res = await submitAcademicRecord(node.record.id)
  if (res && res.success) {
    await refreshAfterWrite('已提交，待导师确认')
    load()
  } else {
    dialogAlert((res && res.message) || '提交失败')
  }
}

async function exportDoc() {
  const res = await exportAcademic()
  const r = (res && res.data) || res
  if (!r) return
  if (r.success) {
    dialogAlert(r.filePath ? `导出成功：${r.filePath}` : (r.message || '导出成功'))
  } else if (!r.canceled) {
    dialogAlert((r && r.message) || '导出失败')
  }
}

onMounted(load)
useAutoRefresh(load)
</script>

<style scoped>
.page-actions { margin-left: auto; }
.ac-overview {
  display: flex;
  gap: 28px;
  flex-wrap: wrap;
  margin-bottom: 14px;
  padding: 14px 18px;
}
.ac-overview__item { display: flex; align-items: baseline; gap: 8px; }
.ac-overview__label { font-size: 13px; color: var(--text-2, #6b7280); }
.card-loading { padding: 30px; text-align: center; color: var(--text-3, #9aa0aa); }
</style>
