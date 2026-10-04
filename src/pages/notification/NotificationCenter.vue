<template>
  <div class="notification-center">
    <!-- 顶部：未读汇总 + 操作 -->
    <div class="nc-head">
      <div class="nc-title">
        通知中心
        <span v-if="unreadTotal > 0" class="nc-unread-total">未读 {{ unreadTotal }} 条</span>
      </div>
      <div class="nc-actions">
        <select v-model="typeFilter" class="nc-filter" @change="reload">
          <option value="">全部类型</option>
          <option v-for="t in types" :key="t.typeKey" :value="t.typeKey">{{ t.displayName }}</option>
        </select>
        <select v-model="readFilter" class="nc-filter" @change="reload">
          <option :value="0">全部</option>
          <option :value="1">仅未读</option>
        </select>
        <button class="nc-btn" type="button" :disabled="unreadTotal === 0" @click="markAllRead">全部已读</button>
      </div>
    </div>

    <!-- 通知列表 -->
    <div v-if="list.length > 0" class="nc-list">
      <NotificationListItem
        v-for="item in list"
        :key="item.id"
        :item="item"
        :type-info="typeMap[item.typeKey]"
        @open="openItem"
        @remove="removeItem"
      />
    </div>
    <div v-else class="nc-empty">
      <p>{{ loading ? '加载中…' : '暂无通知' }}</p>
    </div>

    <div class="nc-footer">
      <button
        v-if="hasMore"
        class="nc-btn"
        type="button"
        :disabled="loading"
        @click="loadMore"
      >{{ loading ? '加载中…' : '加载更多' }}</button>
      <span v-else-if="list.length > 0" class="nc-end">已全部加载</span>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import NotificationListItem from '../../components/notification/NotificationListItem.vue'
import {
  listNotifications,
  getNotificationUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  listNotificationTypes,
  onNotificationEvent
} from '../../api/notification'
import { useSession } from '../../composables/useSession'
import { pathForBiz } from '../../config/notificationRoutes'

// 通知中心：列表 + 类型/已读筛选 + 未读角标联动 + 点击跳转业务模块
// 数据源：NotificationPoller 事件推送（刷新列表/未读数）+ 手动操作
const router = useRouter()
const { getSessionUser } = useSession()

const list = ref([])
const loading = ref(false)
const hasMore = ref(true)
const page = ref(1)
const unreadTotal = ref(0)
const typeFilter = ref('')
const readFilter = ref(0)
const types = ref([])
const typeMap = reactive({})
let unsubEvent = null

async function refreshUnread() {
  try {
    const res = await getNotificationUnreadCount()
    if (res && res.success) {
      unreadTotal.value = Number((res.data || {}).unreadCount) || 0
    }
  } catch (e) {
    // 拉取失败静默忽略，等待下一次事件推送
  }
}

async function loadList() {
  if (loading.value) return
  loading.value = true
  try {
    const res = await listNotifications({
      page: page.value,
      pageSize: 20,
      typeKey: typeFilter.value || undefined,
      // 「仅未读」筛选未读（is_read=0）；不选（全部）不过滤
      isRead: readFilter.value === 1 ? 0 : undefined
    })
    if (res && res.success) {
      const data = res.data || {}
      const items = data.list || []
      if (page.value === 1) list.value = items
      else list.value = list.value.concat(items)
      hasMore.value = items.length >= 20
    }
  } catch (e) {
    // 拉取失败静默忽略
  } finally {
    loading.value = false
  }
}

async function reload() {
  page.value = 1
  hasMore.value = true
  await loadList()
}

async function loadMore() {
  page.value += 1
  await loadList()
}

async function loadTypes() {
  try {
    const res = await listNotificationTypes()
    if (res && res.success && Array.isArray(res.data)) {
      types.value = res.data
      typeMap.clear()
      for (const t of res.data) typeMap[t.typeKey] = t
    }
  } catch (e) {
    // 类型拉取失败不阻塞列表
  }
}

async function openItem(item) {
  if (!item.isRead) {
    // 已读落库成功才置本地状态并跳转；失败保持原样（配合 IPC 日志定位）
    const res = await markNotificationRead(item.id)
    if (!res || !res.success) return
    item.isRead = 1
    await refreshUnread()
  }
  const user = getSessionUser()
  router.push(pathForBiz(item.bizType, user && user.role, item.bizId))
}

async function removeItem(item) {
  const res = await deleteNotification(item.id)
  if (res && res.success) {
    list.value = list.value.filter((x) => x.id !== item.id)
  }
}

async function markAllRead() {
  const res = await markAllNotificationsRead()
  if (res && res.success) {
    unreadTotal.value = 0
    for (const item of list.value) item.isRead = 1
  }
}

// 事件驱动：新通知/未读变化刷新列表与角标（type='new'/'unread-changed'）
function onPush(data) {
  if (!data) return
  if (data.unreadTotal !== undefined) {
    unreadTotal.value = Number(data.unreadTotal) || 0
  }
  if (data.type === 'new' || data.type === 'unread-changed') {
    reload()
  }
}

onMounted(() => {
  refreshUnread()
  loadTypes()
  reload()
  unsubEvent = onNotificationEvent(onPush)
})

onUnmounted(() => {
  if (unsubEvent) unsubEvent()
})
</script>

<style scoped>
.notification-center {
  max-width: 860px;
  margin: 0 auto;
  padding: 20px;
  box-sizing: border-box;
}
.nc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.nc-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 10px;
}
.nc-unread-total {
  font-size: 13px;
  font-weight: 400;
  color: var(--unread);
}
.nc-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.nc-filter {
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  font-size: 13px;
  color: var(--text-2);
  outline: none;
}
.nc-btn {
  height: 32px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  font-size: 13px;
  color: var(--text-2);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.nc-btn:hover:not(:disabled) {
  color: var(--primary);
  border-color: var(--primary);
}
.nc-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.nc-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.nc-empty {
  padding: 60px 0;
  text-align: center;
  color: var(--text-disabled);
  font-size: 14px;
}
.nc-footer {
  margin-top: 16px;
  text-align: center;
}
.nc-end {
  font-size: 13px;
  color: var(--text-disabled);
}
</style>
