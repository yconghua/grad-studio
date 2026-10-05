<template>
  <div v-if="visible" class="privacy-overlay">
    <div class="privacy-backdrop" @click="emit('close')"></div>
    <div class="privacy-dialog" role="dialog" aria-modal="true">
      <div class="privacy-head">
        <h3>添加新 MySQL 数据库</h3>
        <button type="button" class="privacy-close" @click="emit('close')" aria-label="关闭">×</button>
      </div>

      <!-- Tab 栏：手动输入 / 批量导入 -->
      <div class="tab-bar">
        <button type="button" class="tab-btn" :class="{ active: activeTab === 'manual' }" @click="activeTab = 'manual'">手动输入</button>
        <button type="button" class="tab-btn" :class="{ active: activeTab === 'import' }" @click="activeTab = 'import'">批量导入</button>
      </div>

      <!-- Tab 1：手动输入（原表单） -->
      <div v-if="activeTab === 'manual'" class="privacy-body">
        <p class="privacy-lead">填写目标 MySQL 连接信息，提交后将自动测试连通性并保存。</p>
        <div class="form-row">
          <label class="field-label">名称 <span class="req">*</span></label>
          <input v-model="addForm.name" class="field-input" type="text" placeholder="如：公司服务器" />
        </div>
        <div class="form-row">
          <label class="field-label">主机 <span class="req">*</span></label>
          <input v-model="addForm.host" class="field-input" type="text" placeholder="如：rm-xxx.rds.aliyuncs.com 或 localhost" />
        </div>
        <div class="form-row">
          <label class="field-label">端口</label>
          <input v-model="addForm.port" class="field-input" type="text" placeholder="3306" />
        </div>
        <div class="form-row">
          <label class="field-label">账号 <span class="req">*</span></label>
          <input v-model="addForm.user" class="field-input" type="text" placeholder="数据库账号" />
        </div>
        <div class="form-row">
          <label class="field-label">密码</label>
          <input v-model="addForm.password" class="field-input" type="password" placeholder="可为空" />
        </div>
        <div class="form-row">
          <label class="field-label">数据库名 <span class="req">*</span></label>
          <input v-model="addForm.database" class="field-input" type="text" placeholder="如：gra_studio" />
        </div>
        <p v-if="addDbMsg" class="msg" :class="addDbOk ? 'ok' : 'err'">{{ addDbMsg }}</p>
      </div>

      <!-- Tab 2：批量导入（JSON Lines txt） -->
      <div v-else class="privacy-body">
        <p class="privacy-lead">导入 JSON Lines 格式的 txt 文件，一次添加多条连接；可先下载示例模板参考格式。</p>

        <div class="import-actions">
          <button type="button" class="save-btn ghost" :disabled="importing" @click="onDownloadTemplate">下载示例 TXT</button>
          <button type="button" class="save-btn" :disabled="importing" @click="triggerFilePick">选择 TXT 文件…</button>
          <input ref="fileInput" type="file" accept=".txt,text/plain" class="hidden-input" @change="onFilePicked" />
        </div>

        <p v-if="fileName" class="file-info">
          已选择：{{ fileName }}（有效 {{ validCount }} 条<template v-if="dupCount">，重复 {{ dupCount }} 条</template><template v-if="errorList.length">，错误 {{ errorList.length }} 行</template>）
        </p>

        <!-- 预览表格：仅展示有效 / 重复行，密码打码 -->
        <div v-if="validRows.length" class="preview-wrap">
          <table v-resizable-columns class="preview-table">
            <thead>
              <tr>
                <th>行</th><th>名称</th><th>主机</th><th>端口</th><th>账号</th><th>数据库</th><th>密码</th><th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in validRows" :key="row.line">
                <td>{{ row.line }}</td>
                <td>{{ row.name }}</td>
                <td>{{ row.host }}</td>
                <td>{{ row.port }}</td>
                <td>{{ row.user }}</td>
                <td>{{ row.database }}</td>
                <td>••••••</td>
                <td>
                  <span class="tag" :class="row.status === 'dup' ? 'tag-dup' : 'tag-ok'">{{ row.status === 'dup' ? '重复' : '正常' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 解析失败的行 -->
        <div v-if="errorList.length" class="err-list">
          <div v-for="e in errorList" :key="'e' + e.line" class="err-line">第 {{ e.line }} 行：{{ e.error }}</div>
        </div>

        <p v-if="importMsg" class="msg" :class="importOk ? 'ok' : 'err'">{{ importMsg }}</p>
        <!-- 导入结果中的失败明细 -->
        <div v-if="importResult && importResult.failed && importResult.failed.length" class="err-list">
          <div v-for="(f, i) in importResult.failed" :key="'f' + i" class="err-line">「{{ f.name }}」：{{ f.reason }}</div>
        </div>
      </div>

      <div class="modal-foot">
        <button type="button" class="save-btn ghost" @click="emit('close')">取消</button>
        <button
          v-if="activeTab === 'manual'"
          type="button"
          class="save-btn"
          :disabled="addDbLoading"
          @click="onSubmitAddDb"
        >{{ addDbLoading ? '测试中…' : '添加' }}</button>
        <button
          v-else
          type="button"
          class="save-btn"
          :disabled="importing || validCount === 0"
          @click="onSubmitImport"
        >{{ importing ? '导入中…' : '开始导入' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { addDb, importDb, exportDbTemplate } from '../../api'

// 添加数据库弹窗（从登录页抽离）：
// - Tab 1「手动输入」：原单条表单，提交走 addDb
// - Tab 2「批量导入」：JSON Lines txt，解析预览后走 importDb；导入成功 emit('added') 刷新切换弹窗
const props = defineProps({
  visible: { type: Boolean, default: false }
})
const emit = defineEmits(['close', 'added'])

// ---- Tab 1：手动输入 ----
const addForm = ref({ name: '', host: '', port: '3306', user: '', password: '', database: '' })
const addDbMsg = ref('')
const addDbOk = ref(false)
const addDbLoading = ref(false)

async function onSubmitAddDb() {
  addDbMsg.value = ''
  const f = addForm.value
  if (!f.name.trim() || !f.host.trim() || !f.user.trim() || !f.database.trim()) {
    addDbMsg.value = '请填写名称、主机、账号与数据库名'
    addDbOk.value = false
    return
  }
  addDbLoading.value = true
  try {
    const res = await addDb({
      name: f.name.trim(),
      host: f.host.trim(),
      port: f.port ? Number(f.port) : 3306,
      user: f.user.trim(),
      password: f.password,
      database: f.database.trim()
    })
    if (res && res.success) {
      addDbOk.value = true
      addDbMsg.value = res.message || '添加成功'
      emit('added')
      emit('close')
    } else {
      addDbOk.value = false
      addDbMsg.value = (res && res.message) || '添加失败'
    }
  } catch (e) {
    addDbOk.value = false
    addDbMsg.value = '添加过程出现异常，请重试'
  } finally {
    addDbLoading.value = false
  }
}

// ---- Tab 切换 ----
const activeTab = ref('manual')

// ---- Tab 2：批量导入 ----
const fileInput = ref(null)
const fileName = ref('')
const parsed = ref([])
const importing = ref(false)
const importMsg = ref('')
const importOk = ref(false)
const importResult = ref(null)

// 预览表只展示正常 / 重复行；错误行单独列出行号提示
const validRows = computed(() => parsed.value.filter((r) => r.status === 'ok' || r.status === 'dup'))
const validCount = computed(() => parsed.value.filter((r) => r.status === 'ok').length)
const dupCount = computed(() => parsed.value.filter((r) => r.status === 'dup').length)
const errorList = computed(() => parsed.value.filter((r) => r.status === 'error'))

function triggerFilePick() {
  if (fileInput.value) fileInput.value.click()
}

// 读取编码：优先 UTF-8 严格解码，失败回退 GBK（Windows 记事本默认 ANSI）
function decodeBuffer(buf) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch (e) {
    try {
      return new TextDecoder('gbk').decode(buf)
    } catch (e2) {
      return ''
    }
  }
}

function onFilePicked(evt) {
  const file = evt.target.files && evt.target.files[0]
  evt.target.value = ''
  if (!file) return
  if (file.size > 1024 * 1024) {
    importMsg.value = '文件超过 1MB，请拆分后导入'
    importOk.value = false
    return
  }
  fileName.value = file.name
  importMsg.value = ''
  importResult.value = null
  const reader = new FileReader()
  reader.onload = () => {
    parsed.value = parseJsonLines(decodeBuffer(reader.result))
    if (parsed.value.length === 0) {
      importMsg.value = '文件中没有可解析的连接'
      importOk.value = false
    }
  }
  reader.onerror = () => {
    importMsg.value = '读取文件失败，请重试'
    importOk.value = false
  }
  reader.readAsArrayBuffer(file)
}

// 解析 JSON Lines：跳过空行与 # 注释行；文件内按 host:port:user:database 标记重复
function parseJsonLines(text) {
  if (!text) return []
  const lines = text.split(/\r?\n/)
  const list = []
  const seen = new Set()
  let lineNo = 0
  for (const raw of lines) {
    lineNo++
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    let obj
    try {
      obj = JSON.parse(line)
    } catch (e) {
      list.push({ line: lineNo, status: 'error', error: 'JSON 解析失败' })
      continue
    }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      list.push({ line: lineNo, status: 'error', error: '不是 JSON 对象' })
      continue
    }
    const name = obj.name != null ? String(obj.name).trim() : ''
    const host = obj.host != null ? String(obj.host).trim() : ''
    const user = obj.user != null ? String(obj.user).trim() : ''
    const database = obj.database != null ? String(obj.database).trim() : ''
    const port = obj.port != null && obj.port !== '' ? Number(obj.port) : 3306
    const password = obj.password != null ? String(obj.password) : ''
    if (!name || !host || !user || !database) {
      list.push({ line: lineNo, name: name || '(未命名)', status: 'error', error: '缺少必填字段（name/host/user/database）' })
      continue
    }
    if (!/^[A-Za-z0-9_]+$/.test(database)) {
      list.push({ line: lineNo, name, status: 'error', error: '数据库名仅支持字母、数字、下划线' })
      continue
    }
    if (Number.isNaN(port)) {
      list.push({ line: lineNo, name, status: 'error', error: '端口不是有效数字' })
      continue
    }
    const key = host + ':' + port + ':' + user + ':' + database
    const status = seen.has(key) ? 'dup' : 'ok'
    seen.add(key)
    list.push({ line: lineNo, name, host, port, user, database, password, status })
  }
  return list
}

// 提交导入：仅提交有效行，失败明细由后端逐条返回
async function onSubmitImport() {
  if (importing.value || validCount.value === 0) return
  importing.value = true
  importMsg.value = ''
  importResult.value = null
  try {
    const payload = parsed.value
      .filter((r) => r.status === 'ok')
      .map((r) => ({ name: r.name, host: r.host, port: r.port, user: r.user, password: r.password, database: r.database }))
    const res = await importDb(payload)
    importResult.value = res || null
    if (res && res.success) {
      importOk.value = true
      let msg = res.message || '导入完成'
      if (res.skipped) msg += '，跳过重复 ' + res.skipped + ' 条'
      if (res.failed && res.failed.length) msg += '，失败 ' + res.failed.length + ' 条'
      importMsg.value = msg
      emit('added')
      // 导入成功后清空预览，避免同批重复提交
      parsed.value = []
      fileName.value = ''
    } else {
      importOk.value = false
      importMsg.value = (res && res.message) || '导入失败'
    }
  } catch (e) {
    importOk.value = false
    importMsg.value = '导入过程出现异常，请重试'
  } finally {
    importing.value = false
  }
}

// 下载示例 TXT：主进程弹保存对话框写入模板
async function onDownloadTemplate() {
  importMsg.value = ''
  importResult.value = null
  try {
    const res = await exportDbTemplate()
    if (res && res.success) {
      importOk.value = true
      importMsg.value = res.message || '示例 TXT 已保存'
    } else if (res && res.canceled) {
      importMsg.value = ''
    } else {
      importOk.value = false
      importMsg.value = (res && res.message) || '保存示例失败'
    }
  } catch (e) {
    importOk.value = false
    importMsg.value = '下载示例过程出现异常，请重试'
  }
}

// 打开时重置两个 Tab 的状态
watch(
  () => props.visible,
  (v) => {
    if (v) {
      activeTab.value = 'manual'
      addForm.value = { name: '', host: '', port: '3306', user: '', password: '', database: '' }
      addDbMsg.value = ''
      addDbOk.value = false
      fileName.value = ''
      parsed.value = []
      importing.value = false
      importMsg.value = ''
      importOk.value = false
      importResult.value = null
    }
  }
)
</script>

<style scoped>
.privacy-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.privacy-backdrop {
  position: absolute;
  inset: 0;
  background: var(--mask);
}
.privacy-dialog {
  position: relative;
  z-index: 1;
  width: 620px;
  max-width: 92vw;
  max-height: 80vh;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
}
.privacy-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid var(--border-light);
}
.privacy-head h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
}
.privacy-close {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--gray-soft);
  color: var(--text-2);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.2s;
}
.privacy-close:hover {
  background: var(--border);
}

/* Tab 栏 */
.tab-bar {
  display: flex;
  padding: 0 22px;
  border-bottom: 1px solid var(--border-light);
}
.tab-btn {
  padding: 12px 18px;
  border: none;
  background: none;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-2);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 0.2s;
}
.tab-btn.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

.privacy-body {
  padding: 18px 22px;
  overflow-y: auto;
}
.privacy-lead {
  font-size: 13px;
  line-height: 1.8;
  color: var(--text-2);
  margin: 0 0 8px;
}

/* 表单 */
.form-row {
  margin-bottom: 14px;
}
.field-label {
  display: block;
  font-size: 13px;
  color: var(--text-2);
  margin-bottom: 6px;
}
.req { color: var(--danger); }
.field-input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  font-size: 14px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
  background: var(--bg-card);
}
.field-input:focus {
  border-color: var(--primary);
}

/* 导入区 */
.import-actions {
  display: flex;
  gap: 10px;
  margin: 6px 0 4px;
}
.hidden-input {
  display: none;
}
.file-info {
  font-size: 12px;
  color: var(--text-2);
  margin: 10px 0 8px;
}
.preview-wrap {
  max-height: 200px;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  margin-bottom: 10px;
}
.preview-table {
  width: fit-content;
  max-width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.preview-table th,
.preview-table td {
  padding: 7px 8px;
  text-align: left;
  border-bottom: 1px solid var(--border-light);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.preview-table th {
  position: sticky;
  top: 0;
  background: var(--gray-soft);
  color: var(--text-2);
  font-weight: 600;
  z-index: 1;
}
.tag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: var(--radius-full);
  font-size: 11px;
}
.tag-ok {
  color: var(--success);
  background: var(--success-soft);
}
.tag-dup {
  color: var(--warning);
  background: var(--warning-soft);
}
.err-list {
  margin: 0 0 10px;
  padding: 8px 12px;
  background: var(--danger-soft);
  border: 1px solid var(--danger-border);
  border-radius: var(--radius-md);
  max-height: 120px;
  overflow-y: auto;
}
.err-line {
  font-size: 12px;
  color: var(--danger);
  line-height: 1.8;
}

/* 通用消息 + 弹窗底部按钮 */
.msg {
  font-size: 13px;
  margin: 0 0 12px;
}
.msg.ok {
  color: var(--success);
}
.msg.err {
  color: var(--danger);
}
.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin: 18px 18px 10px 0;
}
.save-btn {
  height: 38px;
  padding: 0 22px;
  border: none;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
  color: var(--on-accent);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}
.save-btn:hover {
  opacity: 0.92;
}
.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.save-btn.ghost {
  background: var(--bg-card);
  color: var(--primary);
  border: 1px solid var(--primary);
}
</style>
