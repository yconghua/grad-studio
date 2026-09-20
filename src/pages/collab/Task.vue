<template>
  <CrudPage v-bind="config" />
</template>

<script setup>
import CrudPage from '../../components/CrudPage.vue'
import { collab } from '../../api'
import { TASK_STATUS_OPTIONS, PRIORITY_OPTIONS } from '../../config/fieldOptions'
import { useSession } from '../../composables/useSession'
import { useRole } from '../../composables/useRole'

const { getSessionUser } = useSession()
const { isAdmin } = useRole()
const me = getSessionUser()
const myId = me ? me.id : null

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
  // 仅管理员可删别人的任务；普通成员只能删自己创建的
  canDelete: (row) => isAdmin.value || row.created_by === myId
}
</script>
