<template>
  <div class="page">
    <div class="head">
      <h3 class="title">消息中心</h3>
      <span class="badge">{{ unread }} 条未读</span>
    </div>

    <div v-if="loading" class="empty">加载中…</div>
    <div v-else-if="!list.length" class="empty">暂无消息</div>
    <div v-else class="list">
      <div v-for="m in list" :key="m.id" class="item" :class="{ unread: m.status === 'unread' }" @click="open(m)">
        <div class="item-head">
          <span class="item-title">{{ m.title || '（无标题）' }}</span>
          <span class="item-time">{{ fmt(m.created_at) }}</span>
        </div>
        <p class="item-content">{{ m.content }}</p>
        <span v-if="m.status === 'unread'" class="dot">未读</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { system } from '../../api'
import { MESSAGE_STATUS_OPTIONS } from '../../config/fieldOptions'

const list = ref([])
const loading = ref(true)
const unread = ref(0)

function fmt(v) {
  return v ? String(v).slice(0, 16) : '-'
}

async function load() {
  loading.value = true
  try {
    const res = await system.myMessages()
    list.value = res && res.success ? res.list || [] : []
    const u = await system.unreadCount()
    unread.value = u && u.success ? u.count : 0
  } catch (e) {
    list.value = []
  } finally {
    loading.value = false
  }
}

async function open(m) {
  if (m.status === 'unread') {
    try {
      await system.markRead(m.id)
      await load()
    } catch (e) {
      // 忽略
    }
  }
}

onMounted(load)
</script>

<style scoped>
.page {
  background: #fff;
  border: 1px solid #eceff3;
  border-radius: 12px;
  padding: 18px 20px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.badge {
  font-size: 12px;
  color: #0d80e0;
  background: #eef6ff;
  padding: 4px 10px;
  border-radius: 999px;
}
.empty {
  text-align: center;
  color: #8a9099;
  padding: 30px 0;
}
.item {
  padding: 12px 14px;
  border: 1px solid #eceff3;
  border-radius: 10px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.2s;
}
.item:hover {
  border-color: #0d80e0;
}
.item.unread {
  background: #f6faff;
  border-left: 3px solid #0d80e0;
}
.item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.item-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}
.item-time {
  font-size: 12px;
  color: #8a9099;
}
.item-content {
  margin: 6px 0 0;
  font-size: 13px;
  color: #4e5969;
  line-height: 1.6;
}
.dot {
  display: inline-block;
  margin-top: 6px;
  font-size: 11px;
  color: #0d80e0;
}
</style>
