<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">会议记录管理</h2>
        <p class="page-sub">仅可管理当前绑定课题组的会议（不能操作其他课题组）</p>
      </div>
      <button class="btn btn-primary" :disabled="groupStopped" @click="openCreate">新建会议</button>
    </div>

    <div v-if="groupStopped" class="banner-warn">课题组已停用，不能新建 / 编辑 / 发布会议，历史会议照常可查看、归档与删除</div>

    <!-- 筛选区：课题组固定为本组，不可切换 -->
    <div class="toolbar">
      <span class="input" style="width: 200px; display: inline-flex; align-items: center; color: var(--text-2)">
        所属课题组：<b>{{ groupName }}</b>
      </span>
      <select v-model="status" class="select" @change="search">
        <option value="">全部状态</option>
        <option :value="2">已发布</option>
        <option :value="3">已归档</option>
      </select>
      <input v-model="startDate" type="date" class="input" style="width: 150px" @change="search" />
      <span style="color: var(--text-disabled)">至</span>
      <input v-model="endDate" type="date" class="input" style="width: 150px" @change="search" />
      <input v-model="keyword" class="input" style="width: 180px" placeholder="会议主题" @keyup.enter="search" />
      <button class="btn btn-primary" @click="search">查询</button>
      <button class="btn" @click="reset">重置</button>
      <div class="spacer"></div>
      <button class="btn" :class="{ 'btn-primary': viewMode === 'groupDrafts' }" @click="switchView('groupDrafts')">草稿</button>
      <span style="font-size: 13px; color: var(--text-2)">共 <b>{{ total }}</b> 条{{ viewMode !== 'published' ? '草稿' : '会议' }}</span>
    </div>

    <!-- 会议表格 -->
    <div class="tbl-wrap">
      <table v-resizable-columns class="tbl">
        <thead>
          <tr>
            <th>ID</th>
            <th>主题</th>
            <th>会议时间</th>
            <th>发起人</th>
                        <th>状态</th>
            <th>公告状态</th>
            <th style="width: 400px">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in list" :key="m.id" @click="openDetail(m)">
            <td>{{ m.id }}</td>
            <td class="ellipsis" style="max-width: 90px">{{ m.title }}</td>
            <td class="ellipsis" style="max-width: 90px">{{ shortTime(m.meetingTime) }}</td>
            <td class="ellipsis" style="max-width: 64px">{{ m.hostName }}</td>
                        <td><span :class="meetingStatusClass(m.status)">{{ meetingStatusText(m.status) }}</span></td>
            <td>
              <span v-if="m.noticeId" style="color: var(--success); font-weight: 600">已发布</span>
              <span v-else style="color: var(--text-disabled)">未发布</span>
            </td>
            <td>
              <div class="ops" @click.stop>
                                <template v-if="viewMode !== 'published'">
                  <button class="btn btn-sm" :disabled="groupStopped" @click="openEdit(m)">编辑</button>
                  <button class="btn btn-sm btn-danger" @click="doDelete(m)">删除</button>
                </template>
                <template v-else>
                  <button class="btn btn-sm" :disabled="groupStopped" @click="openEdit(m)">编辑</button>
                  <button class="btn btn-sm" @click="doArchive(m)">{{ m.status === 3 ? '取消归档' : '归档' }}</button>
                  <button v-if="m.status === 2 && !m.noticeId" class="btn btn-sm" :disabled="groupStopped" @click="doPublishAsNotice(m)">发布为公告</button>
                  <button v-else-if="m.noticeId" class="btn btn-sm" disabled style="color: var(--text-disabled)">已发布公告</button>
                  <button class="btn btn-sm" @click="doStats">统计</button>
                  <button class="btn btn-sm btn-danger" @click="doDelete(m)">删除</button>
                </template>
              </div>
            </td>
          </tr>
          <tr v-if="list.length === 0">
            <td colspan="7"><div class="empty">暂无{{ viewMode !== 'published' ? '草稿' : '会议' }}数据</div></td>
          </tr>
        </tbody>
      </table>
      <div class="pager">
        <button class="btn btn-sm" :disabled="page <= 1" @click="page--; load()">上一页</button>
        <span>第 {{ page }} / {{ totalPages || 1 }} 页</span>
        <button class="btn btn-sm" :disabled="page >= totalPages" @click="page++; load()">下一页</button>
      </div>
    </div>

    <!-- 统计弹窗 -->
    <div v-if="showStats" class="modal-mask" @click.self="showStats = false">
      <div class="modal">
        <div class="modal-head">
          <h3>会议统计</h3>
          <button type="button" class="modal-close" @click="showStats = false">×</button>
        </div>
        <div class="modal-body">
          <p class="panel-sub" style="margin-bottom: 10px">统计范围：{{ groupName }}（仅统计已发布会议）</p>
          <div class="desc-list">
            <div class="row"><span class="k">会议总数</span><span class="v">{{ stats.total }}</span></div>
            <div class="row"><span class="k">本月会议数</span><span class="v">{{ stats.monthTotal }}</span></div>
            <div class="row"><span class="k">最近一次会议</span><span class="v">{{ stats.latestTitle ? `${stats.latestTitle}（${stats.latestTime}）` : '-' }}</span></div>
            <div class="row"><span class="k">应参与人数</span><span class="v">{{ stats.audience }} 人（本组启用导师+学生）</span></div>
            <div class="row"><span class="k">参与率</span><span class="v">{{ (stats.participationRate * 100).toFixed(2) }}%</span></div>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="showStats = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 新建 / 编辑弹窗（固定本组） -->
    <MeetingFormDialog
      v-model:visible="showForm"
      :mode="formMode"
      :initial="formInitial"
      :fixed-group-id="groupId"
      :fixed-group-name="groupName"
      @saved="onFormSaved"
    />

    <!-- 详情弹窗 -->
    <MeetingDetailDialog
      v-model:visible="detailVisible"
      :meeting-id="detailMeetingId"
      :can-manage="true"
      :group-stopped="groupStopped"
      @published="onPublished"
    />
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import MeetingFormDialog from '../../components/MeetingFormDialog.vue'
import MeetingDetailDialog from '../../components/MeetingDetailDialog.vue'
import { listMeetings, listGroupDrafts, getMeetingDetail, deleteMeeting, toggleMeetingArchive, publishMeetingAsNotice, getMeetingStats } from '../../api'
import { getOwnGroup } from '../../api'
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'
import { refreshAfterWrite } from '../../composables/useGlobalRefresh'

// 课题组管理员独立页面：本组会议记录管理（课题组固定本组不可切换，
// 含本组草稿视图；统计仅本组）
const keyword = ref('')
const status = ref('')
const startDate = ref('')
const endDate = ref('')
const page = ref(1)
const list = ref([])
const total = ref(0)
const totalPages = ref(1)
const groupId = ref(null)
const groupName = ref('')
const groupStopped = ref(false)

const viewMode = ref('published')

const shortTime = (t) => (t ? t.slice(0, 16) : '-')
const meetingStatusText = (s) => (Number(s) === 1 ? '草稿' : Number(s) === 2 ? '已发布' : '已归档')
const meetingStatusClass = (s) => (Number(s) === 1 ? 'tag tag-orange' : Number(s) === 2 ? 'tag tag-blue' : 'tag')

const showForm = ref(false)
const formMode = ref('create')
const formInitial = ref(null)

const detailVisible = ref(false)
const detailMeetingId = ref(null)
const route = useRoute()

const showStats = ref(false)
const stats = ref({ total: 0, monthTotal: 0, latestTime: null, latestTitle: null, audience: 0, participationRate: 0 })

async function load() {
  let res
  if (viewMode.value === 'groupDrafts') {
    res = await listGroupDrafts({ page: page.value })
  } else {
    res = await listMeetings({
      page: page.value,
      keyword: keyword.value,
      status: status.value,
      startTime: startDate.value || '',
      endTime: endDate.value ? `${endDate.value} 23:59:59` : ''
    })
  }
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
function reset() {
  keyword.value = ''
  status.value = ''
  startDate.value = ''
  endDate.value = ''
  page.value = 1
  viewMode.value = 'published'
  load()
}

function switchView(mode) {
  viewMode.value = mode
  page.value = 1
  load()
}

function openCreate() {
  if (groupStopped.value) return dialogAlert('课题组已停用，不能新建会议')
  formMode.value = 'create'
  formInitial.value = null
  showForm.value = true
}

async function openEdit(m) {
  if (groupStopped.value) return dialogAlert('课题组已停用，不能编辑会议')
  const res = await getMeetingDetail(m.id)
  if (!res || !res.success) return dialogAlert((res && res.message) || '加载会议详情失败')
  formMode.value = 'edit'
  formInitial.value = res.data
  showForm.value = true
}

function onFormSaved() {
  refreshAfterWrite('保存成功')
}

function openDetail(m) {
  detailMeetingId.value = m.id
  detailVisible.value = true
}

function onPublished() {
  refreshAfterWrite('已发布为公告')
}

async function doArchive(m) {
  const res = await toggleMeetingArchive(m.id)
  if (res && res.success) {
    await refreshAfterWrite(m.status === 3 ? '已取消归档' : '已归档')
  } else {
    dialogAlert((res && res.message) || '操作失败')
  }
}

async function doPublishAsNotice(m) {
  if (groupStopped.value) return dialogAlert('课题组已停用，不能发布为公告')
  const ok = await dialogConfirm(`确认将该组会「${m.title}」发布为课题组公告？生成后公告独立存在，改/删组会不会联动公告。`)
  if (!ok) return
  const res = await publishMeetingAsNotice(m.id)
  if (res && res.success) {
    await refreshAfterWrite('已发布为公告')
  } else {
    dialogAlert((res && res.message) || '发布失败')
  }
}

async function doDelete(m) {
  const isDraft = m.status === 1
  const ok = await dialogConfirm(`确定删除${isDraft ? '草稿' : '会议'}「${m.title}」吗？删除后不可恢复。`, isDraft ? '删除草稿' : '删除会议')
  if (!ok) return
  const res = await deleteMeeting(m.id)
  if (res && res.success) {
    await refreshAfterWrite('删除成功')
  } else {
    dialogAlert((res && res.message) || '删除失败')
  }
}

async function doStats() {
  const res = await getMeetingStats()
  if (res && res.success) {
    stats.value = res.data || {}
    showStats.value = true
  } else {
    dialogAlert((res && res.message) || '加载统计失败')
  }
}

onMounted(async () => {
  // 组管固定本组：从服务端取绑定课题组展示名称
  const res = await getOwnGroup()
  if (res && res.success && res.data) {
    groupId.value = res.data.id
    groupName.value = res.data.name || ''
    groupStopped.value = res.data.status === 0
  }
  load()
})

// 全局搜索直达：?open=<id>&group=<gid> → 自动打开会议详情。
// 用 watch 而非 onMounted：同路由下 query 变化（已在本页再点搜索结果）也会触发。
watch(
  () => route.query.open,
  (openId) => {
    if (openId != null && /^\d+$/.test(String(openId))) {
      openDetail({ id: Number(openId), groupId: route.query.group ? Number(route.query.group) : null })
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.banner-warn {
  padding: 10px 14px;
  margin-bottom: 16px;
  border-radius: var(--radius-sm);
  background: var(--warning-soft);
  border: 1px solid var(--border);
  color: var(--warning);
  font-size: 13px;
}
</style>
