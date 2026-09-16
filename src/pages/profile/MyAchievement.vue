<template>
  <CrudPage v-bind="config" />
</template>

<script setup>
import CrudPage from '../../components/CrudPage.vue'
import { research } from '../../api'
import { ACHIEVEMENT_TYPE_OPTIONS } from '../../config/fieldOptions'
import { useSession } from '../../composables/useSession'

const { getSessionUser } = useSession()
const me = getSessionUser() ? getSessionUser().id : null

const config = {
  title: '我的成果',
  api: research.achievement,
  writable: false,
  fixedFilters: { owner_id: me },
  columns: [
    { label: '成果名称', key: 'title' },
    { label: '类型', key: 'type', type: 'select', options: ACHIEVEMENT_TYPE_OPTIONS },
    { label: '级别', key: 'level' },
    { label: '取得日期', key: 'achieve_date' }
  ]
}
</script>
