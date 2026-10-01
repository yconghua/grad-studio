<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">用户管理</h2>
        <p class="page-sub">全部用户统一管理（超级管理员权限）</p>
      </div>
      <button class="btn btn-primary" @click="openCreate">新增用户</button>
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
      <span style="font-size: 13px; color: #4b5563">总用户数：<b>{{ total }}</b></span>
    </div>

    <!-- 批量操作条：选中任意行后出现，仅对当前页选中项生效 -->
    <div v-if="selected.length" class="toolbar" style="background: #eef2ff; border-color: #c7d2fe">
      <span style="font-size: 13px; color: #1f2329">已选 <b>{{ selected.length }}</b> 项（仅当前页）</span>
      <button class="btn btn-sm" @click="batchStatus(1)">批量启用</button>
      <button class="btn btn-sm" @click="batchStatus(0)">批量禁用</button>
      <button class="btn btn-sm btn-danger" @click="batchDelete">批量删除</button>
      <button class="btn btn-sm" @click="selected = []">取消选择</button>
    </div>

    <!-- 用户表格 -->
    <div class="tbl-wrap">
      <table class="tbl tbl-fixed">
        <thead>
          <tr>
            <th style="width: 38px">
              <input type="checkbox" :checked="allChecked" @change="toggleAll" />
            </th>
            <th style="width: 42px">ID</th>
            <th style="width: 72px">用户名</th>
            <th style="width: 72px">真实姓名</th>
            <th style="width: 116px">角色</th>
            <th style="width: 68px">状态</th>
            <th style="width: 64px">课题组</th>
            <th style="width: 90px">创建时间</th>
            <th style="width: 90px">最近重置</th>
            <th style="width: 174px">操作</th>
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
            <td>
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

    <!-- 新增用户弹窗（账号密码 / 资料 两个 Tab） -->
    <div v-if="showModal" class="modal-mask" @click.self="showModal = false">
      <div class="modal lg">
        <div class="modal-head">
          <h3>新增用户</h3>
          <button type="button" class="modal-close" @click="showModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="tabs">
            <button type="button" class="tab" :class="{ active: tab === 'account' }" @click="tab = 'account'">账号密码</button>
            <button type="button" class="tab" :class="{ active: tab === 'profile' }" @click="tab = 'profile'">资料</button>
          </div>

          <template v-if="tab === 'account'">
            <div class="form-grid">
              <div class="field">
                <label>用户名（区分大小写）</label>
                <input v-model.trim="form.username" class="input" placeholder="请输入用户名" maxlength="50" />
                <p class="hint">不超过 50 个字符，区分大小写</p>
              </div>
              <div class="field">
                <label>角色</label>
                <select v-model="form.role" class="select">
                  <option v-for="(t, r) in CREATE_ROLES" :key="r" :value="r">{{ t }}</option>
                </select>
              </div>
              <div class="field">
                <label>密码</label>
                <input v-model="form.password" type="password" class="input" placeholder="留空则使用默认密码" />
                <p class="hint">留空将使用该角色默认密码：{{ DEFAULT_PASSWORD_BY_ROLE[form.role] }}；自定义密码至少 6 位且包含大小写字母</p>
              </div>
              <div class="field">
                <label>确认密码</label>
                <input v-model="form.confirmPassword" type="password" class="input" placeholder="请再次输入密码" />
              </div>
              <div class="field">
                <label>状态</label>
                <select v-model="form.status" class="select">
                  <option :value="1">启用</option>
                  <option :value="0">禁用</option>
                </select>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="form-grid">
              <div class="field">
                <label>真实姓名</label>
                <input v-model.trim="form.realName" class="input" placeholder="请输入真实姓名" maxlength="50" />
                <p class="hint">不超过 50 个字符</p>
              </div>
              <div class="field">
                <label>手机号</label>
                <input v-model.trim="form.phone" class="input" placeholder="请输入手机号" maxlength="20" />
                <p class="hint">不超过 20 个字符</p>
              </div>
              <div class="field">
                <label>邮箱</label>
                <input v-model.trim="form.email" class="input" placeholder="请输入邮箱" maxlength="100" />
                <p class="hint">不超过 100 个字符</p>
              </div>
              <div class="field">
                <label>性别</label>
                <select v-model="form.gender" class="select">
                  <option :value="0">未知</option>
                  <option :value="1">男</option>
                  <option :value="2">女</option>
                </select>
              </div>
              <div class="field field-full">
                <label>头像</label>
                <div class="avatar-preview">
                  <img v-if="form.avatar" :src="avatarUrl(form.avatar)" class="avatar-lg" alt="头像" />
                  <span v-else class="avatar avatar-empty avatar-lg">?</span>
                  <div>
                    <button type="button" class="btn btn-sm" @click="chooseAvatar">选择头像</button>
                    <p class="hint">从本机选择图片文件，将复制到应用数据目录</p>
                  </div>
                </div>
              </div>
              <div class="field">
                <label>所属课题组</label>
                <select v-model="form.groupId" class="select" @change="onGroupChange">
                  <option value="">暂不加入课题组</option>
                  <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
                </select>
              </div>
              <div class="field" v-if="form.role === 'student'">
                <label>导师（仅学生）</label>
                <select v-model="form.mentorId" class="select">
                  <option value="">暂不指定导师</option>
                  <option v-for="m in mentors" :key="m.id" :value="m.id">{{ m.realName || m.username }}</option>
                </select>
              </div>
            </div>
          </template>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="showModal = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="saveCreate">{{ saving ? '保存中…' : '保存' }}</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 用户行详情弹窗 -->
  <RowDetailDialog v-model:visible="detailVisible" :title="detailTitle" :row="detailRow" :fields="detailFields" />
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import RowDetailDialog from '../../components/RowDetailDialog.vue'
import { listUsers, createUser, listGroups, listCandidates, deleteUser, resetPassword, batchUpdateStatus, batchDeleteUsers, pickAttachment } from '../../api'
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'
import { refreshAfterWrite } from '../../composables/useGlobalRefresh'
import { avatarUrl } from '../../utils/avatar'
import { fetchAll } from '../../utils/fetchAll'
import { roleText, statusText, statusTagClass, ROLE_TEXT } from '../../utils/labels'
import { DEFAULT_PASSWORD_BY_ROLE } from '../../config/constants'

// 超级管理员独立页面：用户管理列表（一页固定 8 条）
const router = useRouter()

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
  const ok = await dialogConfirm(`确定删除选中的 ${selected.value.length} 个用户吗？删除不可恢复，且会级联清理相关数据。`)
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
  router.push(`/admin/users/${u.id}/edit`)
}

// 时间列只显示日期部分（YYYY-MM-DD），完整时间在行详情弹窗查看，避免列表过宽
function fmtDate(v) {
  return v ? String(v).slice(0, 10) : '-'
}

async function doDelete(u) {
  const ok = await dialogConfirm(`确定删除用户「${u.username}」吗？删除后不可恢复。`)
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

// ===== 新增用户 =====
const CREATE_ROLES = { group_admin: '课题组管理员', mentor: '导师', student: '学生' }
const showModal = ref(false)
const tab = ref('account')
const saving = ref(false)
const groups = ref([])
const mentors = ref([])

const emptyForm = () => ({
  username: '',
  password: '',
  confirmPassword: '',
  role: 'student',
  status: 1,
  realName: '',
  phone: '',
  email: '',
  gender: 0,
  avatar: '',
  groupId: '',
  mentorId: ''
})
const form = reactive(emptyForm())

async function openCreate() {
  Object.assign(form, emptyForm())
  tab.value = 'account'
  groups.value = await fetchAll(listGroups)
  mentors.value = []
  showModal.value = true
}

// 选择课题组后加载该组导师（供指定导师）
async function onGroupChange() {
  form.mentorId = ''
  mentors.value = []
  if (!form.groupId) return
  mentors.value = await fetchAll(listUsers, { role: 'mentor', groupId: form.groupId })
}

// 选择头像：调用系统附件选择，复制到应用数据目录
async function chooseAvatar() {
  const res = await pickAttachment()
  if (res && res.success) form.avatar = res.path
  else if (res && !res.canceled) dialogAlert(res.message || '选择头像失败')
}

async function saveCreate() {
  if (!form.username) return dialogAlert('请输入用户名')
  if (form.password && form.password !== form.confirmPassword) return dialogAlert('两次输入的密码不一致')
  const res = await createUser({ ...form })
  if (res && res.success) {
    showModal.value = false
    await refreshAfterWrite('新增成功')
  } else {
    dialogAlert((res && res.message) || '新增失败')
  }
}

onMounted(load)
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
  padding-right: 20px;
}
</style>
