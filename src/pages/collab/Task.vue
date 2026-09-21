<template>
  <div>
    <CrudPage v-bind="config" />
    <TaskComment
      :visible="commentVisible"
      :task-id="currentTask?.id"
      :task-title="currentTask?.title"
      @close="commentVisible = false"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import CrudPage from '../../components/CrudPage.vue'
import TaskComment from '../../components/TaskComment.vue'
import { collab } from '../../api'
import { TASK_STATUS_OPTIONS, PRIORITY_OPTIONS } from '../../config/fieldOptions'
import { useSession } from '../../composables/useSession'
import { useRole } from '../../composables/useRole'

const { getSessionUser } = useSession()
const { isAdmin } = useRole()
const me = getSessionUser()
const myId = me ? me.id : null

const commentVisible = ref(false)
const currentTask = ref(null)

function openComment(row) {
  currentTask.value = row
  commentVisible.value = true
}

const config = {
  title: '任务协作',
  api: collab.task,
  searchField: 'title',
  searchLabel: '任务标题',
  columns: [
    { label: '任务标题', key: 'title' },
    { label: '负责人', key: 'assignee_id', type: 'user' },
    { label: '优先级', key: 'priority', type: 'select', options: PRIORITY_OPTIONS },
    { label: '状态', key: 'status', type: 'select', options: TASK_STATUS_OPTIONS },
    { label: '进度', key: 'progress' },
    { label: '截止日期', key: 'due_date' }
  ],
  formFields: [
    { label: '任务标题', key: 'title', required: true },
    { label: '任务描述', key: 'description', type: 'textarea' },
    { label: '关联项目ID', key: 'project_id', type: 'number' },
    { label: '负责人', key: 'assignee_id', type: 'user' },
    { label: '优先级', key: 'priority', type: 'select', options: PRIORITY_OPTIONS, default: 'medium' },
    { label: '状态', key: 'status', type: 'select', options: TASK_STATUS_OPTIONS, default: 'todo' },
    { label: '进度(0-100)', key: 'progress', type: 'number' },
    { label: '截止日期', key: 'due_date', type: 'date' }
  ],
  canDelete: (row) => isAdmin.value || row.created_by === myId,
  extraAction: (row) => ({ label: '评论', onClick: () => openComment(row) })
}
</script>
