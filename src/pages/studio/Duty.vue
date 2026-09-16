<template>
  <CrudPage v-bind="config" />
</template>

<script setup>
import CrudPage from '../../components/CrudPage.vue'
import { studio } from '../../api'
import { DUTY_TYPE_OPTIONS, TODO_STATUS_OPTIONS } from '../../config/fieldOptions'
import { useRole } from '../../composables/useRole'

const { isManager } = useRole()

const config = {
  title: '卫生排班',
  api: studio.duty,
  writable: isManager,
  columns: [
    { label: '类型', key: 'type', type: 'select', options: DUTY_TYPE_OPTIONS },
    { label: '排班日期', key: 'duty_date' },
    { label: '值日人', key: 'user_id', type: 'user' },
    { label: '任务', key: 'content' },
    { label: '状态', key: 'status', type: 'select', options: TODO_STATUS_OPTIONS }
  ],
  formFields: [
    { label: '类型', key: 'type', type: 'select', options: DUTY_TYPE_OPTIONS, default: 'clean' },
    { label: '排班日期', key: 'duty_date', type: 'date', required: true },
    { label: '值日/值班人', key: 'user_id', type: 'user', required: true },
    { label: '任务说明', key: 'content' },
    { label: '完成状态', key: 'status', type: 'select', options: TODO_STATUS_OPTIONS }
  ]
}
</script>
