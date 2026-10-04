<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">用户管理</h2>
        <p class="page-sub">全部用户统一管理（超级管理员权限）</p>
      </div>
      <div style="display: flex; gap: 10px">
        <button class="btn" @click="openBatch">批量新增</button>
        <button class="btn btn-primary" @click="openCreate">新增用户</button>
      </div>
    </div>

    <!-- 筛选区：查询 / 重置 -->
    <div class="toolbar">
      <input v-model="keyword" class="input" style="width: 220px" placeholder="用户名 / 真实姓名" @keyup.enter="search" />
      <select v-model="role" class="select">
        <option value="">全部角色</option>
        <option v-for="(t, r) in ROLE_TEXT" :key="r" :value="r">{{ t }}</option>
      </select>
      <select v-model="status" class="select">
        <option value="">全部状态</option>
        <option value="1">启用</option>
        <option value="0">禁用</option>
      </select>
      <button class="btn btn-primary" @click="search">查询</button>
      <button class="btn" @click="reset">重置</button>
      <div class="spacer"></div>
      <span style="font-size: 13px; color: var(--text-2)">总用户数：<b>{{ total }}</b></span>
    </div>

    <!-- 批量操作条：选中任意行后出现，仅对当前页选中项生效 -->
    <div v-if="selected.length" class="toolbar" style="background: var(--primary-soft); border-color: color-mix(in srgb, var(--primary) 20%, var(--bg-card))">
      <span style="font-size: 13px; color: var(--text)">已选 <b>{{ selected.length }}</b> 项（仅当前页）</span>
      <button class="btn btn-sm" @click="batchStatus(1)">批量启用</button>
      <button class="btn btn-sm" @click="batchStatus(0)">批量禁用</button>
      <button class="btn btn-sm btn-danger" @click="batchDelete">批量删除</button>
      <button class="btn btn-sm" @click="selected = []">取消选择</button>
    </div>

    <!-- 用户表格：通用列宽拖拽（v-resizable-columns），操作列保底 184px 不被挤压 -->
    <div class="tbl-wrap">
      <table v-resizable-columns="{ min: 48, minByIndex: { 9: 184 } }" class="tbl tbl-fixed">
        <thead>
          <tr>
            <th>
              <input type="checkbox" :checked="allChecked" @change="toggleAll" />
            </th>
            <th>ID</th>
            <th>用户名</th>
            <th>真实姓名</th>
            <th>角色</th>
            <th>状态</th>
            <th>课题组</th>
            <th>创建时间</th>
            <th>最近重置</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in list" :key="u.id" @click="openDetail(u, userDetailFields, '用户详情')">
            <td @click.stop><input type="checkbox" :value="u.id" v-model="selected" /></td>
            <td>{{ u.id }}</td>
            <td class="ellipsis">{{ u.username }}</td>
            <td class="ellipsis">{{ u.realName || '-' }}</td>
            <td><span class="tag tag-blue">{{ roleText(u.role) }}</span></td>
            <td><span :class="statusTagClass(u.status)">{{ statusText(u.status) }}</span></td>
            <td class="ellipsis">{{ u.groupId ? '#' + u.groupId : '-' }}</td>
            <td class="ellipsis">{{ fmtDate(u.createdAt) }}</td>
            <td class="ellipsis">{{ fmtDate(u.passwordResetAt) }}</td>
            <td style="min-width: 184px">
              <div class="ops" @click.stop>
                <button class="btn btn-sm" @click="goEdit(u)">编辑</button>
                <button class="btn btn-sm" @click="doResetPwd(u)">重置密码</button>
                <button class="btn btn-sm btn-danger" @click="doDelete(u)">删除</button>
              </div>
            </td>
          </tr>
          <tr v-if="!loading && list.length === 0">
            <td colspan="10"><div class="empty">暂无用户数据</div></td>
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
  </div>

  <!-- 新增用户弹窗 -->
  <AdminUserCreateDialog v-model:visible="showModal" @saved="onCreateSaved" />

  <!-- 编辑用户弹窗（账号密码 / 资料 两个 Tab，分别保存） -->
  <AdminUserEditDialog v-model:visible="showEditModal" :user-id="editUserId" />

  <!-- 批量新增用户弹窗 -->
  <AdminBatchUserDialog v-model:visible="showBatch" @saved="onBatchSaved" />

  <!-- 用户行详情弹窗 -->
  <RowDetailDialog v-model:visible="detailVisible" :title="detailTitle" :row="detailRow" :fields="detailFields" />
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useRouter } from 'vue-router'
import RowDetailDialog from '../../components/common/RowDetailDialog.vue'
import { listUsers, deleteUser, resetPassword, batchUpdateStatus, batchDeleteUsers } from '../../api'
import { countUserChatSessions } from '../../api/chat'
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'
import { refreshAfterWrite } from '../../composables/useGlobalRefresh'
import { roleText, statusText, statusTagClass, ROLE_TEXT } from '../../utils/labels'
import AdminUserEditDialog from '../../components/admin/AdminUserEditDialog.vue'
import AdminUserCreateDialog from '../../components/admin/AdminUserCreateDialog.vue'
import AdminBatchUserDialog from '../../components/admin/AdminBatchUserDialog.vue'

// 超级管理员独立页面：用户管理列表（一页固定 8 条）
const router = useRouter()
const route = useRoute()
// 编辑用户弹窗
const showEditModal = ref(false)
const editUserId = ref(null)

const keyword = ref('')
const role = ref('')
const status = ref('')
const page = ref(1)
const list = ref([])
const total = ref(0)
const totalPages = ref(1)
const loading = ref(false)

// ===== 批量操作 =====
const selected = ref([])
const allChecked = computed(() => list.value.length > 0 && selected.value.length === list.value.length)
function toggleAll(e) {
  selected.value = e.target.checked ? list.value.map((u) => u.id) : []
}

// 拼接批量结果提示：成功 N 条 / 失败 M 条 / 明细（超长截断）
function batchResultText(d, okText) {
  const parts = [`${okText} ${d.successCount || 0} 条`]
  if (d.failCount) parts.push(`失败 ${d.failCount} 条`)
  const reasons = (d.failList || []).map((f) => `用户 #${f.id}：${f.reason}`).join('；')
  if (reasons) parts.push(reasons.slice(0, 120))
  return parts.join('，')
}

async function batchStatus(st) {
  const action = st === 1 ? '启用' : '禁用'
  const ok = await dialogConfirm(`确认将选中的 ${selected.value.length} 个用户${action}吗？`)
  if (!ok) return
  // 展开为普通数组：Vue ref 数组是响应式 Proxy，直接传 IPC 会克隆失败
  const res = await batchUpdateStatus([...selected.value], st)
  if (res && res.success) {
    await refreshAfterWrite(batchResultText(res.data || {}, `已${action}`))
  } else {
    dialogAlert((res && res.message) || '批量操作失败')
  }
}

async function batchDelete() {
  const ok = await dialogConfirm(`确定删除选中的 ${selected.value.length} 个用户吗？删除不可恢复，且会级联清理相关数据（含聊天会话）。`)
  if (!ok) return
  const res = await batchDeleteUsers([...selected.value])
  if (res && res.success) {
    await refreshAfterWrite(batchResultText(res.data || {}, '已删除'))
  } else {
    dialogAlert((res && res.message) || '批量删除失败')
  }
}

async function load() {
  selected.value = []
  loading.value = true
  try {
    const res = await listUsers({ page: page.value, keyword: keyword.value, role: role.value, status: status.value })
    if (res && res.success) {
      list.value = (res.data && res.data.list) || []
      total.value = (res.data && res.data.total) || 0
      totalPages.value = (res.data && res.data.totalPages) || 1
    } else {
      dialogAlert((res && res.message) || '加载失败')
    }
  } finally {
    loading.value = false
  }
}

function search() {
  page.value = 1
  load()
}
function reset() {
  keyword.value = ''
  role.value = ''
  status.value = ''
  page.value = 1
  load()
}
function goEdit(u) {
  editUserId.value = u.id
  showEditModal.value = true
}

// 时间列只显示日期部分（YYYY-MM-DD），完整时间在行详情弹窗查看，避免列表过宽
function fmtDate(v) {
  return v ? String(v).slice(0, 10) : '-'
}

async function doDelete(u) {
  // 删除前影响提示：该用户有 N 个进行中的会话，删除后对方将无法继续发送
  let sessionTip = ''
  try {
    const cnt = await countUserChatSessions(u.id)
    if (cnt && cnt.success) {
      const n = Number((cnt.data || {}).count) || 0
      if (n > 0) sessionTip = `\n该用户有 ${n} 个进行中的会话，删除后对方将无法继续发送。`
    }
  } catch (e) {
    // 统计失败不阻断删除确认
  }
  const ok = await dialogConfirm(`确定删除用户「${u.username}」吗？删除后不可恢复。${sessionTip}`)
  if (!ok) return
  const res = await deleteUser(u.id)
  if (res && res.success) {
    await refreshAfterWrite('删除成功')
  } else {
    dialogAlert((res && res.message) || '删除失败')
  }
}

// 重置密码：重置为该角色默认密码，目标用户下次登录强制修改
async function doResetPwd(u) {
  const ok = await dialogConfirm(`确认将用户「${u.username}」的密码重置为该角色默认密码？重置后该用户下次登录需修改密码。`)
  if (!ok) return
  const res = await resetPassword(u.id)
  if (res && res.success) {
    await refreshAfterWrite('密码已重置为默认密码，该用户下次登录将强制修改')
  } else {
    dialogAlert((res && res.message) || '重置失败')
  }
}

// ===== 行详情 =====
const detailVisible = ref(false)
const detailRow = ref(null)
const detailFields = ref([])
const detailTitle = ref('')
// 用户详情字段：不含密码等敏感字段；所属课题组显示编号
const userDetailFields = [
  { key: 'id', label: 'ID' },
  { key: 'username', label: '用户名' },
  { key: 'realName', label: '真实姓名' },
  { key: 'role', label: '角色', render: roleText },
  { key: 'status', label: '状态', render: statusText },
  { key: 'groupId', label: '所属课题组', render: (v) => (v ? `课题组 #${v}` : '-') },
  { key: 'phone', label: '手机号' },
  { key: 'email', label: '邮箱' },
  { key: 'gender', label: '性别', render: (v) => (Number(v) === 1 ? '男' : Number(v) === 2 ? '女' : '未知') },
  { key: 'createdAt', label: '创建时间' },
  { key: 'passwordResetAt', label: '最近重置' }
]
function openDetail(row, fields, title) {
  detailRow.value = row
  detailFields.value = fields
  detailTitle.value = title
  detailVisible.value = true
}

// ===== 新增 / 批量新增用户（弹窗逻辑在独立组件中） =====
const showModal = ref(false)
const showBatch = ref(false)

function openCreate() {
  showModal.value = true
}
function openBatch() {
  showBatch.value = true
}

// 新增用户保存成功：全局刷新（列表重载）
async function onCreateSaved() {
  await refreshAfterWrite('新增成功')
}

// 批量导入完成：按结果提示并全局刷新
async function onBatchSaved(msg) {
  await refreshAfterWrite(msg || '批量导入完成')
}

onMounted(() => {
  load()
})

// 全局搜索/跳转直达：?open=<id> → 自动打开编辑用户弹窗。
// 用 watch 而非 onMounted：同路由下 query 变化（已在本页再点搜索结果）也会触发。
watch(
  () => route.query.open,
  (openId) => {
    if (openId != null && /^\d+$/.test(String(openId))) {
      editUserId.value = Number(openId)
      showEditModal.value = true
    }
  },
  { immediate: true }
)
</script>

<style scoped>
/* 本页列数多（10 列），用 fixed 布局让列宽严格按表头锁定，操作列固定宽度完整显示 */
.tbl-fixed {
  table-layout: fixed;
}
/* 操作列三个按钮收紧内边距，保证 174px 内放得下 */
.tbl-fixed .ops {
  gap: 5px;
}
.tbl-fixed .ops .btn-sm {
  padding: 0 6px;
}
/* 操作列是最后一列，加大右侧留白，避免删除按钮贴表格右缘 */
.tbl-fixed th:last-child,
.tbl-fixed td:last-child {
  padding-right: 14px;
}
</style>
