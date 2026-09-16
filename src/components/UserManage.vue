<template>
  <div class="user-manage">
    <div class="page-head">
      <h3 class="page-title">成员管理</h3>
      <div class="head-actions">
        <input v-model="keyword" class="search-input" placeholder="搜索账号" @keyup.enter="load" />
        <button class="btn" @click="load">查询</button>
        <button class="btn btn-primary" @click="openCreate">新增成员</button>
      </div>
    </div>

    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>账号</th>
            <th>姓名</th>
            <th>角色</th>
            <th>学号/工号</th>
            <th>学院</th>
            <th>状态</th>
            <th class="col-ops">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="7" class="state">加载中…</td></tr>
          <tr v-else-if="!list.length"><td colspan="7" class="state">暂无成员</td></tr>
          <tr v-for="row in list" :key="row.id" v-else>
            <td>{{ row.username }}</td>
            <td>{{ row.real_name || '-' }}</td>
            <td>{{ roleLabel(row.role) }}</td>
            <td>{{ row.student_no || '-' }}</td>
            <td>{{ row.college || '-' }}</td>
            <td>{{ statusLabel(row.status) }}</td>
            <td class="col-ops">
              <button class="btn-link" @click="openEdit(row)">编辑</button>
              <button class="btn-link" @click="resetPassword(row)">重置密码</button>
              <button class="btn-link danger" @click="confirmRemove(row)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 新增 / 编辑弹窗 -->
    <div v-if="formVisible" class="modal-mask" @click.self="closeForm">
      <div class="modal-box">
        <div class="modal-head">
          <h4>{{ formMode === 'create' ? '新增成员' : '编辑成员' }}</h4>
          <button class="modal-close" @click="closeForm">×</button>
        </div>
        <div class="modal-body">
          <div class="form-item">
            <label class="form-label">账号<span class="req"> *</span></label>
            <input v-model="form.username" class="form-input" :disabled="formMode === 'edit'" />
          </div>
          <div class="form-item">
            <label class="form-label">角色<span class="req"> *</span></label>
            <select v-model="form.role" class="form-input">
              <option value="">请选择</option>
              <option v-for="o in ROLE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>
          <div class="form-item">
            <label class="form-label">姓名</label>
            <input v-model="form.real_name" class="form-input" />
          </div>
          <div class="form-row">
            <div class="form-item">
              <label class="form-label">性别</label>
              <select v-model="form.gender" class="form-input">
                <option value="">请选择</option>
                <option v-for="o in GENDER_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </div>
            <div class="form-item">
              <label class="form-label">学号/工号</label>
              <input v-model="form.student_no" class="form-input" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-item">
              <label class="form-label">邮箱</label>
              <input v-model="form.email" class="form-input" />
            </div>
            <div class="form-item">
              <label class="form-label">手机号</label>
              <input v-model="form.phone" class="form-input" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-item">
              <label class="form-label">学院</label>
              <input v-model="form.college" class="form-input" />
            </div>
            <div class="form-item">
              <label class="form-label">专业</label>
              <input v-model="form.major" class="form-input" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-item">
              <label class="form-label">学位类型</label>
              <select v-model="form.degree_type" class="form-input">
                <option value="">请选择</option>
                <option v-for="o in DEGREE_TYPE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </div>
            <div class="form-item">
              <label class="form-label">状态</label>
              <select v-model="form.status" class="form-input">
                <option v-for="o in ACCOUNT_STATUS_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </div>
          </div>
          <p v-if="formError" class="form-error">{{ formError }}</p>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="closeForm">取消</button>
          <button class="btn btn-primary" @click="submit" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { listUsers, createUser, updateUser, deleteUser } from '../api'
import {
  ROLE_OPTIONS, GENDER_OPTIONS, DEGREE_TYPE_OPTIONS, ACCOUNT_STATUS_OPTIONS
} from '../config/fieldOptions'
import { ROLE_STUDENT, ACCOUNT_STATUS_ACTIVE } from '../config/constants'
import { dialogAlert, dialogConfirm } from '../composables/useDialog'

const list = ref([])
const loading = ref(false)
const keyword = ref('')
const formVisible = ref(false)
const formMode = ref('create')
const form = ref({})
const formError = ref('')
const saving = ref(false)
const editingId = ref(null)

function roleLabel(v) {
  const o = ROLE_OPTIONS.find((x) => x.value === v)
  return o ? o.label : (v || '-')
}
function statusLabel(v) {
  const o = ACCOUNT_STATUS_OPTIONS.find((x) => x.value === v)
  return o ? o.label : (v || '-')
}

async function load() {
  loading.value = true
  try {
    const res = await listUsers()
    if (res && res.success) {
      let rows = res.users || []
      const kw = keyword.value.trim()
      if (kw) rows = rows.filter((u) => (u.username || '').includes(kw))
      list.value = rows
    } else {
      list.value = []
    }
  } catch (e) {
    list.value = []
  } finally {
    loading.value = false
  }
}

function openCreate() {
  formMode.value = 'create'
  editingId.value = null
  form.value = { role: ROLE_STUDENT, status: ACCOUNT_STATUS_ACTIVE }
  formError.value = ''
  formVisible.value = true
}

function openEdit(row) {
  formMode.value = 'edit'
  editingId.value = row.id
  form.value = {
    username: row.username,
    role: row.role,
    real_name: row.real_name || '',
    gender: row.gender || '',
    student_no: row.student_no || '',
    email: row.email || '',
    phone: row.phone || '',
    college: row.college || '',
    major: row.major || '',
    degree_type: row.degree_type || '',
    status: row.status || ACCOUNT_STATUS_ACTIVE
  }
  formError.value = ''
  formVisible.value = true
}

function closeForm() {
  if (saving.value) return
  formVisible.value = false
}

// 提交前把空字符串统一转 null（未填写视为不设置），避免 ENUM 列（gender/degree_type）收到 '' 报错。
// 双保险：后端 pickProfile 已跳过空串，这里再兜底一层，前后端双重防御。
function cleanPayload(data) {
  const out = {}
  for (const [k, v] of Object.entries(data || {})) {
    out[k] = typeof v === 'string' && v.trim() === '' ? null : v
  }
  return out
}

async function submit() {
  formError.value = ''
  if (!form.value.username || !String(form.value.username).trim()) {
    formError.value = '请填写账号'
    return
  }
  if (!form.value.role) {
    formError.value = '请选择角色'
    return
  }
  saving.value = true
  try {
    let res
    if (formMode.value === 'create') {
      res = await createUser(cleanPayload(form.value))
      if (res && res.success && res.plainPassword) {
        await dialogAlert(`创建成功！初始密码：${res.plainPassword}`)
      }
    } else {
      res = await updateUser(cleanPayload({ id: editingId.value, ...form.value }))
    }
    if (res && res.success) {
      formVisible.value = false
      await load()
    } else {
      formError.value = (res && res.message) || '保存失败'
    }
  } catch (e) {
    formError.value = '保存过程出现异常，请重试'
  } finally {
    saving.value = false
  }
}

async function resetPassword(row) {
  const ok = await dialogConfirm(`确定重置「${row.username}」的密码吗？`, '重置密码')
  if (!ok) return
  try {
    const res = await updateUser({ id: row.id, resetPassword: true })
    if (res && res.success && res.plainPassword) {
      await dialogAlert(`密码已重置，新密码：${res.plainPassword}`)
    } else {
      await dialogAlert((res && res.message) || '重置失败')
    }
  } catch (e) {
    await dialogAlert('重置过程出现异常，请重试')
  }
}

async function confirmRemove(row) {
  const ok = await dialogConfirm(`确定删除成员「${row.username}」吗？此操作不可恢复。`, '删除成员')
  if (!ok) return
  try {
    const res = await deleteUser(row.id)
    if (res && res.success) {
      await load()
    } else {
      await dialogAlert((res && res.message) || '删除失败')
    }
  } catch (e) {
    await dialogAlert('删除过程出现异常，请重试')
  }
}

onMounted(load)
</script>

<style scoped>
.user-manage {
  background: #fff;
  border: 1px solid #eceff3;
  border-radius: 12px;
  padding: 16px 18px;
}
.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.page-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2329;
}
.head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.search-input {
  height: 34px;
  width: 200px;
  padding: 0 12px;
  font-size: 13px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  outline: none;
}
.search-input:focus {
  border-color: #0d80e0;
}
.btn {
  height: 34px;
  padding: 0 16px;
  font-size: 13px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  background: #fff;
  color: #4e5969;
  cursor: pointer;
}
.btn:hover {
  border-color: #0d80e0;
  color: #0d80e0;
}
.btn-primary {
  border: none;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  color: #fff;
  font-weight: 600;
}
.btn-primary:hover {
  opacity: 0.92;
}
.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.table-wrap {
  overflow-x: auto;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.data-table th,
.data-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid #eceff3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}
.data-table th {
  background: #f5f7fa;
  color: #4e5969;
  font-weight: 600;
}
.data-table td {
  color: #1f2329;
}
.state {
  text-align: center;
  color: #8a9099;
  padding: 32px 0;
}
.col-ops {
  width: 180px;
}
.btn-link {
  border: none;
  background: none;
  color: #0d80e0;
  font-size: 13px;
  cursor: pointer;
  padding: 0 6px;
}
.btn-link.danger {
  color: #ea4335;
}
.btn-link:hover {
  opacity: 0.8;
}
.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-box {
  width: 560px;
  max-width: 92vw;
  max-height: 85vh;
  background: #fff;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #eceff3;
}
.modal-head h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.modal-close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: #f2f3f5;
  color: #4e5969;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}
.modal-body {
  padding: 16px 20px;
  overflow-y: auto;
}
.form-row {
  display: flex;
  gap: 12px;
}
.form-row .form-item {
  flex: 1;
}
.form-item {
  margin-bottom: 12px;
}
.form-label {
  display: block;
  font-size: 13px;
  color: #4e5969;
  margin-bottom: 6px;
}
.req {
  color: #ea4335;
}
.form-input {
  width: 100%;
  min-height: 36px;
  padding: 0 10px;
  font-size: 13px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  outline: none;
  box-sizing: border-box;
}
.form-input:focus {
  border-color: #0d80e0;
}
.form-input:disabled {
  background: #f2f3f5;
  color: #8a9099;
}
.form-error {
  margin: 8px 0 0;
  font-size: 13px;
  color: #ea4335;
}
.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid #eceff3;
}
</style>
