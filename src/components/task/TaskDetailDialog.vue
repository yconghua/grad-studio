<template>
  <div class="modal-mask" @click.self="close">
    <div class="modal lg">
      <div class="modal-head">
        <h3>任务详情</h3>
        <button type="button" class="modal-close" @click="close">×</button>
      </div>
      <div class="modal-body">
        <div v-if="errorMsg" class="empty">{{ errorMsg }}</div>

        <template v-else-if="task">
          <!-- 操作区（按当前用户角色/身份动态显示） -->
          <div v-if="isCreator || (isParticipant && !isCreator)" class="ops dialog-ops">
            <template v-if="isCreator">
              <button class="btn" type="button" @click="$emit('edit', task.id)">编辑</button>
              <button
                v-if="task.status === 1 || task.status === 2"
                class="btn"
                type="button"
                @click="doCancel"
              >取消任务</button>
              <button v-if="task.status === 4" class="btn" type="button" @click="doReopen">重新打开</button>
              <button
                v-if="task.status === 3"
                class="btn btn-green"
                type="button"
                @click="doVerify(true)"
              >验收通过</button>
              <button
                v-if="task.status === 3"
                class="btn btn-red"
                type="button"
                @click="doVerify(false)"
              >验收驳回</button>
              <button class="btn btn-red" type="button" @click="doDelete">删除</button>
            </template>
            <template v-if="isParticipant && !isCreator">
              <button
                v-if="task.status === 1 || task.status === 2"
                class="btn btn-primary"
                type="button"
                @click="openProgress"
              >提交进展</button>
              <button
                v-if="task.status === 2"
                class="btn btn-green"
                type="button"
                @click="doComplete"
              >完成任务</button>
            </template>
          </div>

          <!-- 基本信息 -->
          <div class="panel">
            <div class="detail-head">
              <div>
                <h3 class="detail-title">{{ task.title }}</h3>
                <div class="detail-tags">
                  <span :class="taskStatusTagClass(task.status)">{{ taskStatusText(task.status) }}</span>
                  <span :class="taskPriorityTagClass(task.priority)">{{ taskPriorityText(task.priority) }}</span>
                  <span v-if="isOverdue" class="tag tag-red">已逾期</span>
                </div>
              </div>
            </div>

            <div class="detail-meta">
              <div class="meta-row">
                <span class="meta-label">创建人</span><span class="meta-value">{{ task.creatorName }}</span>
                <span class="meta-label">创建时间</span><span class="meta-value">{{ task.createdAt }}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">开始时间</span><span class="meta-value">{{ task.startTime || '-' }}</span>
                <span class="meta-label">截止时间</span><span class="meta-value">{{ task.dueTime || '-' }}</span>
              </div>
              <div v-if="task.finishTime" class="meta-row">
                <span class="meta-label">完成时间</span><span class="meta-value">{{ task.finishTime }}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">任务描述</span>
                <span class="meta-value desc">{{ task.description || '（无描述）' }}</span>
              </div>
            </div>
          </div>

          <!-- 参与人 -->
          <div class="panel">
            <div class="panel-head">
              <h3 class="panel-title">参与人（{{ task.participants.length }}）</h3>
              <div v-if="isCreator" class="add-part">
                <select v-model="addUserId" class="select" style="width: 180px">
                  <option :value="''">选择要添加的成员</option>
                  <option
                    v-for="m in addableMembers"
                    :key="m.id"
                    :value="m.id"
                  >{{ m.realName || m.username }}{{ m.role === 'mentor' ? '（导师）' : '' }}</option>
                </select>
                <button class="btn btn-sm" type="button" :disabled="!addUserId" @click="doAddParticipant">添加</button>
              </div>
            </div>
            <div class="part-list">
              <div v-for="p in task.participants" :key="p.userId" class="part-item">
                <span>{{ p.realName || p.username }}</span>
                <span class="part-role">{{ p.role === 'mentor' ? '导师' : p.role === 'student' ? '学生' : p.role }}</span>
                <span v-if="p.finishTime" class="tag tag-green">已完成</span>
                <button
                  v-if="isCreator && !isSelf(p.userId)"
                  class="btn btn-sm btn-red"
                  type="button"
                  @click="doRemoveParticipant(p)"
                >移除</button>
              </div>
              <div v-if="task.participants.length === 0" class="empty">暂无参与人</div>
            </div>
          </div>

          <!-- 提交进展表单（参与人，待办/进行中） -->
          <div v-if="progressVisible" class="panel progress-panel">
            <div class="panel-head">
              <h3 class="panel-title">提交进展</h3>
              <button class="btn btn-sm" type="button" @click="progressVisible = false">收起</button>
            </div>
            <div class="prog-form">
              <div class="prog-row">
                <span class="meta-label">进度记录</span>
                <textarea
                  v-model="progressNote"
                  class="textarea"
                  rows="3"
                  maxlength="500"
                  placeholder="请填写本次进展记录（必填）"
                ></textarea>
              </div>
              <div class="prog-actions">
                <button class="btn btn-primary" type="button" @click="submitProgress">提交</button>
              </div>
            </div>
          </div>

          <!-- 动态 -->
          <div class="panel">
            <div class="panel-head">
              <h3 class="panel-title">任务动态</h3>
            </div>
            <div v-if="dynamics.length > 0" class="dyn-list">
              <div v-for="d in dynamics" :key="d.id" class="dyn-item">
                <span class="dyn-op">{{ d.operatorName }}</span>
                <span class="dyn-action">{{ actionText(d) }}</span>
                <span v-if="d.detail" class="dyn-detail">{{ d.detail }}</span>
                <span class="dyn-time">{{ d.createdAt }}</span>
              </div>
            </div>
            <div v-else class="empty">暂无动态</div>
            <div v-if="dynHasMore" class="pager">
              <button class="btn btn-sm" type="button" @click="loadMoreDynamics">加载更多</button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  getTaskDetail,
  listTaskDynamics,
  deleteTask,
  verifyTask,
  cancelTask,
  reopenTask,
  completeTask,
  submitTaskProgress,
  addTaskParticipants,
  removeTaskParticipant,
  getTaskParticipantOptions
} from '../../api/task'
import { useSession } from '../../composables/useSession'
import { dialogAlert, dialogConfirm, dialogPrompt } from '../../composables/useDialog'
import {
  TASK_STATUS_DONE,
  TASK_STATUS_CANCELED,
  TASK_STATUS_REVIEW
} from '../../config/constants'
import { taskStatusText, taskStatusTagClass, taskPriorityText, taskPriorityTagClass } from '../../utils/labels'

const props = defineProps({
  taskId: { type: [Number, String], required: true },
  // 列表页「提交进展」打开时自动展开进展表单
  initialProgress: { type: Boolean, default: false }
})
const emit = defineEmits(['close', 'edit', 'changed'])

const { getSessionUser } = useSession()
const user = getSessionUser()

const task = ref(null)
const errorMsg = ref('')
const dynamics = ref([])
const dynPage = ref(1)
const dynHasMore = ref(true)
const addUserId = ref('')
const memberOptions = ref([])

const isCreator = computed(() => !!task.value && task.value.creatorId === user.id)
const isParticipant = computed(
  () => !!task.value && task.value.participants.some((p) => p.userId === user.id)
)
const isOverdue = computed(() => {
  const t = task.value
  if (!t || !t.dueTime) return false
  if (t.status === TASK_STATUS_DONE || t.status === TASK_STATUS_CANCELED) return false
  return new Date(t.dueTime.replace(' ', 'T')).getTime() < Date.now()
})
const addableMembers = computed(() => {
  const existing = new Set((task.value ? task.value.participants : []).map((p) => p.userId))
  return memberOptions.value.filter((m) => !existing.has(m.id))
})

const ACTION_TEXT = {
  create: '创建任务',
  update: '编辑任务',
  assign: '新增参与人',
  remove: '移除参与人',
  progress: '提交进展',
  status_change: '状态变更',
  verify_approve: '验收通过',
  verify_reject: '验收驳回',
  delete: '删除任务',
  restore: '恢复任务'
}
function actionText(d) {
  const base = ACTION_TEXT[d.action] || d.action
  if (d.fromStatus != null && d.toStatus != null) {
    return `${base}：${taskStatusText(d.fromStatus)} → ${taskStatusText(d.toStatus)}`
  }
  return base
}

function close() {
  emit('close')
}

async function load() {
  const res = await getTaskDetail(props.taskId)
  if (res && res.success) {
    task.value = res.data
    dynPage.value = 1
    dynHasMore.value = true
    dynamics.value = []
    loadDynamics()
    loadMemberOptions()
    if (props.initialProgress) openProgress()
  } else {
    errorMsg.value = (res && res.message) || '任务不存在或无权查看'
  }
}

async function loadMemberOptions() {
  if (memberOptions.value.length > 0) return
  const res = await getTaskParticipantOptions()
  if (res && res.success) memberOptions.value = res.data || []
}

async function loadDynamics() {
  const res = await listTaskDynamics(props.taskId, dynPage.value)
  if (res && res.success) {
    const data = res.data || {}
    dynamics.value = dynamics.value.concat(data.list || [])
    dynHasMore.value = (data.list || []).length >= (data.pageSize || 8)
  }
}

function loadMoreDynamics() {
  dynPage.value += 1
  loadDynamics()
}

function isSelf(uid) {
  return Number(uid) === user.id
}

// ===== 创建者操作 =====
async function doCancel() {
  const ok = await dialogConfirm('确认取消该任务？', '取消任务')
  if (!ok) return
  const res = await cancelTask(props.taskId)
  if (res && res.success) {
    dialogAlert('任务已取消')
    emit('changed')
    load()
  } else {
    dialogAlert((res && res.message) || '取消失败')
  }
}

async function doReopen() {
  const ok = await dialogConfirm('确认重新打开该任务？', '重新打开')
  if (!ok) return
  const res = await reopenTask(props.taskId)
  if (res && res.success) {
    dialogAlert('任务已重新打开为进行中')
    emit('changed')
    load()
  } else {
    dialogAlert((res && res.message) || '操作失败')
  }
}

async function doVerify(pass) {
  let note = ''
  if (!pass) {
    note = (await dialogPrompt('驳回原因（可留空）：', '', '验收驳回')) || ''
  } else {
    const ok = await dialogConfirm('确认验收通过？', '验收任务')
    if (!ok) return
  }
  const res = await verifyTask(props.taskId, pass, note)
  if (res && res.success) {
    dialogAlert(pass ? '验收通过，任务已完成' : '已驳回，任务回到进行中')
    emit('changed')
    load()
  } else {
    dialogAlert((res && res.message) || '操作失败')
  }
}

async function doDelete() {
  const ok = await dialogConfirm('确认删除该任务？删除后可在列表中看到并恢复。', '删除任务')
  if (!ok) return
  const res = await deleteTask(props.taskId)
  if (res && res.success) {
    dialogAlert('任务已删除')
    emit('changed')
    close()
  } else {
    dialogAlert((res && res.message) || '删除失败')
  }
}

// ===== 参与人操作 =====
const progressVisible = ref(false)
const progressNote = ref('')

function openProgress() {
  progressNote.value = ''
  progressVisible.value = true
}

async function submitProgress() {
  const note = progressNote.value.trim()
  if (!note) {
    dialogAlert('请填写进度记录')
    return
  }
  const res = await submitTaskProgress(props.taskId, note)
  if (res && res.success) {
    dialogAlert('进展已提交')
    progressVisible.value = false
    emit('changed')
    load()
  } else {
    dialogAlert((res && res.message) || '提交失败')
  }
}

async function doComplete() {
  const ok = await dialogConfirm('确认完成任务？提交后进入待验收，由创建者验收。', '完成任务')
  if (!ok) return
  const res = await completeTask(props.taskId)
  if (res && res.success) {
    dialogAlert('已提交完成，等待验收')
    emit('changed')
    load()
  } else {
    dialogAlert((res && res.message) || '操作失败')
  }
}

// ===== 参与人增删 =====
async function doAddParticipant() {
  if (!addUserId.value) return
  const res = await addTaskParticipants(props.taskId, [addUserId.value])
  if (res && res.success) {
    addUserId.value = ''
    dialogAlert('已添加参与人')
    emit('changed')
    load()
  } else {
    dialogAlert((res && res.message) || '添加失败')
  }
}

async function doRemoveParticipant(p) {
  const ok = await dialogConfirm(`确认将 ${p.realName || p.username} 移出任务？`, '移除参与人')
  if (!ok) return
  const res = await removeTaskParticipant(props.taskId, p.userId)
  if (res && res.success) {
    dialogAlert('已移除')
    emit('changed')
    load()
  } else {
    dialogAlert((res && res.message) || '移除失败')
  }
}

onMounted(load)
</script>

<style scoped>
.dialog-ops {
  margin-bottom: 12px;
}
.ops {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.detail-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 8px;
}
.detail-tags {
  display: flex;
  gap: 6px;
}
.detail-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.meta-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13px;
}
.meta-label {
  width: 70px;
  flex-shrink: 0;
  color: var(--text-disabled);
}
.meta-value {
  color: var(--text-2-strong);
  min-width: 0;
}
.desc {
  white-space: pre-wrap;
  word-break: break-word;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.panel-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
}
.add-part {
  display: flex;
  gap: 8px;
}
.part-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.part-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--text-2-strong);
}
.part-role {
  font-size: 12px;
  color: var(--text-disabled);
}
.dyn-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dyn-item {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 8px 12px;
  background: var(--bg-hover-soft);
  border-radius: var(--radius-md);
  font-size: 13px;
}
.dyn-op {
  font-weight: 600;
  color: var(--text-2-strong);
  flex-shrink: 0;
}
.dyn-action {
  color: var(--primary);
  flex-shrink: 0;
}
.dyn-detail {
  color: var(--text-3);
  min-width: 0;
}
.dyn-time {
  margin-left: auto;
  color: var(--text-disabled);
  font-size: 12px;
  flex-shrink: 0;
}
.progress-panel {
  border: 1px solid var(--border);
}
.prog-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.prog-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.prog-row .meta-label {
  line-height: 34px;
}
.prog-row .textarea {
  flex: 1;
  min-width: 0;
  min-height: 72px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-family: inherit;
  color: var(--text);
  resize: vertical;
  outline: none;
  box-sizing: border-box;
}
.prog-row .textarea:focus {
  border-color: var(--primary);
}
.prog-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
