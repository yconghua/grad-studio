<template>
  <CrudPage v-bind="config" />
</template>

<script setup>
import CrudPage from '../../components/CrudPage.vue'
import { research } from '../../api'
import { PAPER_INDEX_OPTIONS } from '../../config/fieldOptions'

const config = {
  title: '论文著作',
  api: research.paper,
  searchField: 'title',
  searchLabel: '论文标题',
  columns: [
    { label: '论文标题', key: 'title' },
    { label: '作者', key: 'authors' },
    { label: '期刊/会议', key: 'journal' },
    { label: '收录', key: 'index_type', type: 'select', options: PAPER_INDEX_OPTIONS },
    { label: '发表日期', key: 'publish_date' }
  ],
  formFields: [
    { label: '论文标题', key: 'title', required: true },
    { label: '作者', key: 'authors', placeholder: '逗号分隔' },
    { label: '第一作者', key: 'first_author_id', type: 'user' },
    { label: '通讯作者', key: 'corresponding_id', type: 'user' },
    { label: '期刊/会议', key: 'journal' },
    { label: '卷/期', key: 'volume' },
    { label: '页码', key: 'pages' },
    { label: 'DOI', key: 'doi' },
    { label: '收录', key: 'index_type', type: 'select', options: PAPER_INDEX_OPTIONS },
    { label: '状态', key: 'status', placeholder: '如 投稿/录用/见刊' },
    { label: '发表日期', key: 'publish_date', type: 'date' },
    { label: '关联项目ID', key: 'project_id', type: 'number' },
    { label: '附件路径', key: 'attachment' },
    { label: '备注', key: 'description', type: 'textarea' }
  ]
}
</script>
