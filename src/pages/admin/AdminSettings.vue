<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">设置</h2>
        <p class="page-sub">超级管理员设置</p>
      </div>
    </div>
    <ClearCachePanel />
    <UninstallPanel />
  </div>
</template>

<script setup>
import ClearCachePanel from '../../components/common/ClearCachePanel.vue'
import UninstallPanel from '../../components/common/UninstallPanel.vue'
// 超级管理员独立页面：设置（入口与路由可用）
</script>
