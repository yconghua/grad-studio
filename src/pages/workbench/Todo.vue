<template>
  <CrudPage v-bind="config" />
</template>

<script setup>
import CrudPage from '../../components/CrudPage.vue'
import { workbench } from '../../api'
import { PRIORITY_OPTIONS, TODO_STATUS_OPTIONS } from '../../config/fieldOptions'

const config = {
  title: '待办事项',
  api: workbench.todo,
  searchField: 'title',
  searchLabel: '待办标题',
  columns: [
    { label: '待办', key: 'title' },
    { label: '优先级', key: 'priority', type: 'select', options: PRIORITY_OPTIONS },
    { label: '状态', key: 'status', type: 'select', options: TODO_STATUS_OPTIONS },
    { label: '截止日期', key: 'due_date' }
  ],
  formFields: [
    { label: '待办标题', key: 'title', required: true },
    { label: '描述', key: 'description', type: 'textarea' },
    { label: '优先级', key: 'priority', type: 'select', options: PRIORITY_OPTIONS, default: 'medium' },
    { label: '状态', key: 'status', type: 'select', options: TODO_STATUS_OPTIONS, default: 'pending' },
    { label: '截止日期', key: 'due_date', type: 'date' }
  ]
}
</script>
