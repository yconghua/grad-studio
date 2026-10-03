<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">创建任务</h2>
        <p class="page-sub">{{ role === ROLE_GROUP_ADMIN ? '参与人范围：本组启用的导师与学生' : '参与人范围：你名下的学生' }}</p>
      </div>
      <button class="btn" type="button" @click="goBack">返回列表</button>
    </div>

    <div class="panel form-panel">
      <div class="form-row">
        <label class="form-label">标题 <b class="req">*</b></label>
        <input v-model="form.title" class="input" style="width: 100%" maxlength="100" placeholder="任务标题" />
      </div>

      <div class="form-row">
        <label class="form-label">描述</label>
        <textarea v-model="form.description" class="textarea" rows="4" maxlength="2000" placeholder="任务描述（选填）"></textarea>
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

      <div class="form-row">
        <label class="form-label">参与人 <b class="req">*</b></label>
        <div class="form-value">
          <div v-if="memberOptions.length === 0" class="hint">
            {{ loadingMembers ? '加载中…' : '暂无可选成员（请先在成员管理中维护）' }}
          </div>
          <div v-else class="chk-grid">
            <label v-for="m in memberOptions" :key="m.id" class="chk">
              <input v-model="form.participantIds" type="checkbox" :value="m.id" />
              <span>{{ m.realName || m.username }}</span>
              <span class="chk-role">{{ m.role === 'mentor' ? '导师' : '学生' }}</span>
            </label>
          </div>
        </div>
      </div>

      <div class="form-actions">
        <button class="btn btn-primary" type="button" :disabled="submitting" @click="submit">创建任务</button>
        <button class="btn" type="button" @click="goBack">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createTask, getTaskParticipantOptions } from '../../api/task'
import { useSession } from '../../composables/useSession'
import { dialogAlert } from '../../composables/useDialog'
import { ROLE_GROUP_ADMIN } from '../../config/constants'
import { TASK_PRIORITY_TEXT } from '../../utils/labels'

const route = useRoute()
const router = useRouter()
const { getSessionUser } = useSession()
const user = getSessionUser()
const role = user && user.role

const form = reactive({
  title: '',
  description: '',
  priority: 2,
  startTime: '',
  dueTime: '',
  participantIds: []
})
const memberOptions = ref([])
const loadingMembers = ref(false)
const submitting = ref(false)

async function loadOptions() {
  loadingMembers.value = true
  const res = await getTaskParticipantOptions()
  if (res && res.success) {
    memberOptions.value = res.data || []
    // 默认全选？不默认选中，由创建者自行勾选
  } else {
    dialogAlert((res && res.message) || '加载参与人失败')
  }
  loadingMembers.value = false
}

function toDbTime(v) {
  // datetime-local 输入 "YYYY-MM-DDTHH:mm" → 服务端期望 "YYYY-MM-DD HH:mm:ss"
  if (!v) return null
  return v.replace('T', ' ') + ':00'
}

async function submit() {
  if (!form.title.trim()) {
    dialogAlert('请填写任务标题')
    return
  }
  if (form.participantIds.length === 0) {
    dialogAlert('请至少选择一位参与人')
    return
  }
  submitting.value = true
  const res = await createTask({
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    priority: Number(form.priority),
    startTime: toDbTime(form.startTime),
    dueTime: toDbTime(form.dueTime),
    participantIds: form.participantIds.map(Number)
  })
  submitting.value = false
  if (res && res.success) {
    dialogAlert('任务创建成功，已通知参与人')
    router.push({ name: `${role}-tasks`, query: { open: res.data.id } })
  } else {
    dialogAlert((res && res.message) || '创建失败')
  }
}

function goBack() {
  router.push({ name: `${role}-tasks` })
}

onMounted(() => {
  loadOptions()
})
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
.form-value {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  line-height: 34px;
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
.textarea:focus,
.input:focus,
.select:focus {
  border-color: var(--primary);
}
.hint {
  font-size: 13px;
  color: var(--text-disabled);
}
.chk-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
}
.chk {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--text-2-strong);
  cursor: pointer;
}
.chk-role {
  font-size: 12px;
  color: var(--text-disabled);
}
.form-actions {
  display: flex;
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid var(--border-light);
}
</style>
