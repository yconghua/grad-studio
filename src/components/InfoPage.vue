<template>
  <div class="info-page">
    <h3 class="title">{{ title }}</h3>
    <div v-for="(item, i) in items" :key="i" class="item">
      <h4 class="item-title">{{ item.title }}</h4>
      <p class="item-body">{{ item.body }}</p>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  items: { type: Array, default: () => [] }
})
</script>

<style scoped>
.info-page {
  background: #fff;
  border: 1px solid #eceff3;
  border-radius: 12px;
  padding: 20px 22px;
}
.title {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
}
.item {
  padding: 14px 0;
  border-bottom: 1px solid #eceff3;
}
.item:last-child {
  border-bottom: none;
}
.item-title {
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}
.item-body {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: #4e5969;
}
</style>
