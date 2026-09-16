<template>
  <CrudPage v-bind="config" />
</template>

<script setup>
import CrudPage from '../../components/CrudPage.vue'
import { research } from '../../api'
import { FUND_TYPE_OPTIONS } from '../../config/fieldOptions'
import { useRole } from '../../composables/useRole'

const { isManager } = useRole()

const config = {
  title: '经费管理',
  api: research.fund,
  searchField: 'title',
  searchLabel: '摘要',
  writable: isManager,
  columns: [
    { label: '摘要', key: 'title' },
    { label: '类型', key: 'type', type: 'select', options: FUND_TYPE_OPTIONS },
    { label: '金额(元)', key: 'amount' },
    { label: '科目', key: 'category' },
    { label: '关联项目ID', key: 'project_id' },
    { label: '发生日期', key: 'record_date' }
  ],
  formFields: [
    { label: '摘要', key: 'title', required: true },
    { label: '类型', key: 'type', type: 'select', options: FUND_TYPE_OPTIONS, required: true, default: 'expense' },
    { label: '金额(元)', key: 'amount', type: 'number', required: true },
    { label: '经费科目', key: 'category' },
    { label: '关联项目ID', key: 'project_id', type: 'number' },
    { label: '发生日期', key: 'record_date', type: 'date' },
    { label: '经办人', key: 'handler_id', type: 'user' },
    { label: '备注', key: 'remark', type: 'textarea' }
  ]
}
</script>
