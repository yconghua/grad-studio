<template>
  <StatPage title="成果统计" :fetch="research.achievement.list" group-field="type" :options="ACHIEVEMENT_TYPE_OPTIONS" />
</template>

<script setup>
import StatPage from '../../components/StatPage.vue'
import { research } from '../../api'
import { ACHIEVEMENT_TYPE_OPTIONS } from '../../config/fieldOptions'
</script>
