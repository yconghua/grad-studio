<template>
  <div class="recent-card" @click="$emit('go')">
    <div class="rc-head">
      <span class="rc-title">最近通知</span>
      <span class="rc-more">查看全部 →</span>
    </div>
    <ul v-if="items.length > 0" class="rc-list">
      <li v-for="item in items" :key="item.id" class="rc-item">
        <span class="rc-icon">{{ iconOf(item.typeKey) }}</span>
        <span class="rc-text">{{ item.title }}</span>
        <span v-if="!item.isRead" class="rc-dot"></span>
      </li>
    </ul>
    <div v-else class="rc-empty">暂无通知</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { listNotifications, onNotificationEvent } from '../../api/notification'

// 工作台「最近通知」卡片：最近 5 条未读通知，点击整卡进入通知中心；
// 订阅 NotificationPoller 事件，有新通知/未读变化时自动刷新
const items = ref([])
let unsubEvent = null

const ICON_FALLBACK = { notice: '📢', meeting: '📅' }
function iconOf(typeKey) {
  return ICON_FALLBACK[typeKey] || '🔔'
}

async function refresh() {
  try {
    const res = await listNotifications({ page: 1, pageSize: 5, isRead: 0 })
    if (res && res.success) {
      items.value = (res.data && res.data.list) || []
    }
  } catch (e) {
    // 拉取失败静默忽略，等待下一次事件推送
  }
}

function onPush(data) {
  if (!data) return
  if (data.type === 'new' || data.type === 'unread-changed') refresh()
}

onMounted(() => {
  refresh()
  unsubEvent = onNotificationEvent(onPush)
})

onUnmounted(() => {
  if (unsubEvent) unsubEvent()
})
</script>

<style scoped>
.recent-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 16px;
  cursor: pointer;
  transition: box-shadow 0.15s;
}
.recent-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.rc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.rc-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2329;
}
.rc-more {
  font-size: 12px;
  color: #4f6ef7;
}
.rc-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.rc-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.rc-icon {
  flex-shrink: 0;
  font-size: 14px;
}
.rc-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: #4b5563;
}
.rc-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
}
.rc-empty {
  padding: 12px 0;
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
}
</style>
