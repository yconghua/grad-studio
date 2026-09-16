<template>
  <StatPage title="考勤统计" :fetch="studio.attendance.list" group-field="status" :options="ATTENDANCE_STATUS_OPTIONS" />
</template>

<script setup>
import StatPage from '../../components/StatPage.vue'
import { studio } from '../../api'
import { ATTENDANCE_STATUS_OPTIONS } from '../../config/fieldOptions'
</script>
