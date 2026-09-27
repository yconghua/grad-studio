<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">🔧 系统配置</h2>
      </div>
    </div>

    <!-- 系统信息 -->
    <div class="card">
      <div class="card-head">
        <h3 class="card-title">🖥️ 系统信息</h3>
        <button class="btn btn-primary" @click="onOpenConsole">打开控制台</button>
      </div>
      <div v-if="sysLoading" class="state">加载中…</div>
      <div v-else class="info-grid">
        <div class="info-item"><span class="info-label">系统名称</span><span class="info-value">{{ sysInfo.name || '—' }}</span></div>
        <div class="info-item"><span class="info-label">版本</span><span class="info-value">{{ sysInfo.version ? 'v' + sysInfo.version : '—' }}</span></div>
        <div class="info-item"><span class="info-label">发布日期</span><span class="info-value">{{ sysInfo.releaseDate || '—' }}</span></div>
        <div class="info-item"><span class="info-label">启动时间</span><span class="info-value">{{ formatTime(sysInfo.startedAt) }}</span></div>
        <div class="info-item"><span class="info-label">操作系统</span><span class="info-value">{{ sysInfo.platform || '—' }}</span></div>
        <div class="info-item"><span class="info-label">Node 版本</span><span class="info-value">{{ sysInfo.nodeVersion || '—' }}</span></div>
        <div class="info-item"><span class="info-label">Electron 版本</span><span class="info-value">{{ sysInfo.electronVersion || '—' }}</span></div>
        <div class="info-item"><span class="info-label">用户数据目录</span><span class="info-value path">{{ userDataPath || '—' }}</span></div>
        <div class="info-item"><span class="info-label">程序目录</span><span class="info-value path">{{ appPath || '—' }}</span></div>
      </div>
    </div>

    <!-- 数据库连接配置 -->
    <div class="card">
      <div class="card-head">
        <h3 class="card-title">🗄️ 数据库连接配置</h3>
        <span class="badge" :class="dbInfo.status === 'connected' ? 'badge-ok' : 'badge-err'">{{ dbInfo.status === 'connected' ? '已连接' : '未连接' }}</span>
      </div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">主机</span><span class="info-value">{{ dbInfo.host || '—' }}</span></div>
        <div class="info-item"><span class="info-label">端口</span><span class="info-value">{{ dbInfo.port || '—' }}</span></div>
        <div class="info-item"><span class="info-label">数据库</span><span class="info-value">{{ dbInfo.database || '—' }}</span></div>
        <div class="info-item"><span class="info-label">用户名</span><span class="info-value">{{ dbInfo.user || '—' }}</span></div>
      </div>
      <p v-if="dbInfo.error" class="db-error">⚠️ {{ dbInfo.error }}</p>
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-head-left">
          <h3 class="card-title">⚙️ 系统参数</h3>
          <p class="card-desc">维护全局系统参数（键值对，仅超级管理员可见）</p>
        </div>
        <button class="btn btn-primary" @click="openCreate">＋ 新增参数</button>
      </div>
      <div v-if="loading" class="state">加载中…</div>
      <div v-else-if="errorMsg" class="state error">⚠️ {{ errorMsg }}</div>
      <div v-else-if="!rows.length" class="state">🗂️ 暂无系统参数</div>
      <table v-else class="tbl">
        <thead>
          <tr><th>ID</th><th>参数键</th><th>参数值</th><th>说明</th><th>更新时间</th><th>操作</th></tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td>{{ r.id }}</td>
            <td class="mono">{{ r.param_key }}</td>
            <td class="mono">{{ r.param_value }}</td>
            <td>{{ r.description || '—' }}</td>
            <td>{{ r.updated_at || r.created_at || '—' }}</td>
            <td class="ops">
              <button class="link" @click="openEdit(r)">编辑</button>
              <button class="link danger" @click="askDelete(r)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 新增 / 编辑弹窗 -->
    <div v-if="showForm" class="modal-mask" @click.self="showForm = false">
      <div class="modal-box">
        <h3 class="modal-title">{{ editing ? '编辑参数' : '新增参数' }}</h3>
        <div class="form-item">
          <label>参数键 <span class="req">*</span></label>
          <input v-model="form.param_key" class="input" :disabled="!!editing" placeholder="如 app.title" />
        </div>
        <div class="form-item">
          <label>参数值</label>
          <textarea v-model="form.param_value" class="textarea" rows="3" placeholder="参数值"></textarea>
        </div>
        <div class="form-item">
          <label>说明</label>
          <input v-model="form.description" class="input" placeholder="参数用途说明（选填）" />
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
        <p class="modal-text">确定删除参数「{{ deleting.param_key }}」吗？</p>
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
import { ref, onMounted } from 'vue'
import { listSystemParams, saveSystemParam, removeSystemParam, getSysInfo, getDbInfo, getUserDataPath, getAppPath, openDevTools } from '../../../api'

const rows = ref([])
const loading = ref(false)
const errorMsg = ref('')

// 系统信息 / 数据库连接 / 路径
const sysInfo = ref({})
const dbInfo = ref({})
const userDataPath = ref('')
const appPath = ref('')
const sysLoading = ref(false)

function formatTime(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

async function loadSysInfo() {
  sysLoading.value = true
  try {
    const [info, db, udPath, apPath] = await Promise.all([getSysInfo(), getDbInfo(), getUserDataPath(), getAppPath()])
    if (info && info.success) sysInfo.value = info
    if (db && db.success) dbInfo.value = db
    if (udPath && udPath.success) userDataPath.value = udPath.path
    if (apPath && apPath.success) appPath.value = apPath.path
  } catch (e) {
    // 任一接口失败保持空值，不阻塞页面
  } finally {
    sysLoading.value = false
  }
}

async function onOpenConsole() {
  try {
    const res = await openDevTools()
    if (res && res.success) dialogAlert(res.message || '控制台已打开')
    else dialogAlert((res && res.message) || '打开失败')
  } catch (e) {
    dialogAlert('打开失败，请重试')
  }
}

async function loadList() {
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await listSystemParams()
    if (res && res.success) {
      rows.value = res.data || []
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

const showForm = ref(false)
const editing = ref(null)
const submitting = ref(false)
const formError = ref('')
const form = ref({ param_key: '', param_value: '', description: '' })

function openCreate() {
  editing.value = null
  form.value = { param_key: '', param_value: '', description: '' }
  formError.value = ''
  showForm.value = true
}
function openEdit(r) {
  editing.value = r
  form.value = { param_key: r.param_key, param_value: r.param_value || '', description: r.description || '' }
  formError.value = ''
  showForm.value = true
}

async function submitForm() {
  formError.value = ''
  if (!form.value.param_key.trim()) { formError.value = '参数键不能为空'; return }
  submitting.value = true
  try {
    const res = await saveSystemParam({
      param_key: form.value.param_key.trim(),
      param_value: form.value.param_value,
      description: form.value.description
    })
    if (res && res.success) {
      showForm.value = false
      await loadList()
    } else {
      formError.value = (res && res.message) || '保存失败'
    }
  } catch (e) {
    formError.value = '网络异常'
  } finally {
    submitting.value = false
  }
}

const deleting = ref(null)
function askDelete(r) { deleting.value = r }
async function confirmDelete() {
  try {
    const res = await removeSystemParam(deleting.value.id)
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

onMounted(() => {
  loadList()
  loadSysInfo()
})
</script>

<style scoped>
.page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; justify-content: space-between; align-items: flex-start; }
.page-title { margin: 0; font-size: 18px; color: #1f2329; }
.page-desc { margin: 4px 0 0; font-size: 13px; color: #8a9099; }
.head-actions { display: flex; gap: 10px; }
.card { background: #fff; border: 1px solid #eceff3; border-radius: 12px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04); padding: 16px; }
.input { height: 34px; padding: 0 10px; font-size: 13px; border: 1px solid #dfe3e8; border-radius: 8px; outline: none; background: #fff; color: #1f2329; }
.input:focus { border-color: #0d80e0; }
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
.mono { font-family: Consolas, Monaco, monospace; }
.ops { display: flex; gap: 12px; }
.link { background: none; border: none; color: #0d80e0; cursor: pointer; font-size: 13px; padding: 0; }
.link.danger { color: #ea4335; }
.modal-mask { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-box { width: 480px; background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18); }
.modal-title { margin: 0 0 16px; font-size: 16px; color: #1f2329; }
.modal-text { font-size: 14px; color: #1f2329; margin: 0 0 20px; line-height: 1.6; }
.modal-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 18px; }
.modal-actions .btn { flex: 0 0 auto; }
.card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.card-title { margin: 0; font-size: 15px; color: #1f2329; }
.card-desc { margin: 4px 0 0; font-size: 12px; color: #8a9099; }
.card-head-left { display: flex; flex-direction: column; gap: 2px; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
.info-item { display: flex; gap: 10px; font-size: 13px; line-height: 1.7; }
.info-label { color: #8a9099; flex: 0 0 auto; min-width: 96px; }
.info-value { color: #1f2329; word-break: break-all; }
.info-value.path { font-family: Consolas, Monaco, monospace; font-size: 12px; }
.badge { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 12px; }
.badge-ok { background: #e8f7ee; color: #19a558; }
.badge-err { background: #fdecec; color: #ea4335; }
.db-error { margin: 10px 0 0; color: #ea4335; font-size: 12px; }
.form-item { margin-bottom: 14px; }
.form-item label { display: block; font-size: 13px; color: #4e5969; margin-bottom: 6px; }
.req { color: #ea4335; }
.form-item .input { width: 100%; box-sizing: border-box; }
.form-error { color: #ea4335; font-size: 12px; margin: 6px 0 0; }
</style>
