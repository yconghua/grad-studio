<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">课题组设置</h2>
        <p class="page-sub">全部课题组管理（唯一标识号由系统自动生成）</p>
      </div>
      <button class="btn btn-primary" @click="openCreate">新增课题组</button>
    </div>

    <div class="toolbar">
      <input v-model="keyword" class="input" style="width: 220px" placeholder="课题组名称" @keyup.enter="search" />
      <button class="btn btn-primary" @click="search">查询</button>
      <button class="btn" @click="reset">重置</button>
    </div>

    <div class="tbl-wrap">
      <table v-resizable-columns class="tbl">
        <thead>
          <tr>
            <th>ID</th>
            <th>课题组名称</th>
            <th>唯一标识号</th>
            <th>描述</th>
            <th>管理员</th>
            <th>状态</th>
            <th>创建时间</th>
            <th style="width: 130px">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="g in list" :key="g.id" @click="openDetail(g)">
            <td>{{ g.id }}</td>
            <td class="ellipsis">{{ g.name }}</td>
            <td style="font-family: monospace; font-size: 12px" class="ellipsis">{{ g.code }}</td>
            <td class="ellipsis">{{ g.description || '-' }}</td>
            <td>{{ adminName(g.adminUserId) }}</td>
            <td><span :class="statusTagClass(g.status)">{{ statusText(g.status) }}</span></td>
            <td>{{ g.createdAt || '-' }}</td>
            <td>
              <div class="ops" @click.stop>
                <button class="btn btn-sm" @click="openEdit(g)">编辑</button>
                <button class="btn btn-sm btn-danger" @click="doDelete(g)">删除</button>
              </div>
            </td>
          </tr>
          <tr v-if="list.length === 0">
            <td colspan="8"><div class="empty">暂无课题组数据</div></td>
          </tr>
        </tbody>
      </table>
      <div class="pager">
        <button class="btn btn-sm" :disabled="page <= 1" @click="page--; load()">上一页</button>
        <span>第 {{ page }} / {{ totalPages || 1 }} 页</span>
        <button class="btn btn-sm" :disabled="page >= totalPages" @click="page++; load()">下一页</button>
        <span>共 {{ total }} 条</span>
      </div>
    </div>

    <!-- 新增 / 编辑课题组弹窗 -->
    <AdminGroupFormDialog
      v-model:visible="showModal"
      :is-edit="isEdit"
      :edit-id="editId"
      :admins="admins"
      @saved="onGroupSaved"
    />

    <!-- 课题组详情弹窗 -->
    <AdminGroupDetailDialog v-if="detailId" :group-id="detailId" @close="detailId = null" />
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { listGroups, listUsers } from '../../api'
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'
import { refreshAfterWrite } from '../../composables/useGlobalRefresh'
import { fetchAll } from '../../utils/fetchAll'
import { statusText, statusTagClass } from '../../utils/labels'
import AdminGroupDetailDialog from '../../components/admin/AdminGroupDetailDialog.vue'
import AdminGroupFormDialog from '../../components/admin/AdminGroupFormDialog.vue'

// 超级管理员独立页面：课题组设置（列表一页固定 8 条，新增时后端生成 UUID）
const keyword = ref('')
const page = ref(1)
const list = ref([])
const total = ref(0)
const totalPages = ref(1)

const showModal = ref(false)
const isEdit = ref(false)
const editId = ref(null)
const admins = ref([])
const detailId = ref(null)
const route = useRoute()

async function load() {
  const res = await listGroups({ page: page.value, keyword: keyword.value })
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
  page.value = 1
  load()
}

// 管理员显示名（从已加载的管理员列表中反查）
function adminName(adminUserId) {
  if (!adminUserId) return '-'
  const a = admins.value.find((x) => x.id === Number(adminUserId))
  return a ? a.realName || a.username : `用户 #${adminUserId}`
}

// 行点击打开课题组详情弹窗（成员管理 / 业务概况）
function openDetail(row) {
  detailId.value = row.id
}

function openCreate() {
  isEdit.value = false
  editId.value = null
  showModal.value = true
}

function openEdit(g) {
  isEdit.value = true
  editId.value = g.id
  showModal.value = true
}

// 保存成功：刷新列表并提示
async function onGroupSaved() {
  await refreshAfterWrite(isEdit.value ? '保存成功' : '新增成功')
}

async function doDelete(g) {
  const ok = await dialogConfirm(`确定删除课题组「${g.name}」吗？删除后不可恢复。`)
  if (!ok) return
  const res = await deleteGroup(g.id)
  if (res && res.success) {
    await refreshAfterWrite('删除成功')
  } else {
    dialogAlert((res && res.message) || '删除失败')
  }
}

onMounted(async () => {
  admins.value = await fetchAll(listUsers, { role: 'group_admin' })
  load()
})

// 全局搜索直达：?open=<id> → 自动打开课题组详情。
// 用 watch 而非 onMounted：同路由下 query 变化（已在本页再点搜索结果）也会触发。
watch(
  () => route.query.open,
  (openId) => {
    if (openId != null && /^\d+$/.test(String(openId))) {
      openDetail({ id: Number(openId) })
    }
  },
  { immediate: true }
)
</script>
