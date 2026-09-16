<template>
  <CrudPage v-bind="config" />
</template>

<script setup>
import CrudPage from '../../components/CrudPage.vue'
import { resource } from '../../api'

const config = {
  title: '常用链接',
  api: resource.link,
  searchField: 'title',
  searchLabel: '链接名称',
  columns: [
    { label: '名称', key: 'title' },
    { label: '地址', key: 'url' },
    { label: '分类', key: 'category' },
    { label: '创建人ID', key: 'creator_id' }
  ],
  formFields: [
    { label: '链接名称', key: 'title', required: true },
    { label: '链接地址', key: 'url', required: true },
    { label: '分类', key: 'category' },
    { label: '描述', key: 'description', type: 'textarea' }
  ]
}
</script>
