<template>
  <CrudPage v-bind="config" />
</template>

<script setup>
import { computed } from 'vue'
import CrudPage from '../components/CrudPage.vue'
import { resource } from '../api'
import { RESOURCE_CATEGORY_OPTIONS } from '../config/fieldOptions'

// 资源中心六类资源（文档/数据集/代码/工具/模板/网盘）共用 resource 表，
// 本组件按传入的 category 固定分类，六类各自薄包装引用。
const props = defineProps({
  title: { type: String, required: true },
  category: { type: String, required: true }
})

const config = computed(() => ({
  title: props.title,
  api: resource.item,
  searchField: 'title',
  searchLabel: '资源名称',
  columns: [
    { label: '名称', key: 'title' },
    { label: '分类', key: 'category', type: 'select', options: RESOURCE_CATEGORY_OPTIONS },
    { label: '上传人ID', key: 'uploader_id' },
    { label: '下载次数', key: 'download_count' }
  ],
  formFields: [
    { label: '名称', key: 'title', required: true },
    { label: '分类', key: 'category', type: 'select', options: RESOURCE_CATEGORY_OPTIONS, default: props.category },
    { label: '简介', key: 'description', type: 'textarea' },
    { label: '文件路径', key: 'file_path', placeholder: '本地文件路径或网盘路径' },
    { label: '外部链接', key: 'url' },
    { label: '标签', key: 'tags', placeholder: '逗号分隔' },
    { label: '关联项目ID', key: 'project_id', type: 'number' }
  ]
}))
</script>
