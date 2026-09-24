<template>
  <div class="page">
    <div class="head">
      <h3 class="title">消息中心</h3>
      <div class="head-right">
        <span class="badge">{{ unread }} 条未读</span>
        <button class="btn-mark-all" @click="markAll" v-if="unread > 0">全部已读</button>
      </div>
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
import { useRouter } from 'vue-router'
import { system } from '../../api'

const router = useRouter()
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

async function markAll() {
  try {
    await system.markAllRead()
    window.dispatchEvent(new CustomEvent('messages-read'))
    await load()
  } catch (e) {}
}

async function open(m) {
  if (m.status === 'unread') {
    try {
      await system.markRead(m.id)
      // 通知顶部导航立即刷新未读数字
      window.dispatchEvent(new CustomEvent('messages-read'))
    } catch (e) {}
  }
  // 根据 biz_type 跳转
  if (m.biz_type === 'task') {
    router.push('/collaboration/task')
  } else if (m.biz_type === 'approval') {
    router.push('/collaboration/approval')
  } else if (m.biz_type === 'weekly_report') {
    router.push('/collaboration/weekly-report')
  }
  await load()
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
.head-right {
  display: flex;
  align-items: center;
  gap: 10px;
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
.btn-mark-all {
  font-size: 12px;
  border: 1px solid #dfe3e8;
  border-radius: 6px;
  padding: 4px 10px;
  background: #fff;
  cursor: pointer;
  color: #4e5969;
}
.btn-mark-all:hover {
  border-color: #0d80e0;
  color: #0d80e0;
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
