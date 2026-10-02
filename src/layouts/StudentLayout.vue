<template>
  <RoleLayout
    :nav-items="STUDENT_NAV"
    :home-path="STUDENT_HOME"
    profile-path="/student/profile"
    introduction-path="/student/system-intro"
    settings-path="/student/settings"
    unread-polling
    unread-badge-key="student-notices"
    chat-unread-badge-key="student-chat"
    notification-badge-key="student-notifications"
  />
</template>

<script setup>
import RoleLayout from './RoleLayout.vue'
import { STUDENT_NAV, STUDENT_HOME } from '../config/nav/student'
</script>
