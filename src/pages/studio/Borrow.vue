<template>
  <div class="page">
    <div class="page-head">
      <h3 class="page-title">物品借用</h3>
      <div class="head-actions">
        <button class="btn btn-primary" @click="openCreate">新增借用</button>
      </div>
    </div>

    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>物品名称</th>
            <th>借用人</th>
            <th>用途</th>
            <th>状态</th>
            <th>借用日期</th>
            <th>预计归还</th>
            <th>实际归还</th>
            <th class="col-ops">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="8" class="state">加载中…</td></tr>
          <tr v-else-if="!list.length"><td colspan="8" class="state">暂无借用记录</td></tr>
          <tr v-for="row in list" :key="row.id" v-else>
            <td>{{ row.item_name }}</td>
            <td>{{ borrowerName(row.borrower_id) }}</td>
            <td>{{ row.purpose || '-' }}</td>
            <td>{{ statusLabel(row.status) }}</td>
            <td>{{ row.borrow_date || '-' }}</td>
            <td>{{ row.expect_return_date || '-' }}</td>
            <td>{{ row.return_date || '-' }}</td>
            <td class="col-ops">
              <button v-if="row.status === 'borrowed'" class="btn-link" @click="returnItem(row)">归还</button>
              <span v-else>-</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 新增借用弹窗 -->
    <div v-if="formVisible" class="modal-mask" @click.self="formVisible = false">
      <div class="modal-box">
        <div class="modal-head">
          <h4>新增借用</h4>
          <button class="modal-close" @click="formVisible = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-item">
            <label class="form-label">物品名称<span class="req"> *</span></label>
            <input v-model="form.item_name" class="form-input" />
          </div>
          <div class="form-row">
            <div class="form-item">
              <label class="form-label">借用人<span class="req"> *</span></label>
              <select v-model="form.borrower_id" class="form-input">
                <option :value="null">请选择</option>
                <option v-for="m in members" :key="m.id" :value="m.id">{{ m.real_name ? `${m.real_name}（${m.username}）` : m.username }}</option>
              </select>
            </div>
            <div class="form-item">
              <label class="form-label">关联设备ID</label>
              <input v-model.number="form.device_id" type="number" class="form-input" />
            </div>
          </div>
          <div class="form-item">
            <label class="form-label">用途</label>
            <input v-model="form.purpose" class="form-input" />
          </div>
          <div class="form-row">
            <div class="form-item">
              <label class="form-label">借用日期</label>
              <input v-model="form.borrow_date" type="date" class="form-input" />
            </div>
            <div class="form-item">
              <label class="form-label">预计归还</label>
              <input v-model="form.expect_return_date" type="date" class="form-input" />
            </div>
          </div>
          <p v-if="formError" class="form-error">{{ formError }}</p>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="formVisible = false">取消</button>
          <button class="btn btn-primary" @click="submit" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { studio, listMembers } from '../../api'
import { BORROW_STATUS_OPTIONS } from '../../config/fieldOptions'
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'

const list = ref([])
const loading = ref(false)
const formVisible = ref(false)
const form = ref({})
const formError = ref('')
const saving = ref(false)
const members = ref([])

function borrowerName(id) {
  const m = members.value.find((x) => x.id === id)
  return m ? (m.real_name ? `${m.real_name}（${m.username}）` : m.username) : id
}

function statusLabel(v) {
  const o = BORROW_STATUS_OPTIONS.find((x) => x.value === v)
  return o ? o.label : (v || '-')
}

async function load() {
  loading.value = true
  try {
    const res = await studio.borrow.list()
    list.value = res && res.success ? res.list || [] : []
  } catch (e) {
    list.value = []
  } finally {
    loading.value = false
  }
}

function openCreate() {
  form.value = { item_name: '', borrower_id: null, device_id: null, purpose: '', borrow_date: '', expect_return_date: '' }
  formError.value = ''
  formVisible.value = true
}

async function submit() {
  formError.value = ''
  if (!form.value.item_name || !String(form.value.item_name).trim()) {
    formError.value = '请填写物品名称'
    return
  }
  if (!form.value.borrower_id) {
    formError.value = '请填写借用人ID'
    return
  }
  saving.value = true
  try {
    const res = await studio.borrow.create(form.value)
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

async function returnItem(row) {
  const ok = await dialogConfirm(`确定归还「${row.item_name}」吗？`, '归还物品')
  if (!ok) return
  try {
    const res = await studio.returnBorrow(row.id)
    if (res && res.success) {
      await load()
    } else {
      await dialogAlert((res && res.message) || '归还失败')
    }
  } catch (e) {
    await dialogAlert('归还过程出现异常，请重试')
  }
}

onMounted(() => {
  load()
  listMembers()
    .then((res) => {
      if (res && res.success && Array.isArray(res.members)) members.value = res.members
    })
    .catch(() => {})
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
.state {
  text-align: center;
  color: #8a9099;
  padding: 32px 0;
}
.col-ops {
  width: 90px;
}
.btn-link {
  border: none;
  background: none;
  color: #0d80e0;
  font-size: 13px;
  cursor: pointer;
  padding: 0 6px;
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
