<template>
  <div class="page">
    <div class="page-head">
      <h3 class="page-title">入组离组</h3>
      <div class="head-actions">
        <button class="btn btn-primary" @click="openCreate">发起申请</button>
      </div>
    </div>

    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>申请人ID</th>
            <th>类型</th>
            <th>原因</th>
            <th>状态</th>
            <th>申请日期</th>
            <th>审核人ID</th>
            <th class="col-ops">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="7" class="state">加载中…</td></tr>
          <tr v-else-if="!list.length"><td colspan="7" class="state">暂无申请</td></tr>
          <tr v-for="row in list" :key="row.id" v-else>
            <td>{{ row.user_id }}</td>
            <td>{{ typeLabel(row.type) }}</td>
            <td>{{ row.reason || '-' }}</td>
            <td>{{ statusLabel(row.status) }}</td>
            <td>{{ row.apply_date || '-' }}</td>
            <td>{{ row.handler_id || '-' }}</td>
            <td class="col-ops">
              <template v-if="isManager && row.status === 'pending'">
                <button class="btn-link" @click="review(row, true)">通过</button>
                <button class="btn-link danger" @click="review(row, false)">驳回</button>
              </template>
              <span v-else-if="row.status !== 'pending'">已处理</span>
              <span v-else>-</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 发起申请弹窗 -->
    <div v-if="formVisible" class="modal-mask" @click.self="formVisible = false">
      <div class="modal-box">
        <div class="modal-head">
          <h4>发起入组/离组申请</h4>
          <button class="modal-close" @click="formVisible = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-item">
            <label class="form-label">类型<span class="req"> *</span></label>
            <select v-model="form.type" class="form-input">
              <option value="">请选择</option>
              <option v-for="o in JOIN_LEAVE_TYPE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>
          <div class="form-item">
            <label class="form-label">申请原因</label>
            <textarea v-model="form.reason" class="form-input" rows="3"></textarea>
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
import { studio } from '../../api'
import { JOIN_LEAVE_TYPE_OPTIONS, JOIN_LEAVE_STATUS_OPTIONS } from '../../config/fieldOptions'
import { useRole } from '../../composables/useRole'
import { dialogAlert, dialogPrompt } from '../../composables/useDialog'

const { isManager } = useRole()
const list = ref([])
const loading = ref(false)
const formVisible = ref(false)
const form = ref({ type: 'join', reason: '' })
const formError = ref('')
const saving = ref(false)

function typeLabel(v) {
  const o = JOIN_LEAVE_TYPE_OPTIONS.find((x) => x.value === v)
  return o ? o.label : (v || '-')
}
function statusLabel(v) {
  const o = JOIN_LEAVE_STATUS_OPTIONS.find((x) => x.value === v)
  return o ? o.label : (v || '-')
}

async function load() {
  loading.value = true
  try {
    const res = await studio.joinLeave.list()
    list.value = res && res.success ? res.list || [] : []
  } catch (e) {
    list.value = []
  } finally {
    loading.value = false
  }
}

function openCreate() {
  form.value = { type: 'join', reason: '' }
  formError.value = ''
  formVisible.value = true
}

async function submit() {
  formError.value = ''
  if (!form.value.type) {
    formError.value = '请选择类型'
    return
  }
  saving.value = true
  try {
    const res = await studio.joinLeave.create(form.value)
    if (res && res.success) {
      formVisible.value = false
      await load()
    } else {
      formError.value = (res && res.message) || '提交失败'
    }
  } catch (e) {
    formError.value = '提交过程出现异常，请重试'
  } finally {
    saving.value = false
  }
}

async function review(row, approved) {
  const remark = (await dialogPrompt(approved ? '审核意见（可选）：' : '驳回理由（可选）：', '', approved ? '通过申请' : '驳回申请')) || ''
  try {
    const res = await studio.reviewJoinLeave(row.id, approved, remark)
    if (res && res.success) {
      await load()
    } else {
      await dialogAlert((res && res.message) || '操作失败')
    }
  } catch (e) {
    await dialogAlert('操作出现异常，请重试')
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
  width: 120px;
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
