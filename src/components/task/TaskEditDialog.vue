<template>
  <div class="modal-mask" @click.self="close">
    <div class="modal">
      <div class="modal-head">
        <h3>编辑任务</h3>
        <button type="button" class="modal-close" @click="close">×</button>
      </div>
      <div class="modal-body">
        <div v-if="errorMsg" class="empty">{{ errorMsg }}</div>

        <div v-else-if="form" class="form-panel">
          <div class="form-row">
            <label class="form-label">标题 <b class="req">*</b></label>
            <input v-model="form.title" class="input" style="width: 100%" maxlength="100" />
          </div>

          <div class="form-row">
            <label class="form-label">描述</label>
            <textarea v-model="form.description" class="textarea" rows="4" maxlength="2000"></textarea>
          </div>

          <div class="form-row">
            <label class="form-label">优先级</label>
            <select v-model="form.priority" class="select">
              <option v-for="(txt, val) in TASK_PRIORITY_TEXT" :key="val" :value="Number(val)">{{ txt }}</option>
            </select>
          </div>

          <div class="form-row">
            <label class="form-label">开始时间</label>
            <input v-model="form.startTime" class="input" style="width: 220px" type="datetime-local" />
          </div>

          <div class="form-row">
            <label class="form-label">截止时间</label>
            <input v-model="form.dueTime" class="input" style="width: 220px" type="datetime-local" />
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" type="button" @click="close">取消</button>
        <button class="btn btn-primary" type="button" :disabled="submitting" @click="submit">{{ submitting ? '保存中…' : '保存' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getTaskDetail, updateTask } from '../../api/task'
import { useSession } from '../../composables/useSession'
import { dialogAlert } from '../../composables/useDialog'
import { TASK_PRIORITY_TEXT } from '../../utils/labels'

const props = defineProps({
  taskId: { type: [Number, String], required: true }
})
const emit = defineEmits(['close', 'saved'])

const { getSessionUser } = useSession()
const user = getSessionUser()

const form = ref(null)
const errorMsg = ref('')
const submitting = ref(false)

function toLocalInput(v) {
  if (!v) return ''
  return v.slice(0, 16).replace(' ', 'T')
}
function toDbTime(v) {
  if (!v) return null
  return v.replace('T', ' ') + ':00'
}

async function load() {
  const res = await getTaskDetail(props.taskId)
  if (res && res.success) {
    const t = res.data
    if (t.creatorId !== user.id) {
      errorMsg.value = '只有创建者可以编辑该任务'
      return
    }
    form.value = {
      title: t.title,
      description: t.description || '',
      priority: t.priority,
      startTime: toLocalInput(t.startTime),
      dueTime: toLocalInput(t.dueTime)
    }
  } else {
    errorMsg.value = (res && res.message) || '任务不存在或无权查看'
  }
}

async function submit() {
  if (!form.value.title.trim()) {
    dialogAlert('请填写任务标题')
    return
  }
  submitting.value = true
  const res = await updateTask(props.taskId, {
    title: form.value.title.trim(),
    description: form.value.description.trim() || undefined,
    priority: Number(form.value.priority),
    startTime: toDbTime(form.value.startTime),
    dueTime: toDbTime(form.value.dueTime)
  })
  submitting.value = false
  if (res && res.success) {
    dialogAlert('已保存')
    emit('saved')
    close()
  } else {
    dialogAlert((res && res.message) || '保存失败')
  }
}

function close() {
  emit('close')
}

onMounted(load)
</script>

<style scoped>
.form-panel {
  max-width: 720px;
}
.form-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 0;
}
.form-label {
  width: 80px;
  flex-shrink: 0;
  font-size: 14px;
  color: var(--text-2);
  line-height: 34px;
}
.req {
  color: var(--unread);
}
.textarea {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-family: inherit;
  color: var(--text);
  resize: vertical;
  outline: none;
  box-sizing: border-box;
}
</style>
