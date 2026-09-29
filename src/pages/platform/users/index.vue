<template>
  <div class="page">
    <div class="page-head">
      <div class="header-left">
        <h2 class="page-title">👤 用户管理</h2>
        <p class="page-desc">维护平台全部登录账号（仅超级管理员可见）</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="openBatch">📥 批量导入</button>
        <button class="btn btn-primary" @click="openCreate">＋ 新增用户</button>
      </div>
    </div>

    <div class="card">
      <div class="filter-bar">
        <input v-model="keyword" class="input" placeholder="按账号关键字过滤" @keyup.enter="loadList" />
        <select v-model="filterRole" class="input" @change="loadList">
          <option value="">全部角色</option>
          <option v-for="r in roleOptions" :key="r.value" :value="r.value">{{ r.label }}</option>
        </select>
        <button class="btn btn-secondary" @click="loadList">查询</button>
      </div>

      <div v-if="loading" class="state">加载中…</div>
      <div v-else-if="errorMsg" class="state error">⚠️ {{ errorMsg }}</div>
      <div v-else-if="!filteredRows.length" class="state">🗂️ 暂无用户数据</div>
      <table v-else class="tbl">
        <thead>
          <tr>
            <th>ID</th><th>账号</th><th>角色</th><th>状态</th><th>需改密</th><th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in filteredRows" :key="u.id">
            <td>{{ u.id }}</td>
            <td>{{ u.username }}</td>
            <td><span class="tag" :class="'tag-' + u.role">{{ roleLabel(u.role) }}</span></td>
            <td><span class="dot" :class="'dot-' + u.status"></span>{{ statusLabel(u.status) }}</td>
            <td>{{ u.must_change_password ? '是' : '否' }}</td>
            <td class="ops">
              <button class="link" @click="openEdit(u)">编辑</button>
              <button class="link danger" @click="askDelete(u)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 新增 / 编辑弹窗 -->
    <div v-if="showForm" class="modal-mask" @click.self="closeForm">
      <div class="modal-box">
        <h3 class="modal-title">{{ editing ? '编辑用户' : '新增用户' }}</h3>
        <div class="form-item">
          <label>账号</label>
          <input v-model="form.username" class="input" :disabled="!!editing" placeholder="登录账号" />
        </div>
        <div class="form-item">
          <label>角色</label>
          <select v-model="form.role" class="input">
            <option v-for="r in roleOptions" :key="r.value" :value="r.value">{{ r.label }}</option>
          </select>
        </div>
        <div v-if="editing" class="form-item">
          <label>状态</label>
          <select v-model="form.status" class="input">
            <option value="active">正常</option>
            <option value="disabled">禁用</option>
            <option value="leave">离组</option>
          </select>
        </div>
        <div v-if="editing" class="form-item checkbox-item">
          <label><input type="checkbox" v-model="form.resetPassword" /> 重置密码为角色默认密码（下次登录强制改密）</label>
        </div>
        <p v-if="formError" class="form-error">{{ formError }}</p>
        <p v-if="resultPwd" class="result-pwd">✅ {{ resultPwd }}</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="closeForm">取消</button>
          <button class="btn btn-primary" :disabled="submitting" @click="submitForm">{{ submitting ? '保存中…' : '保存' }}</button>
        </div>
      </div>
    </div>

    <!-- 删除确认 -->
    <div v-if="deleting" class="modal-mask" @click.self="deleting = null">
      <div class="modal-box">
        <p class="modal-text">确定删除账号「{{ deleting.username }}」吗？该操作为硬删除，不可恢复。</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="deleting = null">取消</button>
          <button class="btn btn-danger" @click="confirmDelete">删除</button>
        </div>
      </div>
    </div>

    <!-- 批量导入弹窗 -->
    <div v-if="showBatch" class="modal-mask" @click.self="showBatch = false">
      <div class="modal-box wide">
        <h3 class="modal-title">批量导入用户</h3>
        <p class="batch-hint">每行一条：账号,角色（角色可选，缺省 student）；或粘贴 JSON 数组 [{ username, role }]；也可直接选择 CSV 文件导入。单次最多 500 条。初始密码按角色默认值生成。</p>
        <div class="batch-tools">
          <button class="btn btn-secondary" @click="downloadSampleCsv">📄 下载示例 CSV</button>
          <button class="btn btn-secondary" @click="pickCsvFile">📂 选择 CSV 文件</button>
          <span v-if="batchFileName" class="batch-file-name">已选择：{{ batchFileName }}</span>
        </div>
        <input ref="csvInput" type="file" accept=".csv,text/csv" class="hidden-file" @change="onPickCsv" />
        <textarea v-model="batchText" class="textarea" rows="8" placeholder="zhangsan,student&#10;lisi,mentor&#10;wangwu,group_admin"></textarea>
        <p v-if="batchError" class="form-error">{{ batchError }}</p>
        <div v-if="batchResult" class="batch-result">
          <p class="ok-line">✅ 成功导入 {{ batchResult.createdCount }} 条。</p>
          <div v-if="batchResult.failedRows && batchResult.failedRows.length" class="failed-box">
            <p class="failed-title">失败明细（{{ batchResult.failedRows.length }}）：</p>
            <div v-for="f in batchResult.failedRows" :key="f.row" class="failed-row">第{{ f.row }}行「{{ f.username }}」：{{ f.reason }}</div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="showBatch = false">关闭</button>
          <button class="btn btn-primary" :disabled="batchSubmitting" @click="submitBatch">{{ batchSubmitting ? '导入中…' : '开始导入' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { dialogAlert, dialogConfirm } from '../../../composables/useDialog'
import { ref, computed, onMounted } from 'vue'
import { listUsers, createUser, updateUser, deleteUser, batchCreateUsers } from '../../../api'

const roleOptions = [
  { value: 'super_admin', label: '超级管理员' },
  { value: 'group_admin', label: '课题组管理员' },
  { value: 'mentor', label: '导师' },
  { value: 'student', label: '学生' }
]
function roleLabel(r) {
  const o = roleOptions.find((x) => x.value === r.value)
  return o ? o.label : r
}
function statusLabel(s) {
  return { active: '正常', disabled: '禁用', leave: '离组' }[s] || s
}

const rows = ref([])
const loading = ref(false)
const errorMsg = ref('')
const keyword = ref('')
const filterRole = ref('')

async function loadList() {
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await listUsers()
    if (res && res.success) {
      rows.value = res.users || []
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
  let list = rows.value
  if (filterRole.value) list = list.filter((u) => u.role === filterRole.value)
  if (keyword.value.trim()) {
    const k = keyword.value.trim().toLowerCase()
    list = list.filter((u) => String(u.username).toLowerCase().includes(k))
  }
  return list
})

// 新增 / 编辑
const showForm = ref(false)
const editing = ref(null)
const submitting = ref(false)
const formError = ref('')
const resultPwd = ref('')
const form = ref({ username: '', role: 'student', status: 'active', resetPassword: false })

function openCreate() {
  editing.value = null
  form.value = { username: '', role: 'student', status: 'active', resetPassword: false }
  formError.value = ''
  resultPwd.value = ''
  showForm.value = true
}
function openEdit(u) {
  editing.value = u
  form.value = { username: u.username, role: u.role, status: u.status, resetPassword: false }
  formError.value = ''
  resultPwd.value = ''
  showForm.value = true
}
function closeForm() {
  showForm.value = false
}

async function submitForm() {
  formError.value = ''
  resultPwd.value = ''
  if (!form.value.username.trim()) {
    formError.value = '账号不能为空'
    return
  }
  submitting.value = true
  try {
    let res
    if (editing.value) {
      const payload = { id: editing.value.id, role: form.value.role, status: form.value.status }
      if (form.value.resetPassword) payload.resetPassword = true
      res = await updateUser(payload)
      if (res && res.success && res.plainPassword) {
        resultPwd.value = `已重置密码为：${res.plainPassword}（请告知用户首次登录后修改）`
      }
    } else {
      res = await createUser({ username: form.value.username.trim(), role: form.value.role })
      if (res && res.success && res.plainPassword) {
        resultPwd.value = `初始密码：${res.plainPassword}（请告知用户首次登录后修改）`
      }
    }
    if (res && res.success) {
      if (!editing.value) {
        // 新建成功后保留弹窗以展示初始密码，关闭时刷新列表
      } else {
        showForm.value = false
      }
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

// 删除
const deleting = ref(null)
function askDelete(u) {
  deleting.value = u
}
async function confirmDelete() {
  try {
    const res = await deleteUser(deleting.value.id)
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

// 批量导入
const showBatch = ref(false)
const batchText = ref('')
const batchError = ref('')
const batchSubmitting = ref(false)
const batchResult = ref(null)
const csvInput = ref(null)
const batchFileName = ref('')

function openBatch() {
  batchText.value = ''
  batchError.value = ''
  batchResult.value = null
  batchFileName.value = ''
  showBatch.value = true
}

// 下载示例 CSV（带 UTF-8 BOM，Excel 打开中文不乱码）
function downloadSampleCsv() {
  const content = '\ufeffusername,role\nzhangsan,student\nlisi,mentor\nwangwu,group_admin\nzhaoliu,student\n'
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '用户导入示例.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function pickCsvFile() {
  if (csvInput.value) csvInput.value.click()
}

// 读取 CSV 文件内容：优先 UTF-8，失败（Excel 导出的 GBK 编码）回退 GBK 解码
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  }).then((buf) => {
    const bytes = new Uint8Array(buf)
    let start = 0
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) start = 3
    const slice = bytes.slice(start)
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(slice)
    } catch (e) {
      return new TextDecoder('gbk').decode(slice)
    }
  })
}

// 解析 CSV 文本为「账号,角色」行数组：支持表头（username/账号），跳过空行与表头
function parseCsv(text) {
  const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  let start = 0
  if (lines.length && /username|账号|用户名/i.test(lines[0])) start = 1
  const rows = []
  for (let i = start; i < lines.length; i++) {
    const parts = lines[i].split(/[,，\t]/).map((x) => x.trim())
    if (!parts[0]) continue
    rows.push(`${parts[0]},${parts[1] || 'student'}`)
  }
  return rows
}

async function onPickCsv(e) {
  const file = e.target.files && e.target.files[0]
  e.target.value = ''
  if (!file) return
  batchError.value = ''
  batchResult.value = null
  try {
    const text = await readFileAsText(file)
    const rows = parseCsv(text)
    if (!rows.length) {
      batchError.value = 'CSV 中没有有效数据（请确保每行格式为：账号,角色）'
      return
    }
    batchText.value = rows.join('\n')
    batchFileName.value = file.name
  } catch (err) {
    batchError.value = '读取 CSV 文件失败，请重试'
  }
}

function parseBatch(text) {
  const trimmed = text.trim()
  if (!trimmed) return []
  if (trimmed.startsWith('[')) {
    const arr = JSON.parse(trimmed)
    return arr.map((u) => ({ username: u.username, role: u.role || 'student' }))
  }
  const out = []
  trimmed.split(/\r?\n/).forEach((line) => {
    const s = line.trim()
    if (!s) return
    const parts = s.split(/[,，\t]/).map((x) => x.trim())
    out.push({ username: parts[0], role: parts[1] || 'student' })
  })
  return out
}

async function submitBatch() {
  batchError.value = ''
  batchResult.value = null
  let users
  try {
    users = parseBatch(batchText.value)
  } catch (e) {
    batchError.value = '解析失败：请检查是否为每行「账号,角色」或合法 JSON 数组'
    return
  }
  if (!users.length) {
    batchError.value = '没有可导入的数据'
    return
  }
  batchSubmitting.value = true
  try {
    const res = await batchCreateUsers(users)
    if (res && res.success) {
      batchResult.value = res
      await loadList()
    } else {
      batchError.value = (res && res.message) || '导入失败'
      if (res && res.failedRows) batchResult.value = res
    }
  } catch (e) {
    batchError.value = '网络异常'
  } finally {
    batchSubmitting.value = false
  }
}

onMounted(loadList)
</script>

<style scoped>
.page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; justify-content: space-between; align-items: center; }
.header-left { display: flex; align-items: flex-end; gap: 14px; }
.page-title { margin: 0; font-size: 18px; color: #1f2329; }
.page-desc { margin: 0 0 3px; font-size: 13px; color: #8a9099; }
.head-actions { display: flex; gap: 10px; }

.card {
  background: #fff; border: 1px solid #eceff3; border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04); padding: 16px;
}
.filter-bar { display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }

.input {
  height: 34px; padding: 0 10px; font-size: 13px;
  border: 1px solid #dfe3e8; border-radius: 8px; outline: none; background: #fff; color: #1f2329;
}
.input:focus { border-color: #0d80e0; }
.filter-bar .input { min-width: 160px; }
.textarea {
  width: 100%; box-sizing: border-box; padding: 10px; font-size: 13px;
  border: 1px solid #dfe3e8; border-radius: 8px; outline: none; resize: vertical; font-family: inherit;
}
.textarea:focus { border-color: #0d80e0; }

.btn {
  height: 34px; padding: 0 16px; border-radius: 8px; font-size: 13px; cursor: pointer;
  border: 1px solid #dfe3e8; background: #fff; color: #1f2329;
}
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

.tag { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; }
.tag-super_admin { background: #fde7e7; color: #d4382f; }
.tag-group_admin { background: #e6f4ff; color: #0d80e0; }
.tag-mentor { background: #e8f7ee; color: #19a558; }
.tag-student { background: #f2f3f5; color: #4e5969; }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
.dot-active { background: #19a558; }
.dot-disabled { background: #ea4335; }
.dot-leave { background: #f5a623; }

.modal-mask {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal-box {
  width: 480px; background: #fff; border-radius: 12px; padding: 24px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}
.modal-box.wide { width: 640px; }
.modal-title { margin: 0 0 16px; font-size: 16px; color: #1f2329; }
.modal-text { font-size: 14px; color: #1f2329; margin: 0 0 20px; line-height: 1.6; }
.modal-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 18px; }
.modal-actions .btn { flex: 0 0 auto; }

.form-item { margin-bottom: 14px; }
.form-item label { display: block; font-size: 13px; color: #4e5969; margin-bottom: 6px; }
.form-item .input { width: 100%; box-sizing: border-box; }
.checkbox-item label { display: flex; align-items: center; gap: 6px; color: #1f2329; }
.form-error { color: #ea4335; font-size: 12px; margin: 6px 0 0; }
.result-pwd { background: #e8f7ee; color: #19a558; font-size: 13px; padding: 8px 12px; border-radius: 8px; margin: 8px 0 0; }

.batch-hint { font-size: 12px; color: #8a9099; margin: 0 0 10px; line-height: 1.6; }
.batch-tools { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
.batch-tools .btn { height: 30px; padding: 0 12px; font-size: 12px; }
.batch-file-name { font-size: 12px; color: #0d80e0; }
.hidden-file { display: none; }
.batch-result { margin-top: 12px; font-size: 13px; }
.batch-result .ok-line { color: #19a558; margin: 0; }
.failed-box { margin-top: 8px; background: #fff5f5; border-radius: 8px; padding: 10px 12px; }
.failed-title { margin: 0 0 6px; color: #ea4335; font-size: 12px; }
.failed-row { font-size: 12px; color: #4e5969; line-height: 1.8; }
</style>
