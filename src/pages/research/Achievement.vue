<template>
  <CrudPage v-bind="config" />
</template>

<script setup>
import CrudPage from '../../components/CrudPage.vue'
import { research } from '../../api'
import { ACHIEVEMENT_TYPE_OPTIONS } from '../../config/fieldOptions'

const config = {
  title: '成果登记',
  api: research.achievement,
  searchField: 'title',
  searchLabel: '成果名称',
  columns: [
    { label: '成果名称', key: 'title' },
    { label: '类型', key: 'type', type: 'select', options: ACHIEVEMENT_TYPE_OPTIONS },
    { label: '级别', key: 'level' },
    { label: '完成人', key: 'authors' },
    { label: '取得日期', key: 'achieve_date' }
  ],
  formFields: [
    { label: '成果名称', key: 'title', required: true },
    { label: '类型', key: 'type', type: 'select', options: ACHIEVEMENT_TYPE_OPTIONS, required: true, default: 'paper' },
    { label: '级别', key: 'level' },
    { label: '完成人', key: 'authors', placeholder: '逗号分隔' },
    { label: '第一完成人', key: 'owner_id', type: 'user' },
    { label: '关联项目ID', key: 'project_id', type: 'number' },
    { label: '取得日期', key: 'achieve_date', type: 'date' },
    { label: '来源/颁发单位', key: 'source' },
    { label: '附件路径', key: 'attachment' },
    { label: '成果简介', key: 'description', type: 'textarea' }
  ]
}
</script>
