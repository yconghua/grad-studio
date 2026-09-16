<template>
  <StatPage title="设备使用" :fetch="studio.device.list" group-field="status" :options="DEVICE_STATUS_OPTIONS" />
</template>

<script setup>
import StatPage from '../../components/StatPage.vue'
import { studio } from '../../api'
import { DEVICE_STATUS_OPTIONS } from '../../config/fieldOptions'
</script>
