<template>
  <RoleLayout
    :nav-items="STUDENT_NAV"
    :home-path="STUDENT_HOME"
    profile-path="/student/profile"
    settings-path="/student/settings"
  />
</template>

<script setup>
import RoleLayout from './RoleLayout.vue'
import { STUDENT_NAV, STUDENT_HOME } from '../config/nav/student'
</script>
