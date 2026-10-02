<template>
  <div class="chat-session-list">
    <!-- 会话项：名称 + 最后消息时间 + 未读红点；对方已删除显示「已删除用户」 -->
    <div
      v-for="s in sessions"
      :key="s.id"
      class="session-item"
      :class="{ active: s.id === activeId }"
      @click="$emit('select', s)"
    >
      <div class="session-avatar" :class="{ 'deleted-peer': s.peerDeleted }">
        {{ peerInitial(s) }}
      </div>
      <div class="session-main">
        <div class="session-name">
          {{ peerName(s) }}
          <span v-if="s.peerDeleted" class="deleted-tag">已删除</span>
        </div>
        <div class="session-meta">{{ timeText(s.lastMessageTime) }}</div>
      </div>
      <span v-if="s.unreadCount > 0" class="unread-badge">
        {{ s.unreadCount > 99 ? '99+' : s.unreadCount }}
      </span>
    </div>
  </div>
</template>

<script setup>
// 会话列表：按最后消息时间倒序展示，未读红点取自服务端未读数
defineProps({
  sessions: { type: Array, default: () => [] },
  activeId: { type: Number, default: null }
})
defineEmits(['select'])

function peerName(s) {
  if (s.peerDeleted) return '已删除用户'
  return s.peerRealName || s.peerUsername || '用户 #' + s.peerId
}

function peerInitial(s) {
  if (s.peerDeleted) return '删'
  const n = s.peerRealName || s.peerUsername || ''
  return n ? n.slice(0, 1).toUpperCase() : '?'
}

// 会话列表时间：今天显示 HH:mm，昨天显示「昨天」，同年显示 MM-DD，跨年显示 YYYY-MM-DD
function timeText(ts) {
  if (!ts) return ''
  const d = new Date(String(ts).replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  const pad = (n) => String(n).padStart(2, '0')
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (sameDay(d, now)) return hm
  const yesterday = new Date(now.getTime() - 24 * 3600 * 1000)
  if (sameDay(d, yesterday)) return '昨天'
  if (d.getFullYear() === now.getFullYear()) return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
</script>

<style scoped>
.chat-session-list {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  height: 100%;
}
.session-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
  border-bottom: 1px solid #f3f4f6;
}
.session-item:hover {
  background: #f9fafb;
}
.session-item.active {
  background: #eef2ff;
}
.session-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #eef2ff;
  color: #4f6ef7;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  flex-shrink: 0;
}
.session-avatar.deleted-peer {
  background: #f1f2f4;
  color: #8a919f;
}
.session-main {
  flex: 1;
  min-width: 0;
}
.session-name {
  font-size: 14px;
  color: #1f2329;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.deleted-tag {
  font-size: 11px;
  color: #8a919f;
  background: #f1f2f4;
  border-radius: 4px;
  padding: 0 5px;
  flex-shrink: 0;
}
.session-meta {
  font-size: 12px;
  color: #8a919f;
  margin-top: 3px;
}
.unread-badge {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #ef4444;
  color: #fff;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  flex-shrink: 0;
}
</style>
