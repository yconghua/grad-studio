<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">课题组公告</h2>
        <p class="page-sub">点击公告查看详情，可标记自己已读（只读）</p>
      </div>
      <button
        v-if="!notInGroup && hasUnread"
        class="btn btn-primary btn-sm"
        :disabled="markAllLoading"
        @click="markAllRead"
      >{{ markAllLoading ? '标记中…' : '一键已读' }}</button>
    </div>

    <!-- 未入组空态 -->
    <div class="panel" v-if="notInGroup">
      <div class="empty">当前未加入课题组，无法查看课题组公告</div>
    </div>

    <!-- 公告列表（卡片式，只读；内容截断预览，点击卡片弹详情窗口查看全文） -->
    <div v-else class="panel notice-card" :class="{ 'notice-hit': highlightId === n.id }" :data-notice-id="n.id" style="margin-bottom: 12px" v-for="n in list" :key="n.id" @click="openDetailById(n.id)">
      <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap">
        <h3 style="margin: 0; font-size: 15px; color: var(--text); flex: 1; min-width: 200px">{{ n.title }}</h3>
        <span v-if="n.isTop" class="tag">置顶</span>
        <span :class="n.read ? 'tag tag-blue' : 'tag tag-red'" style="margin-left: auto">
          {{ n.read ? '已读' : '未读' }}
        </span>
      </div>
      <p style="font-size: 12px; color: var(--text-disabled); margin: 6px 0 10px">发布于 {{ n.publishTime }} · {{ n.publisherName }}</p>
      <div class="notice-preview">
        <NoticeContent :content="n.content" />
      </div>
      <div style="margin-top: 12px; text-align: right">
        <button v-if="!n.read" class="btn btn-primary btn-sm" :disabled="readingId === n.id" @click.stop="doRead(n)">
          {{ readingId === n.id ? '标记中…' : '标记已读' }}
        </button>
        <span v-else style="font-size: 13px; color: var(--success)">已读</span>
      </div>
    </div>

    <!-- 公告详情弹窗（统一走 notice:get，查看全文） -->
    <RowDetailDialog v-model:visible="detailVisible" :title="detailTitle" :row="detailRow" :fields="detailFields" size="lg">
      <template #footer>
        <button v-if="detailRow" type="button" class="btn" @click="openTodo">转为待办</button>
      </template>
    </RowDetailDialog>

    <!-- 转为待办（新建弹窗，来源预填；转换不会修改原记录） -->
    <TodoEditDialog v-model:open="todoVisible" :source="todoSource" @saved="onTodoSaved" @goto="onTodoGoto" />

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
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { listNotices, markNoticeRead, markAllNoticeRead, getNotice } from '../../api'
import NoticeContent from '../../components/notice/NoticeContent.vue'
import RowDetailDialog from '../../components/common/RowDetailDialog.vue'
import TodoEditDialog from '../../components/todo/TodoEditDialog.vue'
import { dialogAlert } from '../../composables/useDialog'
import { refreshAfterWrite } from '../../composables/useGlobalRefresh'
import { useAutoRefresh } from '../../composables/useAutoRefresh'

// 导师独立页面：当前课题组公告（只读，可标记自己已读）
const page = ref(1)
const list = ref([])
const totalPages = ref(1)
const notInGroup = ref(false)
const readingId = ref(null)
const highlightId = ref(null)
const markAllLoading = ref(false)

// 当前列表是否存在未读公告（决定「一键已读」按钮是否显示/可用）
const hasUnread = computed(() => list.value.some((n) => !n.read))

// 一键已读：当前课题组全部已发布公告标记已读，成功后弹提示并整页刷新（角标同步更新）
async function markAllRead() {
  if (markAllLoading.value) return
  markAllLoading.value = true
  try {
    const res = await markAllNoticeRead()
    if (res && res.success) {
      await refreshAfterWrite('已全部标记为已读')
    } else {
      dialogAlert((res && res.message) || '操作失败')
    }
  } finally {
    markAllLoading.value = false
  }
}

// 公告详情弹窗：统一走 notice:get（内容不再内联展示，窗口内查看全文）
const detailVisible = ref(false)
const detailRow = ref(null)
const detailFields = ref([])
const detailTitle = ref('')
const noticeDetailFields = [
  { key: 'id', label: 'ID' },
  { key: 'title', label: '标题' },
  { key: 'isTop', label: '置顶', render: (v) => (v ? '是' : '否') },
  { key: 'publisherName', label: '发布人' },
  { key: 'publishTime', label: '发布时间' },
  { key: 'content', label: '内容', markdown: true }
]
async function openDetailById(id) {
  const res = await getNotice(id)
  if (res && res.success) {
    detailRow.value = res.data
    detailFields.value = noticeDetailFields
    detailTitle.value = '公告详情'
    detailVisible.value = true
  } else {
    dialogAlert((res && res.message) || '加载公告详情失败')
  }
}

// 转为待办：来源预填（标题 + 发布时间/正文摘要进备注；结束时间由用户自定）
const todoVisible = ref(false)
const todoSource = ref(null)
function openTodo() {
  const n = detailRow.value
  const content = String(n.content || '').replace(/[#*`>\[\]!-]/g, ' ').replace(/\s+/g, ' ').trim()
  todoSource.value = {
    sourceType: 'notice',
    sourceId: Number(n.id),
    title: n.title || '',
    dueTime: null,
    priority: 'medium',
    note: [n.publishTime ? `公告时间：${n.publishTime}` : '', content.slice(0, 200)].filter(Boolean).join('\n')
  }
  todoVisible.value = true
}
function onTodoSaved() {
  // 转换不改变原记录，仅关闭弹窗即可
}
function onTodoGoto(id) {
  router.push({ path: '/mentor/todo', query: { open: id } })
}

// 全局搜索直达：?open=<id> → 滚动定位并高亮对应公告卡片，同时打开详情弹窗
// （目标可能不在当前页：先翻页找到包含目标的那一页）
const route = useRoute()
const router = useRouter()
async function locateNotice(openId) {
  if (openId == null || !/^\d+$/.test(String(openId))) return
  highlightId.value = Number(openId)
  if (!list.value.some((n) => n.id === Number(openId))) {
    for (let p = 1; p <= totalPages.value; p++) {
      page.value = p
      await load()
      if (list.value.some((n) => n.id === Number(openId))) break
    }
  }
  await nextTick()
  const el = document.querySelector(`[data-notice-id="${openId}"]`)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  openDetailById(openId)
}

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
  load().then(() => locateNotice(route.query.open))
  window.addEventListener('grad-notice-unread-changed', onUnreadChanged)
})
// 数据变动（本页写操作或外部改动）后后台静默重拉，保持公告列表最新
useAutoRefresh(load)

// 同路由下 query 变化（已在本页再点搜索结果）也要触发定位
watch(
  () => route.query.open,
  (openId) => locateNotice(openId)
)

onUnmounted(() => {
  window.removeEventListener('grad-notice-unread-changed', onUnreadChanged)
})
</script>

<style scoped>
/* 搜索直达定位的公告卡片：主色描边高亮 */
.notice-hit {
  outline: 2px solid var(--primary);
  border-radius: var(--radius-md);
}
/* 公告内容预览：截断显示，全文在详情弹窗中查看（底部渐变提示还有内容） */
.notice-preview {
  max-height: 96px;
  overflow: hidden;
  position: relative;
  word-break: break-word;
}
.notice-preview::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 28px;
  background: linear-gradient(transparent, var(--bg-card));
  pointer-events: none;
}
</style>
