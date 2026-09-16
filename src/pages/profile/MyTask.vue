<template>
  <CrudPage v-bind="config" />
</template>

<script setup>
import CrudPage from '../../components/CrudPage.vue'
import { collab } from '../../api'
import { TASK_STATUS_OPTIONS, PRIORITY_OPTIONS } from '../../config/fieldOptions'
import { useSession } from '../../composables/useSession'

const { getSessionUser } = useSession()
const me = getSessionUser() ? getSessionUser().id : null

const config = {
  title: '我的任务',
  api: collab.task,
  writable: false,
  fixedFilters: { assignee_id: me },
  columns: [
    { label: '任务标题', key: 'title' },
    { label: '优先级', key: 'priority', type: 'select', options: PRIORITY_OPTIONS },
    { label: '状态', key: 'status', type: 'select', options: TASK_STATUS_OPTIONS },
    { label: '进度', key: 'progress' },
    { label: '截止日期', key: 'due_date' }
  ]
}
</script>
