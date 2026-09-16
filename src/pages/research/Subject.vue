<template>
  <CrudPage v-bind="config" />
</template>

<script setup>
import CrudPage from '../../components/CrudPage.vue'
import { research } from '../../api'
import { PROJECT_STATUS_OPTIONS } from '../../config/fieldOptions'
import { useRole } from '../../composables/useRole'

const { isManager } = useRole()

// 课题申报复用 project 表，创建时固定 type=subject
const config = {
  title: '课题申报',
  api: research.project,
  searchField: 'name',
  searchLabel: '课题名称',
  writable: isManager,
  columns: [
    { label: '课题名称', key: 'name' },
    { label: '状态', key: 'status', type: 'select', options: PROJECT_STATUS_OPTIONS },
    { label: '负责人ID', key: 'leader_id' },
    { label: '开始日期', key: 'start_date' },
    { label: '结束日期', key: 'end_date' }
  ],
  formFields: [
    { label: '课题名称', key: 'name', required: true },
    { label: '课题编号', key: 'code' },
    { label: '类型', key: 'type', type: 'text', default: 'subject' },
    { label: '状态', key: 'status', type: 'select', options: PROJECT_STATUS_OPTIONS, default: 'ongoing' },
    { label: '级别', key: 'level' },
    { label: '经费来源', key: 'source' },
    { label: '总经费(元)', key: 'budget', type: 'number' },
    { label: '负责人用户ID', key: 'leader_id', type: 'number' },
    { label: '开始日期', key: 'start_date', type: 'date' },
    { label: '结束日期', key: 'end_date', type: 'date' },
    { label: '课题简介', key: 'description', type: 'textarea' }
  ]
}
</script>
