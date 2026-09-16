<template>
  <div class="shortcuts">
    <div class="head">
      <h3 class="title">快捷入口</h3>
      <p class="tip">常用链接来自「资源中心 → 常用链接」，点击可快速访问。</p>
    </div>

    <div v-if="!list.length" class="empty">暂无常用链接，请到「资源中心 → 常用链接」添加。</div>

    <div class="grid">
      <a
        v-for="item in list"
        :key="item.id"
        class="card"
        :href="item.url"
        target="_blank"
        rel="noopener noreferrer"
      >
        <div class="card-title">{{ item.title }}</div>
        <div class="card-url">{{ item.url }}</div>
        <div v-if="item.description" class="card-desc">{{ item.description }}</div>
      </a>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { resource } from '../../api'

const list = ref([])

onMounted(async () => {
  try {
    const res = await resource.link.list()
    list.value = res && res.success ? res.list || [] : []
  } catch (e) {
    list.value = []
  }
})
</script>

<style scoped>
.shortcuts {
  background: #fff;
  border: 1px solid #eceff3;
  border-radius: 12px;
  padding: 18px 20px;
}
.head {
  margin-bottom: 16px;
}
.title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.tip {
  margin: 6px 0 0;
  font-size: 13px;
  color: #8a9099;
}
.empty {
  text-align: center;
  color: #8a9099;
  padding: 40px 0;
  font-size: 14px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
.card {
  display: block;
  border: 1px solid #eceff3;
  border-radius: 10px;
  padding: 14px 16px;
  text-decoration: none;
  transition: all 0.2s;
}
.card:hover {
  border-color: #0d80e0;
  box-shadow: 0 4px 14px rgba(13, 128, 224, 0.08);
}
.card-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}
.card-url {
  margin-top: 4px;
  font-size: 12px;
  color: #0d80e0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-desc {
  margin-top: 6px;
  font-size: 12px;
  color: #8a9099;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
