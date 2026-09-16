<template>
  <CrudPage v-bind="config" />
</template>

<script setup>
import CrudPage from '../../components/CrudPage.vue'
import { research } from '../../api'
import { PROJECT_TYPE_OPTIONS, PROJECT_STATUS_OPTIONS } from '../../config/fieldOptions'
import { useRole } from '../../composables/useRole'

const { isManager } = useRole()

const config = {
  title: '项目管理',
  api: research.project,
  searchField: 'name',
  searchLabel: '项目名称',
  writable: isManager,
  columns: [
    { label: '项目名称', key: 'name' },
    { label: '类型', key: 'type', type: 'select', options: PROJECT_TYPE_OPTIONS },
    { label: '状态', key: 'status', type: 'select', options: PROJECT_STATUS_OPTIONS },
    { label: '负责人', key: 'leader_id', type: 'user' },
    { label: '经费(元)', key: 'budget' },
    { label: '开始日期', key: 'start_date' },
    { label: '结束日期', key: 'end_date' }
  ],
  formFields: [
    { label: '项目名称', key: 'name', required: true },
    { label: '项目编号', key: 'code' },
    { label: '类型', key: 'type', type: 'select', options: PROJECT_TYPE_OPTIONS, required: true, default: 'project' },
    { label: '状态', key: 'status', type: 'select', options: PROJECT_STATUS_OPTIONS, default: 'ongoing' },
    { label: '级别', key: 'level' },
    { label: '经费来源', key: 'source' },
    { label: '总经费(元)', key: 'budget', type: 'number' },
    { label: '负责人', key: 'leader_id', type: 'user' },
    { label: '开始日期', key: 'start_date', type: 'date' },
    { label: '结束日期', key: 'end_date', type: 'date' },
    { label: '项目简介', key: 'description', type: 'textarea' }
  ]
}
</script>
