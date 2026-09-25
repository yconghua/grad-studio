<template>
  <div class="user-manage">
    <div class="page-head">
      <h3 class="page-title">成员管理</h3>
      <div class="head-actions">
        <input v-model="keyword" class="search-input" placeholder="搜索账号" @keyup.enter="load" />
        <button class="btn" @click="load">查询</button>
        <button v-if="isAdmin" class="btn btn-primary" @click="openCreate">新增成员</button>
      </div>
    </div>

    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>账号</th>
            <th>姓名</th>
            <th>角色</th>
            <th class="col-no">学号/工号</th>
            <th>指导导师</th>
            <th class="col-college">学院</th>
            <th>状态</th>
            <th v-if="isManager" class="col-ops">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td :colspan="isManager ? 8 : 7" class="state">加载中…</td></tr>
          <tr v-else-if="!list.length"><td :colspan="isManager ? 8 : 7" class="state">暂无成员</td></tr>
          <tr v-for="row in list" :key="row.id" v-else>
            <td>{{ row.username }}</td>
            <td>{{ row.real_name || '-' }}</td>
            <td>{{ roleLabel(row.role) }}</td>
            <td class="col-no">{{ row.student_no || '-' }}</td>
            <td>{{ mentorName(row.advisor_id) }}</td>
            <td class="col-college">{{ row.college || '-' }}</td>
            <td>{{ statusLabel(row.status) }}</td>
            <td v-if="isManager" class="col-ops">
              <button v-if="isAdmin" class="btn-link" @click="openEdit(row)">编辑</button>
              <button v-if="isAdmin" class="btn-link" @click="resetPassword(row)">重置密码</button>
              <button v-if="isAdmin" class="btn-link danger" @click="confirmRemove(row)">删除</button>
              <button class="btn-link" @click="openSendMsg(row)">发消息</button>
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
        <!-- 新增时显示「单个 / 批量」切换；编辑不显示 -->
        <div v-if="formMode === 'create'" class="modal-tabs">
          <button class="tab-btn" :class="{ active: batchMode === false }" @click="batchMode = false">单个新增</button>
          <button class="tab-btn" :class="{ active: batchMode === true }" @click="batchMode = true">批量导入</button>
        </div>

        <!-- 单个新增表单 -->
        <div v-if="!batchMode" class="modal-body">
          <div class="form-item">
            <label class="form-label">账号<span class="req"> *</span></label>
            <input v-model="form.username" class="form-input" :disabled="formMode === 'edit'" placeholder="登录账号，必填" />
          </div>
          <div class="form-item">
            <label class="form-label">角色<span class="req"> *</span></label>
            <select v-model="form.role" class="form-input">
              <option value="">请选择（必填）</option>
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
          <div v-if="form.role === 'student'" class="form-item">
            <label class="form-label">指导导师</label>
            <select v-model="form.advisor_id" class="form-input">
              <option :value="null">请选择导师</option>
              <option v-for="m in mentors" :key="m.id" :value="m.id">{{ m.real_name || m.username }}</option>
            </select>
          </div>
          <p v-if="formError" class="form-error">{{ formError }}</p>
        </div>

        <!-- 批量导入 -->
        <div v-else class="modal-body">
          <div class="batch-tip">
            <div class="tip-title">填写说明</div>
            <div>1. 先下载模板，按模板格式填写（<span class="req">账号*</span>、<span class="req">角色*</span> 为必填项）；</div>
            <div>2. 角色填：管理员 / 导师 / 学生；性别填：男 / 女 / 其他；学位类型填：硕士 / 博士；</div>
            <div>3. 「指导导师账号」填导师的登录账号（不填则无导师）；</div>
            <div>4. 上传后系统会先校验必填项，再点「开始导入」。单次最多 500 行。</div>
          </div>
          <div class="batch-actions">
            <button class="btn" @click="downloadTemplate">⬇ 下载导入模板</button>
            <label class="btn btn-upload">
              选择 CSV 文件
              <input type="file" accept=".csv,.txt" class="hidden-file" @change="onFileChange" />
            </label>
            <span v-if="fileName" class="file-name">{{ fileName }}</span>
          </div>
          <div v-if="parsing" class="parsing-tip">正在解析文件，请稍候…</div>
          <div v-else-if="parsedRows.length" class="batch-preview">
            <div class="preview-head">
              共识别 <b>{{ parsedRows.length }}</b> 行，有效 <b class="ok-num">{{ validCount }}</b> 行，问题 <b class="bad-num">{{ errorRows.length }}</b> 行
            </div>
            <ul v-if="errorRows.length" class="preview-errors">
              <li v-for="r in errorRows" :key="r.__row">
                第 {{ r.__row }} 行（账号：{{ r.username || '（空）' }}）：{{ r.reason }}
              </li>
            </ul>
          </div>
          <p v-if="!parsing && parsedRows.length && !validCount" class="form-error">没有可导入的有效数据，请先修正上方标红的问题行</p>
          <p v-if="batchError" class="form-error">{{ batchError }}</p>
        </div>

        <div class="modal-foot">
          <button class="btn" @click="closeForm">取消</button>
          <template v-if="!batchMode">
            <button class="btn btn-primary" @click="submit" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button>
          </template>
          <template v-else>
            <button class="btn btn-primary" @click="submitBatch" :disabled="importing || !validCount">{{ importing ? '导入中…' : '开始导入' }}</button>
          </template>
        </div>
      </div>
    </div>

    <!-- 批量导入结果弹窗 -->
    <div v-if="batchResultVisible" class="modal-mask" @click.self="batchResultVisible = false">
      <div class="modal-box">
        <div class="modal-head">
          <h4>导入结果</h4>
          <button class="modal-close" @click="batchResultVisible = false">×</button>
        </div>
        <div class="modal-body">
          <div class="result-summary">
            <p class="result-main">{{ resultMessage }}</p>
            <p v-if="resultPasswords.student || resultPasswords.mentor || resultPasswords.admin" class="result-pwd">
              各角色默认密码（首次登录需修改）：
              学生 <b>{{ resultPasswords.student }}</b>
              / 导师 <b>{{ resultPasswords.mentor }}</b>
              / 管理员 <b>{{ resultPasswords.admin }}</b>
            </p>
          </div>
          <div v-if="resultFailed.length" class="result-failed">
            <div class="preview-head">失败明细（{{ resultFailed.length }} 条）</div>
            <table class="fail-table">
              <thead>
                <tr><th>行号</th><th>账号</th><th>原因</th></tr>
              </thead>
              <tbody>
                <tr v-for="(f, i) in resultFailed" :key="i">
                  <td>{{ f.row }}</td>
                  <td>{{ f.username || '-' }}</td>
                  <td>{{ f.reason }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-primary" @click="batchResultVisible = false">知道了</button>
        </div>
      </div>
    </div>

    <!-- 发消息弹窗 -->
    <div v-if="msgVisible" class="modal-mask" @click.self="msgVisible = false">
      <div class="modal-box">
        <div class="modal-head">
          <h4>发送消息给 {{ msgTarget?.real_name || msgTarget?.username }}</h4>
          <button class="modal-close" @click="msgVisible = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-item">
            <label class="form-label">标题<span class="req"> *</span></label>
            <input v-model="msgTitle" class="form-input" placeholder="如：请及时填写本周日志" />
          </div>
          <div class="form-item">
            <label class="form-label">内容</label>
            <textarea v-model="msgContent" class="form-input" rows="4" placeholder="消息正文（可选）"></textarea>
          </div>
          <p v-if="msgError" class="form-error">{{ msgError }}</p>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="msgVisible = false">取消</button>
          <button class="btn btn-primary" @click="submitMsg" :disabled="msgSending">{{ msgSending ? '发送中…' : '发送' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { listUsers, createUser, updateUser, deleteUser, listMembers, batchCreateUsers } from '../api'
import { system } from '../api'
import {
  ROLE_OPTIONS, GENDER_OPTIONS, DEGREE_TYPE_OPTIONS, ACCOUNT_STATUS_OPTIONS
} from '../config/fieldOptions'
import { ROLE_STUDENT, ACCOUNT_STATUS_ACTIVE } from '../config/constants'
import { dialogAlert, dialogConfirm } from '../composables/useDialog'
import { useRole } from '../composables/useRole'

const { isAdmin, isManager } = useRole()

const list = ref([])
const loading = ref(false)
const keyword = ref('')
const formVisible = ref(false)
const formMode = ref('create')
const form = ref({})
const formError = ref('')
const saving = ref(false)
const editingId = ref(null)
const mentors = ref([])

// 批量导入状态
const batchMode = ref(false)
const fileName = ref('')
const parsedRows = ref([])
const parsing = ref(false)
const batchError = ref('')
const importing = ref(false)
const batchResultVisible = ref(false)
const resultMessage = ref('')
const resultPasswords = ref({})
const resultFailed = ref([])

// 发消息弹窗状态
const msgVisible = ref(false)
const msgTarget = ref(null)
const msgTitle = ref('')
const msgContent = ref('')
const msgError = ref('')
const msgSending = ref(false)

// CSV 表头（列顺序固定，与下载模板一致）
const HEADERS = ['username', 'role', 'real_name', 'gender', 'student_no', 'email', 'phone', 'college', 'major', 'degree_type', 'advisor_username']
const HEADER_CN = ['账号*', '角色*', '姓名', '性别', '学号/工号', '邮箱', '手机号', '学院', '专业', '学位类型', '指导导师账号']
// 中文值 → 数据库值 映射
const ROLE_MAP = { 管理员: 'admin', 导师: 'mentor', 学生: 'student' }
const GENDER_MAP = { 男: 'male', 女: 'female', 其他: 'other' }
const DEGREE_MAP = { 硕士: 'master', 博士: 'doctor' }
// 单次导入上限（与后端一致）
const MAX_IMPORT_ROWS = 500
// 导师账号集合（校验加速，避免逐行遍历）
const mentorNameSet = computed(() => new Set(mentors.value.filter((m) => m.role === 'mentor').map((m) => m.username)))

const validCount = computed(() => parsedRows.value.filter((r) => r.ok).length)
const errorRows = computed(() => parsedRows.value.filter((r) => !r.ok))

function roleLabel(v) {
  const o = ROLE_OPTIONS.find((x) => x.value === v)
  return o ? o.label : (v || '-')
}
function mentorName(id) {
  if (!id) return '-'
  const m = mentors.value.find((x) => x.id === id)
  return m ? (m.real_name || m.username) : id
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
  batchMode.value = false
  form.value = { role: ROLE_STUDENT, status: ACCOUNT_STATUS_ACTIVE }
  formError.value = ''
  parsedRows.value = []
  fileName.value = ''
  parsing.value = false
  batchError.value = ''
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
    advisor_id: row.advisor_id || null,
    status: row.status || ACCOUNT_STATUS_ACTIVE
  }
  formError.value = ''
  formVisible.value = true
}

function closeForm() {
  if (saving.value || importing.value) return
  formVisible.value = false
}

// 提交前把空字符串统一转 null（未填写视为不设置），避免 ENUM 列（gender/degree_type）收到 '' 报错。
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
        await dialogAlert(`创建成功！初始密码：${res.plainPassword}（${roleLabel(form.value.role)}默认密码），首次登录需修改密码`)
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

// ===== 批量导入 =====

// 下载 CSV 模板（UTF-8 BOM，Excel 打开中文不乱码；含表头 + 一行示例）
function downloadTemplate() {
  const sample = ['zhangsan', '学生', '张三', '男', '2026001', 'zhangsan@example.com', '13800000000', '信息学院', '计算机技术', '硕士', 'teacher01']
  const lines = [HEADER_CN.join(','), sample.join(',')]
  const csv = '\uFEFF' + lines.join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '成员导入模板.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// 解析 CSV 文本为对象数组（处理 BOM / CRLF / 引号包裹逗号）
function parseCSV(text) {
  const content = text.replace(/^\uFEFF/, '')
  const lines = content.split(/\r\n|\n/)
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cells = parseCSVLine(line)
    if (cells.every((c) => !String(c || '').trim())) continue
    const obj = { __row: i + 1 }
    HEADERS.forEach((h, idx) => { obj[h] = String(cells[idx] || '').trim() })
    rows.push(obj)
    if (rows.length >= MAX_IMPORT_ROWS) break // 超上限直接截断，避免大文件卡死
  }
  return rows
}

// 解析一行 CSV（支持 "a,b" 引号包裹）
function parseCSVLine(line) {
  const cells = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else { inQ = false }
      } else { cur += ch }
    } else if (ch === '"') {
      inQ = true
    } else if (ch === ',') {
      cells.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  cells.push(cur)
  return cells
}

// 逐行校验必填与取值合法性（前端提示，后端仍会二次校验）
function validateRows(rows) {
  const names = mentorNameSet.value
  return rows.map((r) => {
    let reason = ''
    if (!r.username) reason = '账号不能为空（必填）'
    else if (!r.role) reason = '角色不能为空（必填）'
    else if (!ROLE_MAP[r.role]) reason = '角色不合法（应为：管理员/导师/学生）'
    else if (r.gender && !GENDER_MAP[r.gender]) reason = '性别不合法（应为：男/女/其他）'
    else if (r.degree_type && !DEGREE_MAP[r.degree_type]) reason = '学位类型不合法（应为：硕士/博士）'
    else if (r.advisor_username && !names.has(r.advisor_username)) reason = '指导导师账号不存在'
    return { ...r, ok: !reason, reason }
  })
}

function onFileChange(e) {
  const file = e.target.files && e.target.files[0]
  if (!file) return
  // 只接受 CSV / 文本文件；误传 Excel(xlsx/xls) 会按文本硬解析导致卡死
  const lower = (file.name || '').toLowerCase()
  if (!/\.(csv|txt)$/.test(lower)) {
    batchError.value = '请选择 .csv 文件（Excel 请先「另存为 CSV」再上传）'
    parsedRows.value = []
    fileName.value = ''
    e.target.value = ''
    return
  }
  // 限制文件大小（5MB 内），防止超大文件阻塞界面
  if (file.size > 5 * 1024 * 1024) {
    batchError.value = '文件过大（超过 5MB），请拆分后分批导入'
    parsedRows.value = []
    fileName.value = ''
    e.target.value = ''
    return
  }
  fileName.value = file.name
  batchError.value = ''
  parsedRows.value = []
  parsing.value = true
  const reader = new FileReader()
  reader.onload = (ev) => {
    const text = String(ev.target.result || '')
    // 放入 setTimeout，让「正在解析」提示先渲染，解析本身不阻塞太久
    setTimeout(() => {
      const rows = parseCSV(text)
      parsedRows.value = validateRows(rows)
      parsing.value = false
      if (!parsedRows.value.length) {
        batchError.value = '文件为空或格式不正确，请下载模板后填写'
      } else if (rows.length >= MAX_IMPORT_ROWS) {
        batchError.value = `最多导入 ${MAX_IMPORT_ROWS} 行，已截断，请分批导入`
      }
    }, 30)
  }
  reader.onerror = () => {
    parsing.value = false
    batchError.value = '文件读取失败，请重试'
  }
  reader.readAsText(file)
  e.target.value = '' // 允许重复选择同一文件
}

async function submitBatch() {
  batchError.value = ''
  const valid = parsedRows.value.filter((r) => r.ok)
  if (!valid.length) {
    batchError.value = '没有可导入的有效数据，请先修正必填项'
    return
  }
  importing.value = true
  try {
    const payload = valid.map((r) => {
      const mentor = r.advisor_username ? mentors.value.find((m) => m.username === r.advisor_username) : null
      return {
        __row: r.__row,
        username: r.username,
        role: ROLE_MAP[r.role],
        real_name: r.real_name || '',
        gender: GENDER_MAP[r.gender] || '',
        student_no: r.student_no || '',
        email: r.email || '',
        phone: r.phone || '',
        college: r.college || '',
        major: r.major || '',
        degree_type: DEGREE_MAP[r.degree_type] || '',
        advisor_id: mentor ? mentor.id : null
      }
    })
    const res = await batchCreateUsers(payload)
    if (res && res.success) {
      resultMessage.value = res.message || '导入完成'
      resultPasswords.value = res.plainPasswords || {}
      resultFailed.value = res.failedRows || []
      batchResultVisible.value = true
      formVisible.value = false
      await load()
    } else {
      batchError.value = (res && res.message) || '批量导入失败'
    }
  } catch (e) {
    console.error('[batchImport] 异常:', e)
    batchError.value = '批量导入过程出现异常，请重试'
  } finally {
    importing.value = false
  }
}

async function resetPassword(row) {
  const ok = await dialogConfirm(`确定重置「${row.username}」的密码吗？`, '重置密码')
  if (!ok) return
  try {
    const res = await updateUser({ id: row.id, resetPassword: true })
    if (res && res.success && res.plainPassword) {
      await dialogAlert(`已重置为 ${res.plainPassword}（${roleLabel(row.role)}默认密码），该账号下次登录需先修改密码`)
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

function openSendMsg(row) {
  msgTarget.value = row
  msgTitle.value = ''
  msgContent.value = ''
  msgError.value = ''
  msgVisible.value = true
}

async function submitMsg() {
  msgError.value = ''
  const target = msgTarget.value
  if (!target) return
  if (!msgTitle.value || !String(msgTitle.value).trim()) {
    msgError.value = '请填写标题'
    return
  }
  msgSending.value = true
  try {
    const res = await system.sendMessage({
      receiver_id: target.id,
      title: String(msgTitle.value).trim(),
      content: String(msgContent.value || ''),
      type: 'manual'
    })
    if (res && res.success) {
      msgVisible.value = false
      await dialogAlert(`已发送给 ${target.real_name || target.username}`)
    } else {
      msgError.value = (res && res.message) || '发送失败'
    }
  } catch (e) {
    console.error('[sendMessage] 异常:', e)
    msgError.value = '发送过程出现异常，请重试'
  } finally {
    msgSending.value = false
  }
}

onMounted(() => {
  load()
  listMembers().then((res) => {
    if (res && res.success && Array.isArray(res.members)) {
      mentors.value = res.members.filter((m) => m.role === 'mentor')
    }
  }).catch(() => {})
})
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
.btn-upload {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}
.hidden-file {
  display: none;
}
.file-name {
  font-size: 13px;
  color: #8a9099;
}
.table-wrap {
  overflow-x: auto;
}
.data-table {
  width: 100%;
  table-layout: fixed;
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
  width: 150px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 6px;
}
.col-ops .btn-link {
  padding: 2px 6px;
  text-align: left;
}
.col-no {
  width: 110px;
}
.col-college {
  width: auto;
}
.data-table th:nth-child(1),
.data-table td:nth-child(1) {
  width: 100px;
}
.data-table th:nth-child(2),
.data-table td:nth-child(2) {
  width: 80px;
}
.data-table th:nth-child(3),
.data-table td:nth-child(3) {
  width: 60px;
}
.data-table th:nth-child(4),
.data-table td:nth-child(4) {
  width: 100px;
}
.data-table th:nth-child(5),
.data-table td:nth-child(5) {
  width: 90px;
}
.data-table th:nth-child(7),
.data-table td:nth-child(7) {
  width: 60px;
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
.modal-tabs {
  display: flex;
  gap: 8px;
  padding: 12px 20px 0;
}
.tab-btn {
  padding: 6px 18px;
  font-size: 13px;
  border: 1px solid #dfe3e8;
  border-radius: 8px 8px 0 0;
  background: #f7f8fa;
  color: #4e5969;
  cursor: pointer;
}
.tab-btn.active {
  background: #fff;
  color: #0d80e0;
  border-color: #0d80e0;
  border-bottom-color: #fff;
  font-weight: 600;
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
.batch-tip {
  background: #f7f8fa;
  border: 1px solid #eceff3;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 12px;
  font-size: 12px;
  line-height: 1.8;
  color: #4e5969;
}
.tip-title {
  font-weight: 600;
  color: #1f2329;
  margin-bottom: 2px;
}
.batch-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.parsing-tip {
  color: #0d80e0;
  font-size: 13px;
  padding: 8px 0;
}
.batch-preview {
  border: 1px solid #eceff3;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
}
.preview-head {
  color: #1f2329;
}
.ok-num {
  color: #19a558;
}
.bad-num {
  color: #ea4335;
}
.preview-errors {
  margin: 8px 0 0;
  padding-left: 18px;
  max-height: 120px;
  overflow-y: auto;
  font-size: 12px;
  color: #ea4335;
}
.result-summary {
  margin-bottom: 12px;
}
.result-main {
  font-size: 15px;
  font-weight: 600;
  color: #1f2329;
  margin: 0 0 6px;
}
.result-pwd {
  font-size: 13px;
  color: #4e5969;
  background: #f7f8fa;
  border-radius: 8px;
  padding: 8px 12px;
}
.result-pwd b {
  color: #0d80e0;
}
.result-failed {
  border: 1px solid #f3d8d5;
  border-radius: 8px;
  padding: 10px 12px;
}
.fail-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  margin-top: 6px;
}
.fail-table th,
.fail-table td {
  border-bottom: 1px solid #eceff3;
  padding: 6px 8px;
  text-align: left;
}
.fail-table th {
  color: #4e5969;
  font-weight: 600;
}
</style>
