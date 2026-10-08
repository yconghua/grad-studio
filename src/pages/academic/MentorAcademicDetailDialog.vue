<template>
  <div v-if="visible" class="modal-mask" @click.self="close">
    <div class="modal lg">
      <div class="modal-head">
        <h3>学生学业档案</h3>
        <button class="modal-close" @click="close">×</button>
      </div>
      <div class="modal-body">
        <div v-if="!data" class="dialog-loading">
          {{ loadError || '加载中…' }}
        </div>
        <template v-else>
          <div class="md-overview">
            <div class="md-overview__item"><span class="md-overview__label">学生</span><b>{{ data.user.realName || data.user.username }}</b></div>
            <div class="md-overview__item"><span class="md-overview__label">培养类型</span><b>{{ data.stageTypeLabel }}</b></div>
            <div class="md-overview__item"><span class="md-overview__label">节点进度</span><b>{{ data.summary.done }} / {{ data.summary.total }}</b></div>
            <div class="md-overview__item"><span class="md-overview__label">待确认</span><b>{{ pendingSubmitCount }}</b></div>
            <div class="md-overview__actions">
              <button class="btn btn-sm" :disabled="exporting" @click="exportDoc">{{ exporting ? '导出中…' : '导出Excel' }}</button>
              <button class="btn btn-primary btn-sm" :disabled="pendingSubmitCount === 0" @click="batchConfirmAll">全部确认</button>
            </div>
          </div>

          <div class="md-timeline">
            <AcademicTimeline :nodes="data.nodes">
              <template #actions="{ node }">
                <template v-if="node.record && node.record.status === 'submitted'">
                  <button class="btn btn-sm btn-primary" @click="confirm(node)">确认</button>
                  <button class="btn btn-sm" @click="openReturn(node)">退回</button>
                </template>
                <template v-else-if="node.record && node.record.status === 'confirmed'">
                  <button class="btn btn-sm" @click="openReturn(node)">退回</button>
                </template>
              </template>
            </AcademicTimeline>
          </div>
        </template>
      </div>
      <div class="modal-foot">
        <button class="btn" @click="close">关闭</button>
      </div>
    </div>
  </div>

  <!-- 退回意见弹窗 -->
  <div v-if="returnVisible" class="modal-mask" @click.self="returnVisible = false">
    <div class="modal sm">
      <div class="modal-head">
        <h3>退回「{{ returnNode && returnNode.nodeName }}」</h3>
        <button class="modal-close" @click="returnVisible = false">×</button>
      </div>
      <div class="modal-body">
        <textarea v-model="returnReason" class="textarea" rows="4" placeholder="请填写退回意见（必填）"></textarea>
      </div>
      <div class="modal-foot">
        <button class="btn" @click="returnVisible = false">取消</button>
        <button class="btn btn-primary" :disabled="!returnReason.trim() || returning" @click="doReturn">
          {{ returning ? '退回中…' : '确认退回' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import AcademicTimeline from './AcademicTimeline.vue'
import { getAcademicRecords, confirmAcademicRecord, returnAcademicRecord, batchConfirmAcademic, exportAcademic } from '../../api'
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'
import { refreshAfterWrite } from '../../composables/useGlobalRefresh'

const props = defineProps({
  visible: { type: Boolean, default: false },
  userId: { type: [Number, String], default: null }
})
const emit = defineEmits(['update:visible', 'changed'])

const data = ref(null)
const loadError = ref('')
const exporting = ref(false)
const returnVisible = ref(false)
const returnNode = ref(null)
const returnReason = ref('')
const returning = ref(false)

const pendingSubmitCount = computed(() => {
  if (!data.value) return 0
  return data.value.nodes.filter((n) => n.record && n.record.status === 'submitted').length
})

watch(
  () => props.visible,
  (v) => {
    if (v) load()
  }
)

async function load() {
  data.value = null
  loadError.value = ''
  if (!props.userId) return
  try {
    const res = await getAcademicRecords(props.userId)
    if (res && res.success) {
      data.value = res.data
    } else {
      loadError.value = (res && res.message) || '加载失败'
    }
  } catch (e) {
    loadError.value = '加载失败：' + (e && e.message ? e.message : '请稍后重试')
  }
}

function close() {
  emit('update:visible', false)
}

async function confirm(node) {
  const ok = await dialogConfirm(`确认「${node.nodeName}」节点？`)
  if (!ok) return
  const res = await confirmAcademicRecord(node.record.id)
  if (res && res.success) {
    await refreshAfterWrite('已确认')
    await load()
    emit('changed')
  } else {
    dialogAlert((res && res.message) || '操作失败')
  }
}

function openReturn(node) {
  returnNode.value = node
  returnReason.value = ''
  returnVisible.value = true
}
async function doReturn() {
  returning.value = true
  try {
    const res = await returnAcademicRecord(returnNode.value.record.id, returnReason.value.trim())
    if (res && res.success) {
      returnVisible.value = false
      await refreshAfterWrite('已退回')
      await load()
      emit('changed')
    } else {
      dialogAlert((res && res.message) || '操作失败')
    }
  } finally {
    returning.value = false
  }
}

async function batchConfirmAll() {
  const keys = data.value.nodes.filter((n) => n.record && n.record.status === 'submitted').map((n) => n.nodeKey)
  const ok = await dialogConfirm(`批量确认 ${keys.length} 个已提交节点？`)
  if (!ok) return
  const res = await batchConfirmAcademic(props.userId, keys)
  if (res && res.success) {
    await refreshAfterWrite(`已确认 ${res.data.confirmed} 个节点`)
    await load()
    emit('changed')
  } else {
    dialogAlert((res && res.message) || '操作失败')
  }
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
  } finally {
    exporting.value = false
  }
}
</script>

<style scoped>
.dialog-loading { padding: 30px; text-align: center; color: var(--text-3, #9aa0aa); }
.textarea {
  width: 100%;
  min-height: 90px;
  padding: 8px 10px;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: var(--radius-sm, 6px);
  font-size: 14px;
  font-family: inherit;
  color: var(--text, #111827);
  resize: vertical;
  outline: none;
  box-sizing: border-box;
}
.md-overview {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
  margin-bottom: 14px;
  padding: 12px 16px;
  border: 1px solid var(--line, #e5e7eb);
  border-radius: 8px;
  align-items: center;
  background: var(--bg-2, #f9fafb);
}
.md-overview__item { display: flex; align-items: baseline; gap: 8px; }
.md-overview__label { font-size: 13px; color: var(--text-2, #6b7280); }
.md-overview__actions { margin-left: auto; display: flex; gap: 8px; }
</style>
