<template>
  <CrudPage v-bind="config" />
</template>

<script setup>
import CrudPage from '../../components/CrudPage.vue'
import { workbench } from '../../api'
import { SCHEDULE_TYPE_OPTIONS } from '../../config/fieldOptions'

const config = {
  title: '我的日程',
  api: workbench.schedule,
  searchField: 'title',
  searchLabel: '日程标题',
  columns: [
    { label: '日程', key: 'title' },
    { label: '类型', key: 'type', type: 'select', options: SCHEDULE_TYPE_OPTIONS },
    { label: '开始', key: 'start_time', type: 'datetime' },
    { label: '结束', key: 'end_time', type: 'datetime' },
    { label: '地点', key: 'location' }
  ],
  formFields: [
    { label: '日程标题', key: 'title', required: true },
    { label: '类型', key: 'type', type: 'select', options: SCHEDULE_TYPE_OPTIONS, default: 'other' },
    { label: '开始时间', key: 'start_time', type: 'datetime' },
    { label: '结束时间', key: 'end_time', type: 'datetime' },
    { label: '地点', key: 'location' },
    { label: '描述', key: 'description', type: 'textarea' }
  ]
}
</script>
