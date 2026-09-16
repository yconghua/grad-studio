<template>
  <CrudPage v-bind="config" />
</template>

<script setup>
import CrudPage from '../../components/CrudPage.vue'
import { studio } from '../../api'
import { ATTENDANCE_STATUS_OPTIONS } from '../../config/fieldOptions'
import { useRole } from '../../composables/useRole'

const { isManager } = useRole()

const config = {
  title: '考勤值班',
  api: studio.attendance,
  writable: isManager,
  columns: [
    { label: '成员', key: 'user_id', type: 'user' },
    { label: '考勤日期', key: 'attendance_date' },
    { label: '状态', key: 'status', type: 'select', options: ATTENDANCE_STATUS_OPTIONS },
    { label: '签到', key: 'check_in_time' },
    { label: '签退', key: 'check_out_time' }
  ],
  formFields: [
    { label: '成员', key: 'user_id', type: 'user', required: true },
    { label: '考勤日期', key: 'attendance_date', type: 'date', required: true },
    { label: '状态', key: 'status', type: 'select', options: ATTENDANCE_STATUS_OPTIONS, default: 'present' },
    { label: '签到时间', key: 'check_in_time', placeholder: '如 09:00:00' },
    { label: '签退时间', key: 'check_out_time', placeholder: '如 18:00:00' },
    { label: '备注', key: 'remark' }
  ]
}
</script>
