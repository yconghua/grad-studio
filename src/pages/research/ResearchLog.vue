<template>
  <CrudPage v-bind="config" />
</template>

<script setup>
import CrudPage from '../../components/CrudPage.vue'
import { research } from '../../api'

const config = {
  title: '科研日志',
  api: research.log,
  searchField: 'title',
  searchLabel: '日志标题',
  columns: [
    { label: '标题', key: 'title' },
    { label: '关联项目ID', key: 'project_id' },
    { label: '作者ID', key: 'author_id' },
    { label: '日志日期', key: 'log_date' }
  ],
  formFields: [
    { label: '日志标题', key: 'title', required: true },
    { label: '日志内容', key: 'content', type: 'textarea' },
    { label: '关联项目ID', key: 'project_id', type: 'number' },
    { label: '日志日期', key: 'log_date', type: 'date' },
    { label: '附件路径', key: 'attachment' }
  ]
}
</script>
