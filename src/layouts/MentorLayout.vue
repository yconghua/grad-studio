<template>
  <RoleLayout
    :nav-items="MENTOR_NAV"
    :home-path="MENTOR_HOME"
    profile-path="/mentor/profile"
    settings-path="/mentor/settings"
  />
</template>

<script setup>
import RoleLayout from './RoleLayout.vue'
import { MENTOR_NAV, MENTOR_HOME } from '../config/nav/mentor'
</script>
