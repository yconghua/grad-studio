<template>
  <CrudPage v-bind="config" />
</template>

<script setup>
import CrudPage from '../../components/CrudPage.vue'
import { collab, research } from '../../api'
import { MILESTONE_TYPE_OPTIONS, MILESTONE_STATUS_OPTIONS } from '../../config/fieldOptions'
import { useRole } from '../../composables/useRole'

const { isManager } = useRole()

const config = {
  title: '毕业进度',
  api: research.milestone,
  searchField: 'user_id',
  searchLabel: '学生ID',
  writable: isManager,
  columns: [
    { label: '学生', key: 'user_id', type: 'user' },
    { label: '里程碑', key: 'type', type: 'select', options: MILESTONE_TYPE_OPTIONS },
    { label: '截止日期', key: 'deadline' },
    { label: '状态', key: 'status', type: 'select', options: MILESTONE_STATUS_OPTIONS },
    { label: '完成日期', key: 'completed_at' },
    { label: '备注', key: 'remark' }
  ],
  formFields: [
    { label: '学生', key: 'user_id', type: 'user', required: true },
    { label: '里程碑类型', key: 'type', type: 'select', options: MILESTONE_TYPE_OPTIONS, required: true },
    { label: '截止日期', key: 'deadline', type: 'date' },
    { label: '材料清单', key: 'materials', type: 'textarea' },
    { label: '状态', key: 'status', type: 'select', options: MILESTONE_STATUS_OPTIONS, default: 'pending' },
    { label: '完成日期', key: 'completed_at', type: 'date' },
    { label: '备注', key: 'remark' }
  ]
}
</script>
