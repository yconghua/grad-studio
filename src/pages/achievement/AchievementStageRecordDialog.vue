<template>
  <div v-if="visible" class="modal-mask" @click.self="close">
    <div class="modal sm">
      <div class="modal-head">
        <h3>填写「{{ nodeName }}」</h3>
        <button class="modal-close" @click="close">×</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <label class="form-label">到达时间</label>
          <input v-model="form.happenDate" type="date" class="input" style="width: 180px" />
          <span class="form-tip">该节点实际到达的日期</span>
        </div>
        <div class="form-row form-row--block">
          <label class="form-label">备注</label>
          <textarea v-model="form.remark" class="textarea" rows="3" placeholder="选填，如期刊名、进度说明等"></textarea>
        </div>
        <div v-if="rejectReason" class="form-row form-row--block">
          <label class="form-label">退回意见</label>
          <div class="form-tip" style="color:#dc2626; white-space: pre-wrap">{{ rejectReason }}</div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" @click="close">取消</button>
        <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { saveAchievementStageRecord } from '../../api'
import { dialogAlert } from '../../composables/useDialog'

const props = defineProps({
  visible: { type: Boolean, default: false },
  achievementId: { type: Number, default: null },
  nodeKey: { type: String, default: '' },
  nodeName: { type: String, default: '' },
  record: { type: Object, default: null } // 已填记录（修改时传入）
})
const emit = defineEmits(['update:visible', 'saved'])

const form = ref({ happenDate: '', remark: '' })
const rejectReason = ref('')
const saving = ref(false)

watch(
  () => props.visible,
  (v) => {
    if (v) {
      form.value = {
        happenDate: (props.record && props.record.happenDate) || '',
        remark: (props.record && props.record.remark) || ''
      }
      rejectReason.value = (props.record && props.record.rejectReason) || ''
    }
  }
)

async function save() {
  saving.value = true
  try {
    const res = await saveAchievementStageRecord({
      achievementId: props.achievementId,
      nodeKey: props.nodeKey,
      happenDate: form.value.happenDate,
      remark: form.value.remark
    })
    if (res && res.success) {
      emit('update:visible', false)
      emit('saved')
    } else {
      dialogAlert((res && res.message) || '保存失败')
    }
  } finally {
    saving.value = false
  }
}

function close() {
  emit('update:visible', false)
}
</script>

<style scoped>
.form-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; flex-wrap: wrap; }
.form-row--block { align-items: flex-start; }
.form-label { width: 80px; flex-shrink: 0; font-size: 13px; color: var(--text-2, #6b7280); }
.form-tip { font-size: 12px; color: var(--text-3, #9aa0aa); }
.textarea {
  flex: 1;
  min-height: 72px;
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
</style>
