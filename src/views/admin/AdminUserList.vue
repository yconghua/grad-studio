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

    <!-- 用户表格 -->
    <div class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>ID</th>
            <th>用户名</th>
            <th>真实姓名</th>
            <th>角色</th>
            <th>状态</th>
            <th>所属课题组</th>
            <th>创建时间</th>
            <th style="width: 130px">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in list" :key="u.id">
            <td>{{ u.id }}</td>
            <td>{{ u.username }}</td>
            <td>{{ u.realName || '-' }}</td>
            <td><span class="tag tag-blue">{{ roleText(u.role) }}</span></td>
            <td><span :class="statusTagClass(u.status)">{{ statusText(u.status) }}</span></td>
            <td>{{ u.groupId ? '课题组 #' + u.groupId : '-' }}</td>
            <td>{{ u.createdAt || '-' }}</td>
            <td>
              <div class="ops">
                <button class="btn btn-sm" @click="goEdit(u)">编辑</button>
                <button class="btn btn-sm btn-danger" @click="doDelete(u)">删除</button>
              </div>
            </td>
          </tr>
          <tr v-if="!loading && list.length === 0">
            <td colspan="8"><div class="empty">暂无用户数据</div></td>
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
                <input v-model.trim="form.username" class="input" placeholder="请输入用户名" />
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
                <p class="hint">留空将使用该角色默认密码：{{ DEFAULT_PASSWORD_BY_ROLE[form.role] }}</p>
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
                <input v-model.trim="form.realName" class="input" placeholder="请输入真实姓名" />
              </div>
              <div class="field">
                <label>手机号</label>
                <input v-model.trim="form.phone" class="input" placeholder="请输入手机号" />
              </div>
              <div class="field">
                <label>邮箱</label>
                <input v-model.trim="form.email" class="input" placeholder="请输入邮箱" />
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
                  <img v-if="form.avatar" :src="form.avatar" class="avatar-lg" alt="头像" />
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
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listUsers, createUser, listGroups, listCandidates, deleteUser, pickAttachment } from '../../api'
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'
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

async function load() {
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

async function doDelete(u) {
  const ok = await dialogConfirm(`确定删除用户「${u.username}」吗？删除后不可恢复。`)
  if (!ok) return
  const res = await deleteUser(u.id)
  if (res && res.success) {
    dialogAlert('删除成功')
    load()
  } else {
    dialogAlert((res && res.message) || '删除失败')
  }
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
    dialogAlert('新增成功')
    showModal.value = false
    load()
  } else {
    dialogAlert((res && res.message) || '新增失败')
  }
}

onMounted(load)
</script>
