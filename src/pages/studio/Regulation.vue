<template>
  <CrudPage v-bind="config" />
</template>

<script setup>
import CrudPage from '../../components/CrudPage.vue'
import { studio } from '../../api'
import { NOTICE_STATUS_OPTIONS } from '../../config/fieldOptions'
import { useRole } from '../../composables/useRole'

const { isManager } = useRole()

const config = {
  title: '规章制度',
  api: studio.regulation,
  searchField: 'title',
  searchLabel: '制度标题',
  writable: isManager,
  columns: [
    { label: '标题', key: 'title' },
    { label: '分类', key: 'category' },
    { label: '状态', key: 'status', type: 'select', options: NOTICE_STATUS_OPTIONS },
    { label: '发布日期', key: 'publish_date' }
  ],
  formFields: [
    { label: '制度标题', key: 'title', required: true },
    { label: '制度内容', key: 'content', type: 'textarea' },
    { label: '分类', key: 'category' },
    { label: '状态', key: 'status', type: 'select', options: NOTICE_STATUS_OPTIONS, default: 'published' },
    { label: '发布日期', key: 'publish_date', type: 'date' }
  ]
}
</script>
