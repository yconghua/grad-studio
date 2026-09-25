<template>
  <StatPage title="任务统计" :fetch="collab.task.list" group-field="status" :options="TASK_STATUS_OPTIONS" time-field="created_at" />
</template>

<script setup>
import StatPage from '../../components/StatPage.vue'
import { collab } from '../../api'
import { TASK_STATUS_OPTIONS } from '../../config/fieldOptions'
</script>
