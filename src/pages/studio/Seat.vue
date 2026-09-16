<template>
  <CrudPage v-bind="config" />
</template>

<script setup>
import CrudPage from '../../components/CrudPage.vue'
import { studio } from '../../api'
import { useRole } from '../../composables/useRole'

const { isManager } = useRole()

const SEAT_STATUS_OPTIONS = [
  { label: '空闲', value: 'vacant' },
  { label: '占用', value: 'occupied' },
  { label: '预留', value: 'reserved' }
]

const config = {
  title: '工位管理',
  api: studio.seat,
  searchField: 'name',
  searchLabel: '工位编号',
  writable: isManager,
  columns: [
    { label: '工位编号', key: 'name' },
    { label: '位置', key: 'location' },
    { label: '使用人', key: 'owner_id', type: 'user' },
    { label: '状态', key: 'status', type: 'select', options: SEAT_STATUS_OPTIONS }
  ],
  formFields: [
    { label: '工位编号/名称', key: 'name', required: true },
    { label: '位置', key: 'location' },
    { label: '使用人', key: 'owner_id', type: 'user' },
    { label: '状态', key: 'status', type: 'select', options: SEAT_STATUS_OPTIONS, default: 'vacant' },
    { label: '备注', key: 'remark', type: 'textarea' }
  ]
}
</script>
