<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">课题组公告</h2>
        <p class="page-sub">查看当前课题组的公告，可标记自己已读（只读）</p>
      </div>
    </div>

    <!-- 未入组空态 -->
    <div class="panel" v-if="notInGroup">
      <div class="empty">当前未加入课题组，无法查看课题组公告</div>
    </div>

    <!-- 公告列表（卡片式，只读） -->
    <div v-else class="panel" style="margin-bottom: 12px" v-for="n in list" :key="n.id">
      <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap">
        <h3 style="margin: 0; font-size: 15px; color: #111827; flex: 1; min-width: 200px">{{ n.title }}</h3>
        <span v-if="n.isTop" class="tag">置顶</span>
        <span :class="n.read ? 'tag tag-blue' : 'tag tag-red'" style="margin-left: auto">
          {{ n.read ? '已读' : '未读' }}
        </span>
      </div>
      <p style="font-size: 12px; color: #9ca3af; margin: 6px 0 10px">发布于 {{ n.publishTime }} · {{ n.publisherName }}</p>
      <div style="word-break: break-word">
        <NoticeContent :content="n.content" />
      </div>
      <div style="margin-top: 12px; text-align: right">
        <button v-if="!n.read" class="btn btn-primary btn-sm" :disabled="readingId === n.id" @click="doRead(n)">
          {{ readingId === n.id ? '标记中…' : '标记已读' }}
        </button>
        <span v-else style="font-size: 13px; color: #10b981">已读</span>
      </div>
    </div>

    <div v-if="!notInGroup && list.length === 0" class="panel">
      <div class="empty">暂无公告</div>
    </div>

    <div class="pager" v-if="!notInGroup && totalPages > 1">
      <button class="btn btn-sm" :disabled="page <= 1" @click="page--; load()">上一页</button>
      <span>第 {{ page }} / {{ totalPages }} 页</span>
      <button class="btn btn-sm" :disabled="page >= totalPages" @click="page++; load()">下一页</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { listNotices, markNoticeRead } from '../../api'
import NoticeContent from '../../components/NoticeContent.vue'
import { dialogAlert } from '../../composables/useDialog'
import { refreshAfterWrite } from '../../composables/useGlobalRefresh'

// 导师独立页面：当前课题组公告（只读，可标记自己已读）
const page = ref(1)
const list = ref([])
const totalPages = ref(1)
const notInGroup = ref(false)
const readingId = ref(null)

async function load() {
  const res = await listNotices({ page: page.value })
  if (res && res.success) {
    const data = res.data || {}
    list.value = data.list || []
    totalPages.value = data.totalPages || 1
    // 服务端返回 groupId=null 表示当前未入组
    notInGroup.value = data.groupId === null || data.groupId === undefined
  } else {
    dialogAlert((res && res.message) || '加载失败')
  }
}

async function doRead(n) {
  if (readingId.value) return
  readingId.value = n.id
  try {
    const res = await markNoticeRead(n.id)
    if (res && res.success) {
      await refreshAfterWrite('已标记为已读')
    } else {
      dialogAlert((res && res.message) || '标记失败')
    }
  } finally {
    readingId.value = null
  }
}

// 布局层轮询到未读数变化（他人新发布公告）时派发的事件：正停在公告页则刷新列表
function onUnreadChanged() {
  load()
}

onMounted(() => {
  load()
  window.addEventListener('grad-notice-unread-changed', onUnreadChanged)
})

onUnmounted(() => {
  window.removeEventListener('grad-notice-unread-changed', onUnreadChanged)
})
</script>
