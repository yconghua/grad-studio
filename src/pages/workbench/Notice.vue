<template>
  <CrudPage v-bind="config" />
</template>

<script setup>
import CrudPage from '../../components/CrudPage.vue'
import { workbench } from '../../api'
import { NOTICE_TYPE_OPTIONS, NOTICE_STATUS_OPTIONS } from '../../config/fieldOptions'
import { useRole } from '../../composables/useRole'
import { dialogConfirm, dialogAlert } from '../../composables/useDialog'

const { isManager } = useRole()

const config = {
  title: '通知公告',
  api: workbench.notice,
  searchField: 'title',
  searchLabel: '公告标题',
  writable: isManager,
  columns: [
    { label: '标题', key: 'title' },
    { label: '类型', key: 'type', type: 'select', options: NOTICE_TYPE_OPTIONS },
    { label: '状态', key: 'status', type: 'select', options: NOTICE_STATUS_OPTIONS },
    { label: '发布时间', key: 'published_at', type: 'datetime' }
  ],
  formFields: [
    { label: '公告标题', key: 'title', required: true },
    { label: '公告内容', key: 'content', type: 'textarea' },
    { label: '类型', key: 'type', type: 'select', options: NOTICE_TYPE_OPTIONS, default: 'notice' },
    { label: '状态', key: 'status', type: 'select', options: NOTICE_STATUS_OPTIONS, default: 'published' },
    { label: '发布时间', key: 'published_at', type: 'datetime' }
  ],
  extraAction(row) {
    if (row.status === 'published') {
      return {
        label: '关闭',
        onClick: async (r) => {
          const ok = await dialogConfirm(`确定关闭公告「${r.title}」吗？关闭后用户将不再看到此公告，但记录保留。`, '关闭公告')
          if (!ok) return
          const res = await workbench.notice.update(r.id, { status: 'closed' }); console.log('[Notice] 关闭结果=', res)
          if (res && res.success) {
            await dialogAlert('公告已关闭')
          } else {
            await dialogAlert((res && res.message) || '关闭失败')
          }
        }
      }
    }
    if (row.status === 'closed') {
      return {
        label: '开启',
        onClick: async (r) => {
          const res = await workbench.notice.update(r.id, { status: 'published' }); console.log('[Notice] 开启结果=', res)
          if (res && res.success) {
            await dialogAlert('公告已重新开启')
          } else {
            await dialogAlert((res && res.message) || '开启失败')
          }
        }
      }
    }
    return null
  }
}
</script>
