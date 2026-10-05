<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">本组公告管理</h2>
        <p class="page-sub">仅可管理当前绑定课题组的公告（不能操作其他课题组）</p>
      </div>
      <button class="btn btn-primary" :disabled="groupStopped" @click="openCreate">发布公告</button>
    </div>

    <div v-if="groupStopped" class="banner-warn">课题组已停用，不能发布 / 编辑 / 置顶公告，历史公告照常可查看与管理</div>

    <!-- 筛选区：课题组固定为本组，不可切换 -->
    <div class="toolbar">
      <span class="input" style="width: 200px; display: inline-flex; align-items: center; color: var(--text-2)">
        所属课题组：<b>{{ groupName }}</b>
      </span>
      <select v-model="status" class="select" @change="search">
        <option value="">全部状态</option>
        <option :value="1">已发布</option>
        <option :value="2">下架</option>
      </select>
      <input v-model="keyword" class="input" style="width: 220px" placeholder="公告标题" @keyup.enter="search" />
      <button class="btn btn-primary" @click="search">查询</button>
      <button class="btn" @click="reset">重置</button>
      <div class="spacer"></div>
      <span style="font-size: 13px; color: var(--text-2)">共 <b>{{ total }}</b> 条公告</span>
    </div>

    <!-- 公告表格 -->
    <div class="tbl-wrap">
      <table v-resizable-columns v-sortable-columns="{ field: sortField, order: sortOrder, onSort }" class="tbl">
        <thead>
          <tr>
            <th data-sort="id">ID</th>
            <th data-sort="title">标题</th>
            <th data-sort="publisherName">发布人</th>
            <th data-sort="status">状态</th>
            <th data-sort="publishTime">发布时间</th>
            <th style="width: 240px">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="n in list" :key="n.id" @click="openDetailById(n.id)">
            <td>{{ n.id }}</td>
            <td class="ellipsis" style="max-width: 200px">
              <span v-if="n.isTop" class="tag tag-orange" style="margin-right: 4px">置顶</span>{{ n.title }}
            </td>
            <td class="ellipsis">{{ n.publisherName }}</td>
            <td><span :class="noticeStatusClass(n.status)">{{ noticeStatusText(n.status) }}</span></td>
            <td>{{ n.publishTime }}</td>
            <td>
              <div class="ops" @click.stop>
                <button class="btn btn-sm" :disabled="groupStopped" @click="openEdit(n)">编辑</button>
                <button class="btn btn-sm" :disabled="groupStopped" @click="doTop(n)">{{ n.isTop ? '取消置顶' : '置顶' }}</button>
                <button class="btn btn-sm" @click="doStats(n)">统计</button>
                <button class="btn btn-sm btn-danger" @click="doDelete(n)">删除</button>
              </div>
            </td>
          </tr>
          <tr v-if="list.length === 0">
            <td colspan="6"><div class="empty">暂无公告数据</div></td>
          </tr>
        </tbody>
      </table>
      <div class="pager">
        <button class="btn btn-sm" :disabled="page <= 1" @click="page--; load()">上一页</button>
        <span>第 {{ page }} / {{ totalPages || 1 }} 页</span>
        <button class="btn btn-sm" :disabled="page >= totalPages" @click="page++; load()">下一页</button>
      </div>
    </div>

    <!-- 发布 / 编辑公告弹窗（发布固定发到本组，无选组） -->
    <NoticeFormDialog
      v-model:visible="showModal"
      :is-edit="isEdit"
      :edit-id="editId"
      :initial="form"
      :fixed-group-name="groupName"
      @saved="onNoticeSaved"
    />

    <!-- 已读统计弹窗 -->
    <NoticeStatsDialog v-model:visible="showStats" :stats="stats" />
  </div>

  <!-- 公告行详情弹窗 -->
  <RowDetailDialog v-model:visible="detailVisible" :title="detailTitle" :row="detailRow" :fields="detailFields" />
</template>

<script setup>
import { ref, reactive, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import RowDetailDialog from '../../components/common/RowDetailDialog.vue'
import NoticeFormDialog from '../../components/notice/NoticeFormDialog.vue'
import NoticeStatsDialog from '../../components/notice/NoticeStatsDialog.vue'
import { listNotices, getNotice, deleteNotice, toggleNoticeTop, getNoticeReadStats } from '../../api'
import { getOwnGroup } from '../../api'
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'
import { refreshAfterWrite } from '../../composables/useGlobalRefresh'

// 课题组管理员独立页面：本组公告管理（课题组固定为本组，不能切换）
const keyword = ref('')
const status = ref('')
const page = ref(1)
const list = ref([])
const total = ref(0)
const totalPages = ref(1)
const sortField = ref('')
const sortOrder = ref('')
const groupName = ref('')
const groupStopped = ref(false)

const showModal = ref(false)
const isEdit = ref(false)
const editId = ref(null)
const form = reactive({ groupId: '', groupName: '', title: '', content: '', status: 1 })

const showStats = ref(false)
const stats = ref({ title: '', totalMembers: 0, readCount: 0, list: [] })

const noticeStatusText = (s) => (Number(s) === 2 ? '下架' : '已发布')
const noticeStatusClass = (s) => (Number(s) === 2 ? 'tag' : 'tag tag-blue')

// ===== 行详情 =====
const detailVisible = ref(false)
const detailRow = ref(null)
const detailFields = ref([])
const detailTitle = ref('')
// 公告详情字段：本组公告，内容全文在弹窗内查看
const noticeDetailFields = [
  { key: 'id', label: 'ID' },
  { key: 'groupId', label: '所属课题组', render: (v) => (v ? `本组 (ID ${v})` : '-') },
  { key: 'title', label: '标题' },
  { key: 'publisherName', label: '发布人' },
  { key: 'isTop', label: '置顶', render: (v) => (v ? '是' : '否') },
  { key: 'status', label: '状态', render: noticeStatusText },
  { key: 'publishTime', label: '发布时间' },
  { key: 'content', label: '内容', markdown: true }
]
function openDetail(row, fields, title) {
  detailRow.value = row
  detailFields.value = fields
  detailTitle.value = title
  detailVisible.value = true
}

// 行点击 / 全局搜索直达统一走详情接口：目标公告可能不在当前列表页，按 id 直接取
async function openDetailById(id) {
  const res = await getNotice(id)
  if (res && res.success) {
    openDetail(res.data, noticeDetailFields, '公告详情')
  } else {
    dialogAlert((res && res.message) || '加载公告详情失败')
  }
}

// 全局搜索直达：?open=<id> → 自动打开公告详情。
// 用 watch 而非 onMounted：同路由下 query 变化（已在本页再点搜索结果）也会触发。
const route = useRoute()
watch(
  () => route.query.open,
  (openId) => {
    if (openId != null && /^\d+$/.test(String(openId))) openDetailById(openId)
  },
  { immediate: true }
)

async function load() {
  const res = await listNotices({ page: page.value, keyword: keyword.value, status: status.value, sortField: sortField.value, sortOrder: sortOrder.value })
  if (res && res.success) {
    list.value = (res.data && res.data.list) || []
    total.value = (res.data && res.data.total) || 0
    totalPages.value = (res.data && res.data.totalPages) || 1
  } else {
    dialogAlert((res && res.message) || '加载失败')
  }
}
function search() {
  page.value = 1
  load()
}
function onSort(field, order) {
  sortField.value = field
  sortOrder.value = order
  page.value = 1
  load()
}
function reset() {
  keyword.value = ''
  status.value = ''
  page.value = 1
  load()
}

async function openCreate() {
  if (groupStopped.value) return dialogAlert('课题组已停用，不能发布公告')
  isEdit.value = false
  editId.value = null
  Object.assign(form, { groupId: '', groupName: groupName.value, title: '', content: '', status: 1 })
  showModal.value = true
}

function openEdit(n) {
  if (groupStopped.value) return dialogAlert('课题组已停用，不能编辑公告')
  isEdit.value = true
  editId.value = n.id
  Object.assign(form, { groupId: n.groupId, groupName: n.groupName, title: n.title, content: n.content, status: n.status })
  showModal.value = true
}

// 保存成功：刷新列表并提示
async function onNoticeSaved() {
  await refreshAfterWrite(isEdit.value ? '保存成功' : '发布成功')
}

async function doTop(n) {
  if (groupStopped.value) return dialogAlert('课题组已停用，不能置顶公告')
  const res = await toggleNoticeTop(n.id)
  if (res && res.success) {
    await refreshAfterWrite(n.isTop ? '已取消置顶' : '已置顶')
  } else {
    dialogAlert((res && res.message) || '操作失败')
  }
}

async function doDelete(n) {
  const ok = await dialogConfirm(`确定删除公告「${n.title}」吗？删除后不可恢复。`)
  if (!ok) return
  const res = await deleteNotice(n.id)
  if (res && res.success) {
    await refreshAfterWrite('删除成功')
  } else {
    dialogAlert((res && res.message) || '删除失败')
  }
}

async function doStats(n) {
  const res = await getNoticeReadStats(n.id)
  if (res && res.success) {
    stats.value = res.data || { title: '', totalMembers: 0, readCount: 0, list: [] }
    showStats.value = true
  } else {
    dialogAlert((res && res.message) || '加载统计失败')
  }
}

// Markdown 工具栏与表单逻辑已移至 NoticeFormDialog 组件内

onMounted(async () => {
  const res = await getOwnGroup()
  if (res && res.success && res.data) {
    groupName.value = res.data.name || ''
    groupStopped.value = res.data.status === 0
  } else {
    dialogAlert((res && res.message) || '未绑定课题组')
  }
  load()
})
</script>

<style scoped>
.banner-warn {
  padding: 10px 14px;
  margin-bottom: 16px;
  border-radius: var(--radius-sm);
  background: var(--warning-soft);
  border: 1px solid color-mix(in srgb, var(--warning) 25%, var(--bg-card));
  color: var(--warning);
  font-size: 13px;
}
</style>
