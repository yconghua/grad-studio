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
          <!-- 基本信息 -->
          <div class="panel">
            <div class="detail-head">
              <div>
                <h3 class="detail-title">{{ task.title }}</h3>
                <div class="detail-tags">
                  <span :class="taskStatusTagClass(task.status)">{{ taskStatusText(task.status) }}</span>
                  <span :class="taskPriorityTagClass(task.priority)">{{ taskPriorityText(task.priority) }}</span>
                </div>
              </div>
            </div>

            <div class="detail-meta">
              <div class="meta-row">
                <span class="meta-label">所属课题组</span><span class="meta-value">{{ task.groupName || '-' }}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">创建人</span>
                <span class="meta-value">{{ task.creatorName }}<span :class="creatorTagClass(task.creatorRole)">{{ creatorRoleText(task.creatorRole) }}</span></span>
              </div>
              <div class="meta-row">
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
            </div>
            <div class="part-list">
              <div v-for="p in task.participants" :key="p.userId" class="part-item">
                <span>{{ p.realName || p.username }}</span>
                <span class="part-role">{{ p.role === 'mentor' ? '导师' : p.role === 'student' ? '学生' : p.role }}</span>
                <span v-if="p.finishTime" class="tag tag-green">已完成</span>
              </div>
              <div v-if="task.participants.length === 0" class="empty">暂无参与人</div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getTaskOverviewDetail } from '../../api/task'
import { useAutoRefresh } from '../../composables/useAutoRefresh'
import { taskStatusText, taskStatusTagClass, taskPriorityText, taskPriorityTagClass } from '../../utils/labels'

const props = defineProps({
  taskId: { type: [Number, String], required: true }
})
const emit = defineEmits(['close'])

const task = ref(null)
const errorMsg = ref('')

function close() {
  emit('close')
}

// 创建人角色文案与标签（超管总览只读展示）
function creatorRoleText(role) {
  if (role === 'group_admin') return '组管'
  if (role === 'mentor') return '导师'
  return role || ''
}
function creatorTagClass(role) {
  if (role === 'group_admin') return 'tag tag-role-group'
  if (role === 'mentor') return 'tag tag-role-mentor'
  return 'tag'
}

async function load() {
  const res = await getTaskOverviewDetail(props.taskId)
  if (res && res.success) {
    task.value = res.data
  } else {
    errorMsg.value = (res && res.message) || '任务不存在或无权查看'
  }
}

onMounted(load)
// 任务数据被改动（他人提交进展/变更状态等）后静默重拉，总览弹窗保持实时
useAutoRefresh(load)
</script>

<style scoped>
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
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
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
  margin-bottom: 10px;
}
.panel-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
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
</style>
