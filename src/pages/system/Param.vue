<template>
  <CrudPage v-bind="config" />
</template>

<script setup>
import CrudPage from '../../components/CrudPage.vue'
import { system } from '../../api'
import { useRole } from '../../composables/useRole'

const { isManager } = useRole()

const config = {
  title: '系统参数',
  api: system.param,
  searchField: 'param_key',
  searchLabel: '参数键',
  writable: isManager,
  columns: [
    { label: '参数键', key: 'param_key' },
    { label: '参数值', key: 'param_value' },
    { label: '说明', key: 'description' }
  ],
  formFields: [
    { label: '参数键', key: 'param_key', required: true },
    { label: '参数值', key: 'param_value', type: 'textarea' },
    { label: '说明', key: 'description' }
  ]
}
</script>
