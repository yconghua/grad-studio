<template>
  <div v-if="visible" class="modal-mask" @click.self="close">
    <div class="modal lg">
      <div class="modal-head">
        <h3>学业档案详情</h3>
        <button class="modal-close" @click="close">×</button>
      </div>
      <div class="modal-body">
        <div v-if="!data" class="card-loading">{{ loading ? '加载中…' : '暂无数据' }}</div>
        <template v-else>
          <div class="ac-overview">
            <div class="ac-overview__item"><span class="ac-overview__label">学生</span><b>{{ data.user.realName || data.user.username }}</b></div>
            <div class="ac-overview__item"><span class="ac-overview__label">培养类型</span><b>{{ data.stageTypeLabel }}</b></div>
            <div class="ac-overview__item"><span class="ac-overview__label">节点进度</span><b>{{ data.summary.done }} / {{ data.summary.total }}</b></div>
            <div class="ac-overview__actions">
              <button class="btn" :disabled="!data || exporting" @click="exportDoc">{{ exporting ? '导出中…' : '导出Excel' }}</button>
            </div>
          </div>
          <AcademicTimeline :nodes="data.nodes" />
        </template>
      </div>
      <div class="modal-foot">
        <button class="btn" @click="close">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import AcademicTimeline from './AcademicTimeline.vue'
import { getAcademicRecords, exportAcademic } from '../../api'
import { dialogAlert } from '../../composables/useDialog'

const props = defineProps({
  visible: { type: Boolean, default: false },
  userId: { type: Number, default: null }
})
const emit = defineEmits(['update:visible'])

const data = ref(null)
const loading = ref(false)
const exporting = ref(false)

watch(
  () => props.visible,
  (v) => {
    if (v && props.userId) {
      load()
    } else {
      data.value = null
    }
  }
)

async function load() {
  loading.value = true
  try {
    const res = await getAcademicRecords(props.userId)
    if (res && res.success) {
      data.value = res.data
    } else {
      dialogAlert((res && res.message) || '加载失败')
    }
  } catch (e) {
    dialogAlert('加载失败：' + (e && e.message ? e.message : '请稍后重试'))
  } finally {
    loading.value = false
  }
}

function close() {
  emit('update:visible', false)
}

async function exportDoc() {
  exporting.value = true
  try {
    const res = await exportAcademic(props.userId)
    const r = (res && res.data) || res
    if (!r) return
    if (r.success) {
      dialogAlert(r.filePath ? `导出成功：${r.filePath}` : (r.message || '导出成功'))
    } else if (!r.canceled) {
      dialogAlert((r && r.message) || '导出失败')
    }
  } catch (e) {
    dialogAlert('导出失败：' + (e && e.message ? e.message : '请稍后重试'))
  } finally {
    exporting.value = false
  }
}
</script>

<style scoped>
.ac-overview {
  display: flex;
  gap: 22px;
  flex-wrap: wrap;
  margin-bottom: 14px;
  padding: 12px 14px;
  border: 1px solid var(--line, #e5e7eb);
  border-radius: 8px;
  align-items: center;
}
.ac-overview__item { display: flex; align-items: baseline; gap: 8px; }
.ac-overview__label { font-size: 13px; color: var(--text-2, #6b7280); }
.ac-overview__actions { margin-left: auto; }
.card-loading { padding: 30px; text-align: center; color: var(--text-3, #9aa0aa); }
</style>
