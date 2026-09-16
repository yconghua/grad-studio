<template>
  <CrudPage v-bind="config" />
</template>

<script setup>
import CrudPage from '../../components/CrudPage.vue'
import { workbench } from '../../api'
import { NOTICE_TYPE_OPTIONS, NOTICE_STATUS_OPTIONS } from '../../config/fieldOptions'
import { useRole } from '../../composables/useRole'

const { isManager } = useRole()

const config = {
  title: '通知公告',
  api: workbench.notice,
  searchField: 'title',
  searchLabel: '公告标题',
  writable: isManager,
  columns: [
    { label: '标题', key: 'title' },
    { label: '类型', key: 'type', type: 'select', options: NOTICE_TYPE_OPTIONS },
    { label: '状态', key: 'status', type: 'select', options: NOTICE_STATUS_OPTIONS },
    { label: '发布时间', key: 'published_at', type: 'datetime' }
  ],
  formFields: [
    { label: '公告标题', key: 'title', required: true },
    { label: '公告内容', key: 'content', type: 'textarea' },
    { label: '类型', key: 'type', type: 'select', options: NOTICE_TYPE_OPTIONS, default: 'notice' },
    { label: '状态', key: 'status', type: 'select', options: NOTICE_STATUS_OPTIONS, default: 'published' },
    { label: '发布时间', key: 'published_at', type: 'datetime' }
  ]
}
</script>
