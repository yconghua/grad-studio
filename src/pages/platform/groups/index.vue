<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">🏢 课题组管理</h2>
        <p class="page-desc">维护平台课题组档案（仅超级管理员可见）</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-primary" @click="openCreate">＋ 新增课题组</button>
      </div>
    </div>

    <div class="card">
      <div class="filter-bar">
        <input v-model="keyword" class="input" placeholder="按名称 / 编号过滤" @keyup.enter="loadList" />
        <button class="btn btn-secondary" @click="loadList">查询</button>
      </div>

      <div v-if="loading" class="state">加载中…</div>
      <div v-else-if="errorMsg" class="state error">⚠️ {{ errorMsg }}</div>
      <div v-else-if="!filteredRows.length" class="state">🗂️ 暂无课题组</div>
      <table v-else class="tbl">
        <thead>
          <tr><th>ID</th><th>名称</th><th>编号</th><th>状态</th><th>创建人ID</th><th>操作</th></tr>
        </thead>
        <tbody>
          <tr v-for="g in filteredRows" :key="g.id">
            <td>{{ g.id }}</td>
            <td>{{ g.name }}</td>
            <td>{{ g.code }}</td>
            <td><span class="dot" :class="'dot-' + g.status"></span>{{ g.status === 'active' ? '正常' : '已停用' }}</td>
            <td>{{ g.created_by }}</td>
            <td class="ops">
              <button class="link" @click="openEdit(g)">编辑</button>
              <button class="link danger" @click="askDelete(g)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 新增 / 编辑弹窗 -->
    <div v-if="showForm" class="modal-mask" @click.self="showForm = false">
      <div class="modal-box">
        <h3 class="modal-title">{{ editing ? '编辑课题组' : '新增课题组' }}</h3>
        <div class="form-item">
          <label>名称 <span class="req">*</span></label>
          <input v-model="form.name" class="input" placeholder="课题组名称" />
        </div>
        <div class="form-item">
          <label>编号 <span class="req">*</span></label>
          <input v-model="form.code" class="input" placeholder="唯一编号，如 ML-2026" />
        </div>
        <div class="form-item">
          <label>简介</label>
          <textarea v-model="form.description" class="textarea" rows="3" placeholder="选填"></textarea>
        </div>
        <div class="form-item">
          <label>状态</label>
          <select v-model="form.status" class="input">
            <option value="active">正常</option>
            <option value="disabled">已停用</option>
          </select>
        </div>
        <div v-if="!editing" class="form-item">
          <label>课题组管理员 <span class="req">*</span></label>
          <select v-model="form.admin_user_id" class="input">
            <option :value="null" disabled>请选择课题组管理员</option>
            <option v-for="u in userOptions" :key="u.id" :value="u.id">{{ u.username }}（{{ roleText(u.role) }}）</option>
          </select>
        </div>
        <p v-if="formError" class="form-error">{{ formError }}</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="showForm = false">取消</button>
          <button class="btn btn-primary" :disabled="submitting" @click="submitForm">{{ submitting ? '保存中…' : '保存' }}</button>
        </div>
      </div>
    </div>

    <!-- 删除确认 -->
    <div v-if="deleting" class="modal-mask" @click.self="deleting = null">
      <div class="modal-box">
        <p class="modal-text">确定删除课题组「{{ deleting.name }}」（{{ deleting.code }}）吗？删除后组内数据将不可访问。</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="deleting = null">取消</button>
          <button class="btn btn-danger" @click="confirmDelete">删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { dialogAlert, dialogConfirm } from '../../../composables/useDialog'
import { ref, computed, onMounted } from 'vue'
import { listGroups, createGroup, updateGroup, removeGroup, listUsers } from '../../../api'

const rows = ref([])
const loading = ref(false)
const errorMsg = ref('')
const keyword = ref('')

async function loadList() {
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await listGroups()
    if (res && res.success) {
      rows.value = res.groups || []
    } else {
      rows.value = []
      errorMsg.value = (res && res.message) || '加载失败'
    }
  } catch (e) {
    rows.value = []
    errorMsg.value = '网络异常'
  } finally {
    loading.value = false
  }
}

const filteredRows = computed(() => {
  if (!keyword.value.trim()) return rows.value
  const k = keyword.value.trim().toLowerCase()
  return rows.value.filter((g) =>
    String(g.name).toLowerCase().includes(k) || String(g.code).toLowerCase().includes(k)
  )
})

const showForm = ref(false)
const editing = ref(null)
const submitting = ref(false)
const formError = ref('')
const form = ref({ name: '', code: '', description: '', status: 'active', admin_user_id: null })

// 管理员候选：仅课题组管理员角色
const userOptions = ref([])
const ROLE_TEXT = { super_admin: '超级管理员', group_admin: '课题组管理员', mentor: '导师', student: '学生' }
function roleText(r) {
  return ROLE_TEXT[r] || r
}
async function loadUserOptions() {
  try {
    const res = await listUsers()
    if (res && res.success) {
      userOptions.value = (res.users || []).filter((u) => u.role === 'group_admin')
    }
  } catch (e) {
    userOptions.value = []
  }
}

function openCreate() {
  editing.value = null
  form.value = { name: '', code: '', description: '', status: 'active', admin_user_id: null }
  formError.value = ''
  loadUserOptions()
  showForm.value = true
}
function openEdit(g) {
  editing.value = g
  form.value = { name: g.name, code: g.code, description: g.description || '', status: g.status || 'active' }
  formError.value = ''
  showForm.value = true
}

async function submitForm() {
  formError.value = ''
  if (!form.value.name.trim()) { formError.value = '名称不能为空'; return }
  if (!form.value.code.trim()) { formError.value = '编号不能为空'; return }
  if (!editing.value && !form.value.admin_user_id) { formError.value = '请选择课题组管理员'; return }
  submitting.value = true
  try {
    const payload = {
      name: form.value.name.trim(),
      code: form.value.code.trim(),
      description: form.value.description,
      status: form.value.status
    }
    if (!editing.value) payload.admin_user_id = form.value.admin_user_id
    const res = editing.value ? await updateGroup({ id: editing.value.id, ...payload }) : await createGroup(payload)
    if (res && res.success) {
      showForm.value = false
      await loadList()
    } else {
      formError.value = (res && res.message) || '操作失败'
    }
  } catch (e) {
    formError.value = '网络异常'
  } finally {
    submitting.value = false
  }
}

const deleting = ref(null)
function askDelete(g) { deleting.value = g }
async function confirmDelete() {
  try {
    const res = await removeGroup(deleting.value.id)
    if (res && res.success) {
      deleting.value = null
      await loadList()
    } else {
      dialogAlert((res && res.message) || '删除失败')
    }
  } catch (e) {
    dialogAlert('网络异常')
  }
}

onMounted(loadList)
</script>

<style scoped>
.page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; justify-content: space-between; align-items: flex-start; }
.page-title { margin: 0; font-size: 18px; color: #1f2329; }
.page-desc { margin: 4px 0 0; font-size: 13px; color: #8a9099; }
.head-actions { display: flex; gap: 10px; }
.card { background: #fff; border: 1px solid #eceff3; border-radius: 12px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04); padding: 16px; }
.filter-bar { display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.input { height: 34px; padding: 0 10px; font-size: 13px; border: 1px solid #dfe3e8; border-radius: 8px; outline: none; background: #fff; color: #1f2329; }
.input:focus { border-color: #0d80e0; }
.filter-bar .input { min-width: 200px; }
.textarea { width: 100%; box-sizing: border-box; padding: 8px 10px; font-size: 13px; border: 1px solid #dfe3e8; border-radius: 8px; outline: none; resize: vertical; font-family: inherit; }
.btn { height: 34px; padding: 0 16px; border-radius: 8px; font-size: 13px; cursor: pointer; border: 1px solid #dfe3e8; background: #fff; color: #1f2329; }
.btn-primary { background: linear-gradient(135deg, #0d80e0, #19a558); border: none; color: #fff; font-weight: 600; }
.btn-secondary:hover { border-color: #0d80e0; color: #0d80e0; }
.btn-danger { background: #ea4335; border: none; color: #fff; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.state { padding: 40px 0; text-align: center; color: #8a9099; font-size: 13px; }
.state.error { color: #ea4335; }
.tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.tbl th { background: #f7f9fc; text-align: left; padding: 10px 12px; color: #4e5969; font-weight: 600; border-bottom: 1px solid #eceff3; }
.tbl td { padding: 10px 12px; border-bottom: 1px solid #eceff3; color: #1f2329; }
.tbl tbody tr:nth-child(even) { background: #fafbfc; }
.tbl tbody tr:hover { background: #eef6ff; }
.ops { display: flex; gap: 12px; }
.link { background: none; border: none; color: #0d80e0; cursor: pointer; font-size: 13px; padding: 0; }
.link.danger { color: #ea4335; }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
.dot-active { background: #19a558; }
.dot-disabled { background: #ea4335; }
.modal-mask { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-box { width: 480px; background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18); }
.modal-title { margin: 0 0 16px; font-size: 16px; color: #1f2329; }
.modal-text { font-size: 14px; color: #1f2329; margin: 0 0 20px; line-height: 1.6; }
.modal-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 18px; }
.modal-actions .btn { flex: 0 0 auto; }
.form-item { margin-bottom: 14px; }
.form-item label { display: block; font-size: 13px; color: #4e5969; margin-bottom: 6px; }
.req { color: #ea4335; }
.form-item .input { width: 100%; box-sizing: border-box; }
.form-error { color: #ea4335; font-size: 12px; margin: 6px 0 0; }
</style>
