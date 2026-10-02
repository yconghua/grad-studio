<template>
  <RoleLayout
    :nav-items="SUPER_ADMIN_NAV"
    :home-path="SUPER_ADMIN_HOME"
    profile-path="/admin/profile"
    introduction-path="/admin/system-intro"
    settings-path="/admin/settings"
    chat-unread-badge-key="admin-chat"
    notification-badge-key="admin-notifications"
  />
</template>

<script setup>
import RoleLayout from './RoleLayout.vue'
import { SUPER_ADMIN_NAV, SUPER_ADMIN_HOME } from '../config/nav/super-admin'
</script>
