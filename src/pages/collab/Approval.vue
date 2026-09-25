<template>
  <div class="page">
    <div class="page-head">
      <h3 class="page-title">审批中心</h3>
      <div class="head-actions">
        <button class="btn btn-primary" @click="openCreate">发起审批</button>
      </div>
    </div>

    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>标题</th>
            <th>类型</th>
            <th>申请人</th>
            <th>状态</th>
            <th>申请时间</th>
            <th>审批人</th>
            <th class="col-ops">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="7" class="state">加载中…</td></tr>
          <tr v-else-if="!list.length"><td colspan="7" class="state">暂无审批</td></tr>
          <tr v-for="row in list" :key="row.id" v-else>
            <td>{{ row.title }}</td>
            <td>{{ row.type || '-' }}</td>
            <td>{{ memberName(row.applicant_id) }}</td>
            <td>{{ statusLabel(row.status) }}</td>
            <td>{{ fmt(row.apply_time || row.created_at) }}</td>
            <td>{{ memberName(row.approver_id) }}</td>
            <td class="col-ops">
              <template v-if="isManager && row.status === 'pending'">
                <button class="btn-link" @click="review(row, true)">通过</button>
                <button class="btn-link danger" @click="review(row, false)">驳回</button>
              </template>
              <button v-if="row.status === 'pending' && (isAdmin || Number(row.applicant_id) === Number(myId))" class="btn-link danger" @click="removeApproval(row)">撤销</button>
              <span v-else-if="row.status !== 'pending'">已处理</span>
              <span v-else>-</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 发起审批弹窗 -->
    <div v-if="formVisible" class="modal-mask" @click.self="formVisible = false">
      <div class="modal-box">
        <div class="modal-head">
          <h4>发起审批</h4>
          <button class="modal-close" @click="formVisible = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-item">
            <label class="form-label">标题<span class="req"> *</span></label>
            <input v-model="form.title" class="form-input" />
          </div>
          <div class="form-item">
            <label class="form-label">类型</label>
            <input v-model="form.type" class="form-input" placeholder="如 请假/报销/借用" />
          </div>
          <div class="form-item">
            <label class="form-label">事由</label>
            <textarea v-model="form.content" class="form-input" rows="3"></textarea>
          </div>
          <p v-if="formError" class="form-error">{{ formError }}</p>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="formVisible = false">取消</button>
          <button class="btn btn-primary" @click="submit" :disabled="saving">{{ saving ? '提交中…' : '提交' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { collab, listMembers } from '../../api'
import { APPROVAL_STATUS_OPTIONS } from '../../config/fieldOptions'
import { useRole } from '../../composables/useRole'
import { useSession } from '../../composables/useSession'
import { dialogAlert, dialogConfirm, dialogPrompt } from '../../composables/useDialog'

const { isManager, isAdmin } = useRole()
const { getSessionUser } = useSession()
const me = getSessionUser()
const myId = me ? me.id : null
const list = ref([])
const members = ref([])
const loading = ref(false)
const formVisible = ref(false)
const form = ref({})
const formError = ref('')
const saving = ref(false)

function fmt(v) {
  return v ? String(v).slice(0, 16) : '-'
}
function memberName(id) {
  if (id === null || id === undefined) return '-'
  const m = members.value.find((x) => Number(x.id) === Number(id))
  return m ? (m.real_name || m.username || String(id)) : String(id)
}
function statusLabel(v) {
  const o = APPROVAL_STATUS_OPTIONS.find((x) => x.value === v)
  return o ? o.label : (v || '-')
}

async function loadMembers() {
  try {
    const res = await listMembers()
    members.value = res && res.success ? res.members || [] : []
  } catch (e) {
    members.value = []
  }
}

async function load() {
  loading.value = true
  try {
    const res = await collab.approval.list()
    list.value = res && res.success ? res.list || [] : []
  } catch (e) {
    list.value = []
  } finally {
    loading.value = false
  }
}

function openCreate() {
  form.value = { title: '', type: '', content: '' }
  formError.value = ''
  formVisible.value = true
}

async function submit() {
  formError.value = ''
  if (!form.value.title || !String(form.value.title).trim()) {
    formError.value = '请填写标题'
    return
  }
  saving.value = true
  try {
    // 构造普通对象再传，避免 Vue reactive proxy 直接走 IPC 导致序列化异常
    const payload = {
      title: String(form.value.title || '').trim(),
      type: form.value.type || '',
      reason: form.value.content || ''
    }
    const res = await collab.approval.create(payload)
    if (res && res.success) {
      formVisible.value = false
      await load()
    } else {
      formError.value = (res && res.message) || '提交失败'
    }
  } catch (e) {
    console.error('[Approval.submit] 提交异常:', e)
    formError.value = '提交过程出现异常，请重试'
  } finally {
    saving.value = false
  }
}

async function review(row, approved) {
  const remark = (await dialogPrompt(approved ? '审批意见（可选）：' : '驳回理由（可选）：', '', approved ? '通过审批' : '驳回审批')) || ''
  try {
    const res = await collab.reviewApproval(row.id, approved, remark)
    if (res && res.success) await load()
    else await dialogAlert((res && res.message) || '操作失败')
  } catch (e) {
    await dialogAlert('操作出现异常，请重试')
  }
}

async function removeApproval(row) {
  const ok = await dialogConfirm(`确定撤销「${row.title}」吗？`, '撤销审批')
  if (!ok) return
  try {
    const res = await collab.approval.remove(row.id)
    if (res && res.success) await load()
    else await dialogAlert((res && res.message) || '撤销失败')
  } catch (e) {
    await dialogAlert('撤销过程出现异常，请重试')
  }
}

onMounted(() => {
  load()
  loadMembers()
})
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
  width: 150px;
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
  width: 480px;
  max-width: 92vw;
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
