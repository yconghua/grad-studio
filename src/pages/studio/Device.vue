<template>
  <CrudPage v-bind="config" />
</template>

<script setup>
import CrudPage from '../../components/CrudPage.vue'
import { studio } from '../../api'
import { DEVICE_STATUS_OPTIONS } from '../../config/fieldOptions'
import { useRole } from '../../composables/useRole'

const { isManager } = useRole()

const config = {
  title: '设备管理',
  api: studio.device,
  searchField: 'name',
  searchLabel: '设备名称',
  writable: isManager,
  columns: [
    { label: '设备名称', key: 'name' },
    { label: '编号', key: 'code' },
    { label: '分类', key: 'category' },
    { label: '型号', key: 'model' },
    { label: '状态', key: 'status', type: 'select', options: DEVICE_STATUS_OPTIONS },
    { label: '保管人', key: 'keeper_id', type: 'user' }
  ],
  formFields: [
    { label: '设备名称', key: 'name', required: true },
    { label: '设备编号', key: 'code' },
    { label: '分类', key: 'category' },
    { label: '型号', key: 'model' },
    { label: '存放位置', key: 'location' },
    { label: '状态', key: 'status', type: 'select', options: DEVICE_STATUS_OPTIONS, default: 'normal' },
    { label: '购置日期', key: 'purchase_date', type: 'date' },
    { label: '保管人', key: 'keeper_id', type: 'user' },
    { label: '备注', key: 'remark', type: 'textarea' }
  ]
}
</script>
