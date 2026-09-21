<template>
  <div class="crud-page">
    <!-- 头部：标题 + 搜索 + 新增 -->
    <div class="page-head">
      <h3 class="page-title">{{ title }}</h3>
      <div class="head-actions">
        <input
          v-if="searchField"
          v-model="keyword"
          class="search-input"
          :placeholder="`搜索${searchLabel || '标题'}`"
          @keyup.enter="load"
        />
        <button v-if="searchField" class="btn" @click="load">查询</button>
        <button v-if="writable" class="btn btn-primary" @click="openCreate">新增</button>
      </div>
    </div>

    <!-- 表格 -->
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th v-for="c in columns" :key="c.key" :style="c.width ? { width: c.width } : null">{{ c.label }}</th>
            <th v-if="writable" class="col-ops">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading" class="state-row">
            <td :colspan="columns.length + (writable ? 1 : 0)">加载中…</td>
          </tr>
          <template v-else>
            <tr v-if="!list.length" class="state-row">
              <td :colspan="columns.length + (writable ? 1 : 0)">暂无数据</td>
            </tr>
            <tr v-for="row in list" :key="row.id" class="data-row" @click="openDetail(row)">
              <td v-for="c in columns" :key="c.key" :title="cellText(row, c)">{{ cellText(row, c) }}</td>
              <td v-if="writable" class="col-ops" @click.stop>
                <button class="btn-link" @click="openEdit(row)">编辑</button>
                <button v-if="!canDelete || canDelete(row)" class="btn-link danger" @click="confirmRemove(row)">删除</button>
                <button v-if="extraAction && extraAction(row)" class="btn-link" @click="runExtra(row)">{{ extraAction(row).label }}</button>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- 详情弹窗（只读） -->
    <div v-if="detailVisible" class="modal-mask" @click.self="detailVisible = false">
      <div class="modal-box">
        <div class="modal-head">
          <h4>详情</h4>
          <button class="modal-close" @click="detailVisible = false" aria-label="关闭">×</button>
        </div>
        <div class="modal-body">
          <div v-for="f in formFields" :key="f.key" class="detail-item">
            <div class="detail-label">{{ f.label }}</div>
            <div class="detail-value">{{ detailValue(f) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 表单弹窗 -->
    <div v-if="formVisible" class="modal-mask" @click.self="closeForm">
      <div class="modal-box">
        <div class="modal-head">
          <h4>{{ formMode === 'create' ? '新增' : '编辑' }}{{ title }}</h4>
          <button class="modal-close" @click="closeForm" aria-label="关闭">×</button>
        </div>
        <div class="modal-body">
          <div v-for="f in formFields" :key="f.key" class="form-item">
            <label class="form-label">{{ f.label }}<span v-if="f.required" class="req"> *</span></label>
            <textarea
              v-if="f.type === 'textarea'"
              v-model="form[f.key]"
              class="form-input form-textarea"
              rows="3"
              :placeholder="f.placeholder || ''"
            ></textarea>
            <input
              v-else-if="f.type === 'number'"
              v-model.number="form[f.key]"
              type="number"
              class="form-input"
              :placeholder="f.placeholder || ''"
            />
            <input
              v-else-if="f.type === 'date'"
              v-model="form[f.key]"
              type="date"
              class="form-input"
            />
            <input
              v-else-if="f.type === 'datetime'"
              v-model="form[f.key]"
              type="datetime-local"
              class="form-input"
            />
            <select v-else-if="f.type === 'select'" v-model="form[f.key]" class="form-input">
              <option value="">请选择</option>
              <option v-for="o in f.options" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
            <select v-else-if="f.type === 'user'" v-model="form[f.key]" class="form-input">
              <option value="">请选择</option>
              <option v-for="m in members" :key="m.id" :value="m.id">{{ memberLabel(m) }}</option>
            </select>
            <input
              v-else
              v-model="form[f.key]"
              type="text"
              class="form-input"
              :placeholder="f.placeholder || ''"
            />
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
import { listMembers } from '../api'
import { dialogAlert, dialogConfirm } from '../composables/useDialog'

const props = defineProps({
  title: { type: String, default: '' },
  api: { type: Object, required: true },
  columns: { type: Array, default: () => [] },
  formFields: { type: Array, default: () => [] },
  searchField: { type: String, default: '' },
  searchLabel: { type: String, default: '标题' },
  writable: { type: Boolean, default: true },
  fixedFilters: { type: Object, default: () => ({}) },
  canDelete: { type: Function, default: null },
  extraAction: { type: Function, default: null }
})

const list = ref([])
const loading = ref(false)
const keyword = ref('')
const formVisible = ref(false)
const formMode = ref('create')
const form = ref({})
const formError = ref('')
const saving = ref(false)
const editingId = ref(null)
const members = ref([])
const detailVisible = ref(false)
const detailRow = ref({})

function memberLabel(m) {
  return m.real_name ? `${m.real_name}（${m.username}）` : m.username
}
function memberName(id) {
  const m = members.value.find((x) => x.id === id)
  return m ? memberLabel(m) : id
}

function cellText(row, c) {
  const v = row[c.key]
  if (v === null || v === undefined || v === '') return '-'
  if (c.type === 'select' && Array.isArray(c.options)) {
    const opt = c.options.find((o) => o.value === v)
    return opt ? opt.label : v
  }
  if (c.type === 'user') return memberName(v)
  if (c.type === 'datetime') return String(v).slice(0, 16)
  return v
}

function detailValue(f) {
  const v = detailRow.value[f.key]
  if (v === null || v === undefined || v === '') return '-'
  if (f.type === 'select' && Array.isArray(f.options)) {
    const opt = f.options.find((o) => o.value === v)
    return opt ? opt.label : v
  }
  if (f.type === 'user') return memberName(v)
  if (f.type === 'datetime') return String(v).slice(0, 16)
  return v
}

function openDetail(row) {
  detailRow.value = row
  detailVisible.value = true
}

function buildFilters() {
  const filters = { ...props.fixedFilters }
  if (props.searchField && keyword.value.trim()) {
    filters[props.searchField] = { op: 'LIKE', value: `%${keyword.value.trim()}%` }
  }
  return filters
}

async function load() {
  loading.value = true
  try {
    const filters = buildFilters()
    const res = await props.api.list(filters)
    if (res && res.success) {
      list.value = res.list || []
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
  formError.value = ''
  const data = {}
  for (const f of props.formFields) {
    data[f.key] = f.default !== undefined ? f.default : ''
  }
  form.value = data
  formVisible.value = true
}

function openEdit(row) {
  formMode.value = 'edit'
  editingId.value = row.id
  formError.value = ''
  const data = {}
  for (const f of props.formFields) {
    const v = row[f.key]
    if (v === null || v === undefined) {
      data[f.key] = ''
    } else if (f.type === 'datetime') {
      data[f.key] = String(v).slice(0, 16).replace(' ', 'T')
    } else {
      data[f.key] = v
    }
  }
  form.value = data
  formVisible.value = true
}

function closeForm() {
  if (saving.value) return
  formVisible.value = false
}

function preparePayload() {
  const payload = {}
  for (const f of props.formFields) {
    let v = form.value[f.key]
    if (v === '' || v === null || v === undefined) v = null
    if (f.type === 'datetime' && v) v = String(v).replace('T', ' ') + ':00'
    if (f.type === 'number' && v !== null && v !== '') v = Number(v)
    if (f.required && (v === null || v === '')) {
      formError.value = `请填写「${f.label}」`
      return null
    }
    if (v === null) continue
    payload[f.key] = v
  }
  return payload
}

async function submit() {
  formError.value = ''
  const payload = preparePayload()
  if (!payload) return
  saving.value = true
  try {
    const res =
      formMode.value === 'create'
        ? await props.api.create(payload)
        : await props.api.update(editingId.value, payload)
    if (res && res.success) {
      formVisible.value = false
      keyword.value = ''
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

async function runExtra(row) {
  const act = props.extraAction ? props.extraAction(row) : null
  if (!act) return
  await act.onClick(row)
  await load()
}

async function confirmRemove(row) {
  const ok = await dialogConfirm(`确定删除「${cellText(row, props.columns[0] || { key: 'id' })}」吗？`, '删除确认')
  if (!ok) return
  try {
    const res = await props.api.remove(row.id)
    if (res && res.success) {
      await load()
    } else {
      await dialogAlert((res && res.message) || '删除失败')
    }
  } catch (e) {
    await dialogAlert('删除过程出现异常，请重试')
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
.crud-page {
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
  transition: all 0.2s;
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
  max-width: 240px;
}
.data-table th {
  background: #f5f7fa;
  color: #4e5969;
  font-weight: 600;
}
.data-table td {
  color: #1f2329;
}
.data-row {
  cursor: pointer;
}
.data-row:hover td {
  background: #f9fafb;
}
.state-row td {
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
  width: 520px;
  max-width: 92vw;
  max-height: 82vh;
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
  color: #1f2329;
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
.form-textarea {
  padding: 8px 10px;
  resize: vertical;
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
.detail-item {
  margin-bottom: 12px;
}
.detail-label {
  font-size: 12px;
  color: #8a9099;
  margin-bottom: 4px;
}
.detail-value {
  font-size: 14px;
  color: #1f2329;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
