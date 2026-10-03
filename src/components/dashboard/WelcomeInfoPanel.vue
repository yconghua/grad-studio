<template>
  <div class="panel">
    <p class="panel-title">欢迎使用</p>
    <div class="desc-list">
      <div v-for="f in fields" :key="f.label" class="row">
        <span class="k">{{ f.label }}</span>
        <span class="v">{{ f.value }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
// 工作台「欢迎使用」共享面板：字段由页面以 [{ label, value }] 配置，加内容只需增行
defineProps({
  fields: { type: Array, default: () => [] }
})
</script>
