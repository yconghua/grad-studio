<template>
  <div class="page">
    <div class="page-head">
      <h3 class="page-title">活动报名</h3>
      <div class="head-actions">
        <button v-if="isManager" class="btn btn-primary" @click="openCreate">发起活动</button>
      </div>
    </div>

    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>活动名称</th>
            <th>时间</th>
            <th>地点</th>
            <th>状态</th>
            <th>报名情况</th>
            <th class="col-ops">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="6" class="state">加载中…</td></tr>
          <tr v-else-if="!list.length"><td colspan="6" class="state">暂无活动</td></tr>
          <tr v-for="row in list" :key="row.id" v-else>
            <td>{{ row.title }}</td>
            <td>{{ fmt(row.start_time) }}</td>
            <td>{{ row.location || '-' }}</td>
            <td>{{ statusLabel(row.status) }}</td>
            <td>{{ row.max_signups ? row.max_signups + ' 人上限' : '不限' }}</td>
            <td class="col-ops">
              <button v-if="row.status === 'open'" class="btn-link" @click="signup(row)">报名</button>
              <button class="btn-link" @click="cancelSignup(row)">取消报名</button>
              <button class="btn-link" @click="showSignups(row)">名单</button>
              <template v-if="isManager">
                <button class="btn-link" @click="openEdit(row)">编辑</button>
                <button class="btn-link danger" @click="removeActivity(row)">删除</button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 发起/编辑活动弹窗 -->
    <div v-if="formVisible" class="modal-mask" @click.self="formVisible = false">
      <div class="modal-box">
        <div class="modal-head">
          <h4>{{ formMode === 'create' ? '发起活动' : '编辑活动' }}</h4>
          <button class="modal-close" @click="formVisible = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-item">
            <label class="form-label">活动名称<span class="req"> *</span></label>
            <input v-model="form.title" class="form-input" />
          </div>
          <div class="form-row">
            <div class="form-item">
              <label class="form-label">开始时间</label>
              <input v-model="form.start_time" type="datetime-local" class="form-input" />
            </div>
            <div class="form-item">
              <label class="form-label">结束时间</label>
              <input v-model="form.end_time" type="datetime-local" class="form-input" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-item">
              <label class="form-label">地点</label>
              <input v-model="form.location" class="form-input" />
            </div>
            <div class="form-item">
              <label class="form-label">报名上限</label>
              <input v-model.number="form.max_signups" type="number" class="form-input" placeholder="留空不限" />
            </div>
          </div>
          <div class="form-item">
            <label class="form-label">活动简介</label>
            <textarea v-model="form.description" class="form-input" rows="3"></textarea>
          </div>
          <p v-if="formError" class="form-error">{{ formError }}</p>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="formVisible = false">取消</button>
          <button class="btn btn-primary" @click="submit" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button>
        </div>
      </div>
    </div>

    <!-- 报名名单弹窗 -->
    <div v-if="signupVisible" class="modal-mask" @click.self="signupVisible = false">
      <div class="modal-box">
        <div class="modal-head">
          <h4>报名名单</h4>
          <button class="modal-close" @click="signupVisible = false">×</button>
        </div>
        <div class="modal-body">
          <p v-if="!signupList.length" class="empty-tip">暂无报名</p>
          <table v-else class="data-table">
            <thead><tr><th>成员ID</th><th>状态</th><th>报名时间</th></tr></thead>
            <tbody>
              <tr v-for="s in signupList" :key="s.id">
                <td>{{ s.user_id }}</td>
                <td>{{ signupStatusLabel(s.status) }}</td>
                <td>{{ fmt(s.created_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { collab } from '../../api'
import { ACTIVITY_STATUS_OPTIONS, SIGNUP_STATUS_OPTIONS } from '../../config/fieldOptions'
import { useRole } from '../../composables/useRole'

const { isManager } = useRole()
const list = ref([])
const loading = ref(false)
const formVisible = ref(false)
const formMode = ref('create')
const form = ref({})
const formError = ref('')
const saving = ref(false)
const editingId = ref(null)
const signupVisible = ref(false)
const signupList = ref([])

function fmt(v) {
  return v ? String(v).slice(0, 16) : '-'
}
function statusLabel(v) {
  const o = ACTIVITY_STATUS_OPTIONS.find((x) => x.value === v)
  return o ? o.label : (v || '-')
}
function signupStatusLabel(v) {
  const o = SIGNUP_STATUS_OPTIONS.find((x) => x.value === v)
  return o ? o.label : (v || '-')
}

async function load() {
  loading.value = true
  try {
    const res = await collab.activity.list()
    list.value = res && res.success ? res.list || [] : []
  } catch (e) {
    list.value = []
  } finally {
    loading.value = false
  }
}

function openCreate() {
  formMode.value = 'create'
  editingId.value = null
  form.value = { title: '', start_time: '', end_time: '', location: '', max_signups: null, description: '' }
  formError.value = ''
  formVisible.value = true
}

function openEdit(row) {
  formMode.value = 'edit'
  editingId.value = row.id
  form.value = {
    title: row.title || '',
    start_time: row.start_time ? String(row.start_time).slice(0, 16).replace(' ', 'T') : '',
    end_time: row.end_time ? String(row.end_time).slice(0, 16).replace(' ', 'T') : '',
    location: row.location || '',
    max_signups: row.max_signups || null,
    description: row.description || ''
  }
  formError.value = ''
  formVisible.value = true
}

async function submit() {
  formError.value = ''
  if (!form.value.title || !String(form.value.title).trim()) {
    formError.value = '请填写活动名称'
    return
  }
  const payload = { ...form.value }
  if (payload.start_time) payload.start_time = payload.start_time.replace('T', ' ') + ':00'
  if (payload.end_time) payload.end_time = payload.end_time.replace('T', ' ') + ':00'
  saving.value = true
  try {
    const res = formMode.value === 'create'
      ? await collab.activity.create(payload)
      : await collab.activity.update(editingId.value, payload)
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

async function signup(row) {
  try {
    const res = await collab.signup(row.id)
    if (res && res.success) window.alert(res.message || '报名成功')
    else window.alert((res && res.message) || '报名失败')
  } catch (e) {
    window.alert('报名过程出现异常，请重试')
  }
}

async function cancelSignup(row) {
  try {
    const res = await collab.cancelSignup(row.id)
    if (res && res.success) window.alert(res.message || '已取消')
    else window.alert((res && res.message) || '取消失败')
  } catch (e) {
    window.alert('取消过程出现异常，请重试')
  }
}

async function showSignups(row) {
  try {
    const res = await collab.signupList(row.id)
    signupList.value = res && res.success ? res.list || [] : []
    signupVisible.value = true
  } catch (e) {
    signupList.value = []
    signupVisible.value = true
  }
}

async function removeActivity(row) {
  if (!window.confirm(`确定删除活动「${row.title}」吗？`)) return
  try {
    const res = await collab.activity.remove(row.id)
    if (res && res.success) await load()
    else window.alert((res && res.message) || '删除失败')
  } catch (e) {
    window.alert('删除过程出现异常，请重试')
  }
}

onMounted(load)
</script>

<style scoped>
.page {
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
}
.head-actions {
  display: flex;
  gap: 8px;
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
.btn-primary {
  border: none;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  color: #fff;
  font-weight: 600;
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
  max-width: 220px;
}
.data-table th {
  background: #f5f7fa;
  color: #4e5969;
  font-weight: 600;
}
.state {
  text-align: center;
  color: #8a9099;
  padding: 32px 0;
}
.col-ops {
  width: 220px;
}
.btn-link {
  border: none;
  background: none;
  color: #0d80e0;
  font-size: 13px;
  cursor: pointer;
  padding: 0 5px;
}
.btn-link.danger {
  color: #ea4335;
}
.empty-tip {
  text-align: center;
  color: #8a9099;
  padding: 24px 0;
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
  width: 520px;
  max-width: 92vw;
  max-height: 85vh;
  background: #fff;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
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
  padding: 8px 10px;
  font-size: 13px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  outline: none;
  box-sizing: border-box;
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
