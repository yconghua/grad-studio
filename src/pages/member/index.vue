<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">👥 成员管理</h2>
      <div class="ph-right">
        <button class="btn btn-primary" @click="openAdd">＋ 添加成员</button>
      </div>
    </div>

    <div v-if="!currentGroupId" class="empty-block"><p>请先选择/输入课题组ID</p></div>

    <div v-else class="card">
      <div v-if="loading" class="empty-block"><p>加载中…</p></div>
      <div v-else-if="errorMsg" class="error-block">{{ errorMsg }}</div>
      <div v-else-if="!members.length" class="empty-block"><p>📭 暂无成员，点击右上角「添加成员」</p></div>

      <table v-else class="data-table">
        <thead>
          <tr>
            <th>账号</th>
            <th>全局角色</th>
            <th>组内角色</th>
            <th>状态</th>
            <th>入组时间</th>
            <th>备注</th>
            <th class="col-actions">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in members" :key="m.id">
            <td>{{ m.username || ('#' + m.user_id) }}</td>
            <td>{{ roleText(m.user_role) }}</td>
            <td>
              <span class="tag" :class="'tag-' + m.role_in_group">{{ roleInGroupText(m.role_in_group) }}</span>
            </td>
            <td>
              <span class="status" :class="'status-' + m.status">{{ statusText(m.status) }}</span>
            </td>
            <td>{{ fmtTime(m.joined_at) }}</td>
            <td class="cell-remark">{{ m.remark || '-' }}</td>
            <td class="col-actions">
              <button class="btn btn-ghost" @click="openEdit(m)">编辑</button>
              <button class="btn btn-danger" @click="askRemove(m)">移除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 添加成员 -->
    <div v-if="addVisible" class="modal-mask" @click.self="addVisible = false">
      <div class="modal-box">
        <h3 class="modal-title">添加成员</h3>
        <div class="form-item">
          <label class="form-label">选择用户 <span class="req">*</span></label>
          <select v-model="addForm.user_id" class="form-input">
            <option :value="null" disabled>请选择用户</option>
            <option v-for="u in addableUsers" :key="u.id" :value="u.id">
              {{ u.username }}（{{ roleText(u.role) }}）
            </option>
          </select>
          <p v-if="selectedUserRole" class="role-hint">该账号将自动归类为：<span class="tag" :class="'tag-' + selectedUserRole">{{ roleInGroupText(selectedUserRole) }}</span></p>
        </div>
        <div class="form-item">
          <label class="form-label">备注</label>
          <input v-model="addForm.remark" class="form-input" maxlength="255" placeholder="选填" />
        </div>
        <p v-if="addError" class="form-error">{{ addError }}</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="addVisible = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="onAdd">
            {{ saving ? '保存中…' : '确定添加' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 编辑成员 -->
    <div v-if="editVisible" class="modal-mask" @click.self="editVisible = false">
      <div class="modal-box">
        <h3 class="modal-title">编辑成员</h3>
        <p class="edit-user">{{ editForm.username || ('#' + editForm.user_id) }}</p>
        <div class="form-item">
          <label class="form-label">组内角色</label>
          <p class="role-static"><span class="tag" :class="'tag-' + editForm.role_in_group">{{ roleInGroupText(editForm.role_in_group) }}</span></p>
        </div>
        <div class="form-item">
          <label class="form-label">状态</label>
          <select v-model="editForm.status" class="form-input">
            <option value="active">在组</option>
            <option value="left">已离组</option>
            <option value="disabled">已禁用</option>
          </select>
        </div>
        <div class="form-item">
          <label class="form-label">备注</label>
          <input v-model="editForm.remark" class="form-input" maxlength="255" />
        </div>
        <p v-if="editError" class="form-error">{{ editError }}</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="editVisible = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="onEdit">
            {{ saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 移除确认 -->
    <div v-if="removeTarget" class="modal-mask" @click.self="removeTarget = null">
      <div class="modal-box">
        <p class="modal-text">确定将用户「{{ removeTarget.username || ('#' + removeTarget.user_id) }}」移出本组吗？</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="removeTarget = null">取消</button>
          <button class="btn btn-danger" :disabled="removing" @click="onRemove">
            {{ removing ? '移除中…' : '确认移除' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'
import { ref, computed, watch, onMounted } from 'vue'
import { listMembersByGroup, addMember, updateMember, removeMember, listMembers } from '../../api'
import { useGroupContext } from '../../composables/useGroupContext'

const { currentGroupId, loadGroups } = useGroupContext()

const members = ref([])
const allUsers = ref([])
const loading = ref(false)
const errorMsg = ref('')

const addVisible = ref(false)
const addForm = ref({ user_id: null, remark: '' })
const addError = ref('')

const editVisible = ref(false)
const editForm = ref({ id: null, username: '', user_id: null, role_in_group: 'student', status: 'active', remark: '' })
const editError = ref('')

const saving = ref(false)
const removeTarget = ref(null)
const removing = ref(false)

const ROLE_TEXT = { super_admin: '超级管理员', group_admin: '组管理员', mentor: '导师', student: '学生' }
const RIG_TEXT = { group_admin: '组管理员', mentor: '导师', student: '学生' }
const STATUS_TEXT = { active: '在组', left: '已离组', disabled: '已禁用' }

function roleText(r) { return ROLE_TEXT[r] || r || '-' }
function roleInGroupText(r) { return RIG_TEXT[r] || r || '-' }
function statusText(s) { return STATUS_TEXT[s] || s || '-' }
function fmtTime(t) { return t ? String(t).replace('T', ' ').slice(0, 16) : '-' }

// 可添加用户 = 尚未加入任何课题组的导师 / 学生（组内角色按平台角色自动归类，不需手动选择）
const addableUsers = computed(() => {
  return allUsers.value.filter((u) => !u.in_group && (u.role === 'mentor' || u.role === 'student'))
})
const selectedUserRole = computed(() => {
  const u = addableUsers.value.find((x) => Number(x.id) === Number(addForm.value.user_id))
  return u ? u.role : ''
})

async function loadAllUsers(force = false) {
  try {
    const res = await listMembers(force ? { force: true } : undefined)
    if (res && res.success) allUsers.value = res.members || []
  } catch (e) { /* 不阻断 */ }
}

async function loadMembers() {
  if (!currentGroupId.value) { members.value = []; return }
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await listMembersByGroup(currentGroupId.value)
    if (res && res.success) {
      members.value = res.members || []
    } else {
      members.value = []
      errorMsg.value = (res && res.message) || '加载失败'
    }
  } catch (e) {
    members.value = []
    errorMsg.value = '网络错误，加载失败'
  } finally {
    loading.value = false
  }
}

function openAdd() {
  addForm.value = { user_id: null, remark: '' }
  addError.value = ''
  addVisible.value = true
  loadAllUsers(true)
}

async function onAdd() {
  if (!addForm.value.user_id) { addError.value = '请选择用户'; return }
  const picked = addableUsers.value.find((x) => Number(x.id) === Number(addForm.value.user_id))
  saving.value = true
  addError.value = ''
  try {
    const res = await addMember({
      group_id: currentGroupId.value,
      user_id: addForm.value.user_id,
      role_in_group: picked ? picked.role : 'student',
      remark: addForm.value.remark
    })
    if (res && res.success) {
      addVisible.value = false
      loadMembers()
      loadAllUsers(true)
    } else {
      addError.value = (res && res.message) || '添加失败'
    }
  } catch (e) {
    addError.value = '网络错误，添加失败'
  } finally {
    saving.value = false
  }
}

function openEdit(m) {
  editForm.value = {
    id: m.id, username: m.username, user_id: m.user_id,
    role_in_group: m.role_in_group, status: m.status, remark: m.remark || ''
  }
  editError.value = ''
  editVisible.value = true
}

async function onEdit() {
  saving.value = true
  editError.value = ''
  try {
    const res = await updateMember({
      id: editForm.value.id,
      status: editForm.value.status,
      remark: editForm.value.remark
    })
    if (res && res.success) {
      editVisible.value = false
      loadMembers()
    } else {
      editError.value = (res && res.message) || '保存失败'
    }
  } catch (e) {
    editError.value = '网络错误，保存失败'
  } finally {
    saving.value = false
  }
}

function askRemove(m) { removeTarget.value = m }

async function onRemove() {
  removing.value = true
  try {
    const res = await removeMember(removeTarget.value.id)
    if (res && res.success) {
      removeTarget.value = null
      loadMembers()
      loadAllUsers(true)
    } else {
      dialogAlert((res && res.message) || '移除失败')
    }
  } catch (e) {
    dialogAlert('网络错误，移除失败')
  } finally {
    removing.value = false
  }
}

watch(currentGroupId, () => { loadMembers() })

onMounted(() => {
  loadGroups()
  loadAllUsers()
  loadMembers()
})
</script>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.page-title { font-size: 18px; font-weight: 600; color: #1f2329; margin: 0; }
.ph-right { display: flex; align-items: center; gap: 10px; }

.card {
  background: #fff; border: 1px solid #eceff3; border-radius: 12px;
  box-shadow: 0 1px 3px rgba(16, 24, 40, 0.04); overflow: hidden;
}
.empty-block { padding: 48px 20px; text-align: center; color: #8a9099; font-size: 14px; }
.error-block { padding: 24px; text-align: center; color: #ea4335; font-size: 14px; }

.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th {
  background: #f7f9fc; color: #4e5969; font-weight: 600;
  text-align: left; padding: 10px 12px; border-bottom: 1px solid #eceff3;
}
.data-table td { padding: 10px 12px; border-bottom: 1px solid #eceff3; color: #1f2329; }
.data-table tbody tr:nth-child(even) { background: #fafbfc; }
.data-table tbody tr:hover { background: #eef6ff; }
.col-actions { white-space: nowrap; text-align: right; }
.cell-remark { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #4e5969; }

.tag { padding: 2px 8px; border-radius: 6px; font-size: 12px; }
.tag-group_admin { background: #e6f4ff; color: #0d80e0; }
.tag-mentor { background: #e8f7ee; color: #19a558; }
.tag-student { background: #f2f3f5; color: #4e5969; }
.status { font-size: 12px; }
.status-active { color: #19a558; }
.status-left { color: #8a9099; }
.status-disabled { color: #ea4335; }

.btn {
  height: 30px; padding: 0 12px; border-radius: 8px; font-size: 13px;
  cursor: pointer; border: 1px solid #dfe3e8; background: #fff; color: #1f2329;
}
.btn + .btn { margin-left: 6px; }
.btn-primary { background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%); border: none; color: #fff; font-weight: 600; height: 32px; }
.btn-ghost { background: #fff; color: #4e5969; }
.btn-ghost:hover { border-color: #0d80e0; color: #0d80e0; }
.btn-danger { background: #fff; color: #ea4335; border-color: #f5c6c2; }
.btn-danger:hover { background: #ea4335; color: #fff; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.modal-mask {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal-box {
  background: #fff; border-radius: 12px; padding: 24px; width: 420px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}
.modal-title { margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #1f2329; }
.modal-text { font-size: 15px; margin: 0 0 20px; color: #1f2329; }
.edit-user { font-size: 13px; color: #4e5969; margin: -8px 0 14px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }

.form-item { margin-bottom: 14px; }
.form-label { display: block; font-size: 13px; color: #4e5969; margin-bottom: 6px; }
.req { color: #ea4335; }
.form-input {
  width: 100%; box-sizing: border-box; border: 1px solid #dfe3e8; border-radius: 8px;
  padding: 8px 10px; font-size: 13px; outline: none; color: #1f2329; background: #fff; height: 36px;
}
.form-input:focus { border-color: #0d80e0; }
.role-hint { font-size: 13px; color: #4e5969; margin: 8px 0 0; }
.role-static { font-size: 13px; color: #4e5969; margin: 0; display: flex; align-items: center; gap: 6px; }
.form-error { color: #ea4335; font-size: 13px; margin: 8px 0 0; }
</style>
