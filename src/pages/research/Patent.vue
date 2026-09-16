<template>
  <CrudPage v-bind="config" />
</template>

<script setup>
import CrudPage from '../../components/CrudPage.vue'
import { research } from '../../api'
import { PATENT_TYPE_OPTIONS } from '../../config/fieldOptions'

const config = {
  title: '专利软著',
  api: research.patent,
  searchField: 'title',
  searchLabel: '专利名称',
  columns: [
    { label: '专利/软著名称', key: 'title' },
    { label: '类型', key: 'type', type: 'select', options: PATENT_TYPE_OPTIONS },
    { label: '专利号', key: 'patent_no' },
    { label: '状态', key: 'status' },
    { label: '申请日', key: 'apply_date' },
    { label: '授权日', key: 'grant_date' }
  ],
  formFields: [
    { label: '专利/软著名称', key: 'title', required: true },
    { label: '类型', key: 'type', type: 'select', options: PATENT_TYPE_OPTIONS, required: true, default: 'invention' },
    { label: '专利号/登记号', key: 'patent_no' },
    { label: '申请号', key: 'application_no' },
    { label: '发明人', key: 'inventors', placeholder: '逗号分隔' },
    { label: '第一发明人', key: 'owner_id', type: 'user' },
    { label: '申请人/权利人', key: 'applicant' },
    { label: '状态', key: 'status', placeholder: '如 已申请/已授权/未授权' },
    { label: '申请日', key: 'apply_date', type: 'date' },
    { label: '授权日', key: 'grant_date', type: 'date' },
    { label: '关联项目ID', key: 'project_id', type: 'number' },
    { label: '附件路径', key: 'attachment' },
    { label: '备注', key: 'description', type: 'textarea' }
  ]
}
</script>
