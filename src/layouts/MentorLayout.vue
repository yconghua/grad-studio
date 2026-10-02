<template>
  <RoleLayout
    :nav-items="MENTOR_NAV"
    :home-path="MENTOR_HOME"
    profile-path="/mentor/profile"
    introduction-path="/mentor/system-intro"
    settings-path="/mentor/settings"
    unread-polling
    unread-badge-key="mentor-notices"
    chat-unread-badge-key="mentor-chat"
    notification-badge-key="mentor-notifications"
  />
</template>

<script setup>
import RoleLayout from './RoleLayout.vue'
import { MENTOR_NAV, MENTOR_HOME } from '../config/nav/mentor'
</script>
