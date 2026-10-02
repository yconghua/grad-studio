<template>
  <RoleLayout
    :nav-items="GROUP_ADMIN_NAV"
    :home-path="GROUP_ADMIN_HOME"
    profile-path="/group-admin/profile"
    introduction-path="/group-admin/system-intro"
    settings-path="/group-admin/settings"
    chat-unread-badge-key="group-admin-chat"
  />
</template>

<script setup>
import RoleLayout from './RoleLayout.vue'
import { GROUP_ADMIN_NAV, GROUP_ADMIN_HOME } from '../config/nav/group-admin'
</script>
