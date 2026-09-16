<template>
  <CrudPage v-bind="config" />
</template>

<script setup>
import CrudPage from '../../components/CrudPage.vue'
import { collab } from '../../api'
import { MEETING_STATUS_OPTIONS } from '../../config/fieldOptions'
import { useRole } from '../../composables/useRole'

const { isManager } = useRole()

const config = {
  title: '组会管理',
  api: collab.meeting,
  searchField: 'title',
  searchLabel: '会议主题',
  writable: isManager,
  columns: [
    { label: '主题', key: 'title' },
    { label: '类型', key: 'type' },
    { label: '时间', key: 'meeting_date', type: 'datetime' },
    { label: '地点', key: 'location' },
    { label: '主持人', key: 'host_id', type: 'user' },
    { label: '状态', key: 'status', type: 'select', options: MEETING_STATUS_OPTIONS }
  ],
  formFields: [
    { label: '会议主题', key: 'title', required: true },
    { label: '类型', key: 'type', placeholder: '如 周会/学术研讨/专题' },
    { label: '会议时间', key: 'meeting_date', type: 'datetime' },
    { label: '地点', key: 'location' },
    { label: '主持人', key: 'host_id', type: 'user' },
    { label: '参会人', key: 'attendees', placeholder: '逗号分隔姓名' },
    { label: '状态', key: 'status', type: 'select', options: MEETING_STATUS_OPTIONS, default: 'scheduled' },
    { label: '会议纪要', key: 'summary', type: 'textarea' }
  ]
}
</script>
