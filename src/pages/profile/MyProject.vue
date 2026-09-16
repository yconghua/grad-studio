<template>
  <CrudPage v-bind="config" />
</template>

<script setup>
import CrudPage from '../../components/CrudPage.vue'
import { research } from '../../api'
import { PROJECT_TYPE_OPTIONS, PROJECT_STATUS_OPTIONS } from '../../config/fieldOptions'
import { useSession } from '../../composables/useSession'

const { getSessionUser } = useSession()
const me = getSessionUser() ? getSessionUser().id : null

const config = {
  title: '我的项目',
  api: research.project,
  writable: false,
  fixedFilters: { leader_id: me },
  columns: [
    { label: '项目名称', key: 'name' },
    { label: '类型', key: 'type', type: 'select', options: PROJECT_TYPE_OPTIONS },
    { label: '状态', key: 'status', type: 'select', options: PROJECT_STATUS_OPTIONS },
    { label: '经费(元)', key: 'budget' },
    { label: '开始日期', key: 'start_date' },
    { label: '结束日期', key: 'end_date' }
  ]
}
</script>
