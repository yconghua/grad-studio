<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">🎓 我的学生</h2>
      <div class="ph-right">
        <GroupSelector />
        <button class="btn btn-primary" @click="openBind">＋ 绑定学生</button>
      </div>
    </div>

    <div v-if="!currentGroupId" class="empty-block"><p>请先选择/输入课题组ID</p></div>

    <div v-else class="card">
      <div v-if="loading" class="empty-block"><p>加载中…</p></div>
      <div v-else-if="errorMsg" class="error-block">{{ errorMsg }}</div>
      <div v-else-if="!students.length" class="empty-block"><p>📭 暂无已绑定学生，点击右上角「绑定学生」</p></div>

      <table v-else class="data-table">
        <thead>
          <tr>
            <th>学生账号</th>
            <th>姓名</th>
            <th>导师</th>
            <th>状态</th>
            <th>备注</th>
            <th class="col-actions">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in students" :key="s.id">
            <td>{{ s.student_username || ('#' + s.student_id) }}</td>
            <td>{{ s.student_real_name || '-' }}</td>
            <td>{{ s.mentor_username || ('#' + s.mentor_id) }}</td>
            <td>
              <span class="status" :class="'status-' + s.status">{{ statusText(s.status) }}</span>
            </td>
            <td class="cell-remark">{{ s.remark || '-' }}</td>
            <td class="col-actions">
              <button class="btn btn-danger" @click="askUnbind(s)">解除绑定</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 绑定学生 -->
    <div v-if="bindVisible" class="modal-mask" @click.self="bindVisible = false">
      <div class="modal-box">
        <h3 class="modal-title">绑定学生</h3>
        <div class="form-item">
          <label class="form-label">选择学生 <span class="req">*</span></label>
          <select v-model="bindForm.student_id" class="form-input">
            <option :value="null" disabled>请选择学生</option>
            <option v-for="u in studentUsers" :key="u.id" :value="u.id">
              {{ u.username }}（学生）
            </option>
          </select>
        </div>
        <div class="form-item">
          <label class="form-label">备注</label>
          <input v-model="bindForm.remark" class="form-input" maxlength="255" placeholder="选填" />
        </div>
        <p v-if="bindError" class="form-error">{{ bindError }}</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="bindVisible = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="onBind">
            {{ saving ? '绑定中…' : '确定绑定' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 解除确认 -->
    <div v-if="unbindTarget" class="modal-mask" @click.self="unbindTarget = null">
      <div class="modal-box">
        <p class="modal-text">确定解除与学生「{{ unbindTarget.student_username || ('#' + unbindTarget.student_id) }}」的绑定吗？</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="unbindTarget = null">取消</button>
          <button class="btn btn-danger" :disabled="unbinding" @click="onUnbind">
            {{ unbinding ? '解除中…' : '确认解除' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { listStudents, bindStudent, unbindStudent, listMembers } from '../../api'
import { useGroupContext } from '../../composables/useGroupContext'
import GroupSelector from '../../components/GroupSelector.vue'

const { currentGroupId, loadGroups } = useGroupContext()

const students = ref([])
const allUsers = ref([])
const loading = ref(false)
const errorMsg = ref('')

const bindVisible = ref(false)
const bindForm = ref({ student_id: null, remark: '' })
const bindError = ref('')
const saving = ref(false)

const unbindTarget = ref(null)
const unbinding = ref(false)

const STATUS_TEXT = { active: '指导中', quit: '已离师' }
function statusText(s) { return STATUS_TEXT[s] || s || '-' }

// 仅列出全局角色为 student 的用户供绑定
const studentUsers = computed(() => allUsers.value.filter((u) => u.role === 'student'))

async function loadAllUsers() {
  try {
    const res = await listMembers()
    if (res && res.success) allUsers.value = res.members || []
  } catch (e) { /* 不阻断 */ }
}

async function loadStudents() {
  if (!currentGroupId.value) { students.value = []; return }
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await listStudents({ group_id: currentGroupId.value })
    if (res && res.success) {
      students.value = res.students || []
    } else {
      students.value = []
      errorMsg.value = (res && res.message) || '加载失败'
    }
  } catch (e) {
    students.value = []
    errorMsg.value = '网络错误，加载失败'
  } finally {
    loading.value = false
  }
}

function openBind() {
  bindForm.value = { student_id: null, remark: '' }
  bindError.value = ''
  bindVisible.value = true
}

async function onBind() {
  if (!bindForm.value.student_id) { bindError.value = '请选择学生'; return }
  saving.value = true
  bindError.value = ''
  try {
    const res = await bindStudent({
      group_id: currentGroupId.value,
      student_id: bindForm.value.student_id,
      remark: bindForm.value.remark
    })
    if (res && res.success) {
      bindVisible.value = false
      loadStudents()
    } else {
      bindError.value = (res && res.message) || '绑定失败'
    }
  } catch (e) {
    bindError.value = '网络错误，绑定失败'
  } finally {
    saving.value = false
  }
}

function askUnbind(s) { unbindTarget.value = s }

async function onUnbind() {
  unbinding.value = true
  try {
    const res = await unbindStudent(unbindTarget.value.id)
    if (res && res.success) {
      unbindTarget.value = null
      loadStudents()
    } else {
      alert((res && res.message) || '解除失败')
    }
  } catch (e) {
    alert('网络错误，解除失败')
  } finally {
    unbinding.value = false
  }
}

watch(currentGroupId, () => { loadStudents() })

onMounted(() => {
  loadGroups()
  loadAllUsers()
  loadStudents()
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

.status { font-size: 12px; }
.status-active { color: #19a558; }
.status-quit { color: #8a9099; }

.btn {
  height: 30px; padding: 0 12px; border-radius: 8px; font-size: 13px;
  cursor: pointer; border: 1px solid #dfe3e8; background: #fff; color: #1f2329;
}
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
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }

.form-item { margin-bottom: 14px; }
.form-label { display: block; font-size: 13px; color: #4e5969; margin-bottom: 6px; }
.req { color: #ea4335; }
.form-input {
  width: 100%; box-sizing: border-box; border: 1px solid #dfe3e8; border-radius: 8px;
  padding: 8px 10px; font-size: 13px; outline: none; color: #1f2329; background: #fff; height: 36px;
}
.form-input:focus { border-color: #0d80e0; }
.form-error { color: #ea4335; font-size: 13px; margin: 8px 0 0; }
</style>
