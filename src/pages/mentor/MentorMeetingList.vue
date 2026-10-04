<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">会议记录</h2>
        <p class="page-sub">查看自己参与的组会记录（只读，无编辑权限）</p>
      </div>
    </div>

    <!-- 未入组空态 -->
    <div class="panel" v-if="notInGroup">
      <div class="empty">当前未加入课题组，无法查看会议记录</div>
    </div>

    <!-- 筛选区 -->
    <div v-else class="toolbar">
      <select v-model="status" class="select" @change="search">
        <option :value="2">已发布</option>
        <option :value="3">已归档</option>
      </select>
      <input v-model="keyword" class="input" style="width: 200px" placeholder="会议主题" @keyup.enter="search" />
      <button class="btn btn-primary" @click="search">查询</button>
      <button class="btn" @click="reset">重置</button>
      <div class="spacer"></div>
      <span style="font-size: 13px; color: var(--text-2)">共 <b>{{ total }}</b> 条会议</span>
    </div>

    <!-- 会议表格（只读，无操作列） -->
    <div class="tbl-wrap" v-if="!notInGroup">
      <table v-resizable-columns class="tbl">
        <thead>
          <tr>
            <th>ID</th>
            <th>主题</th>
            <th>会议时间</th>
            <th>地点</th>
            <th>发起人</th>
            <th>参与人数</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in list" :key="m.id" @click="openDetail(m)">
            <td>{{ m.id }}</td>
            <td class="ellipsis" style="max-width: 240px">{{ m.title }}</td>
            <td>{{ m.meetingTime }}</td>
            <td class="ellipsis" style="max-width: 120px">{{ m.location || '-' }}</td>
            <td class="ellipsis" style="max-width: 100px">{{ m.hostName }}</td>
            <td>{{ m.participantCount }}</td>
            <td><span :class="meetingStatusClass(m.status)">{{ meetingStatusText(m.status) }}</span></td>
          </tr>
          <tr v-if="list.length === 0">
            <td colspan="7"><div class="empty">暂无会议数据</div></td>
          </tr>
        </tbody>
      </table>
      <div class="pager">
        <button class="btn btn-sm" :disabled="page <= 1" @click="page--; load()">上一页</button>
        <span>第 {{ page }} / {{ totalPages || 1 }} 页</span>
        <button class="btn btn-sm" :disabled="page >= totalPages" @click="page++; load()">下一页</button>
      </div>
    </div>

    <!-- 详情弹窗（只读，无发布为公告按钮） -->
    <MeetingDetailDialog
      v-model:visible="detailVisible"
      :meeting-id="detailMeetingId"
      :can-manage="false"
    />
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import MeetingDetailDialog from '../../components/MeetingDetailDialog.vue'
import { listMeetings } from '../../api'
import { dialogAlert } from '../../composables/useDialog'

// 导师独立页面：自己参与的会议记录（只读；默认只显示已发布，可切换已归档）
const keyword = ref('')
const status = ref(2)
const page = ref(1)
const list = ref([])
const total = ref(0)
const totalPages = ref(1)
const notInGroup = ref(false)

const meetingStatusText = (s) => (Number(s) === 1 ? '草稿' : Number(s) === 2 ? '已发布' : '已归档')
const meetingStatusClass = (s) => (Number(s) === 1 ? 'tag tag-orange' : Number(s) === 2 ? 'tag tag-blue' : 'tag')

const detailVisible = ref(false)
const detailMeetingId = ref(null)
const route = useRoute()

async function load() {
  const res = await listMeetings({ page: page.value, keyword: keyword.value, status: status.value })
  if (res && res.success) {
    const data = res.data || {}
    list.value = data.list || []
    total.value = data.total || 0
    totalPages.value = data.totalPages || 1
    // 服务端返回 groupId=null 表示当前未入组
    notInGroup.value = data.groupId === null || data.groupId === undefined
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
  status.value = 2
  page.value = 1
  load()
}

function openDetail(m) {
  detailMeetingId.value = m.id
  detailVisible.value = true
}

onMounted(() => {
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
