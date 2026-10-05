<template>
  <div class="modal-mask" @click.self="close">
    <div class="modal">
      <div class="modal-head">
        <h3>提交进展</h3>
        <button type="button" class="modal-close" @click="close">×</button>
      </div>
      <div class="modal-body">
        <p class="hint" style="margin-bottom: 8px">请填写本次进展记录（必填，不超过 500 字）</p>
        <textarea
          v-model="note"
          class="textarea"
          rows="5"
          maxlength="500"
          placeholder="请填写本次进展记录（必填）"
          style="width: 100%; min-height: 120px; box-sizing: border-box; resize: vertical"
        ></textarea>
      </div>
      <div class="modal-foot">
        <button class="btn" type="button" @click="close">取消</button>
        <button class="btn btn-primary" type="button" :disabled="submitting" @click="submit">
          {{ submitting ? '提交中…' : '提交' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { submitTaskProgress } from '../../api/task'
import { refreshAfterWrite } from '../../composables/useGlobalRefresh'
import { dialogAlert } from '../../composables/useDialog'

const props = defineProps({
  taskId: { type: [Number, String], required: true }
})
const emit = defineEmits(['close', 'saved'])

const note = ref('')
const submitting = ref(false)

function close() {
  emit('close')
}

async function submit() {
  const text = note.value.trim()
  if (!text) {
    dialogAlert('请填写进度记录')
    return
  }
  submitting.value = true
  const res = await submitTaskProgress(props.taskId, text)
  submitting.value = false
  if (res && res.success) {
    await refreshAfterWrite('进展已提交')
    emit('saved')
    close()
  } else {
    dialogAlert((res && res.message) || '提交失败')
  }
}
</script>
