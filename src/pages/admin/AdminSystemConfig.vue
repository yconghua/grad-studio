<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">系统配置</h2>
        <p class="page-sub">系统信息、数据库信息与系统参数（超级管理员权限）</p>
      </div>
    </div>

    <!-- 块 1：系统信息 -->
    <div class="panel">
      <p class="panel-title">系统信息</p>
      <div class="desc-list">
        <div class="row"><span class="k">系统名称</span><span class="v">{{ info.name }}</span></div>
        <div class="row"><span class="k">程序名称</span><span class="v">{{ info.programName || '-' }}</span></div>
        <div class="row"><span class="k">版本号</span><span class="v">v{{ info.version }}</span></div>
        <div class="row"><span class="k">运行环境</span><span class="v">{{ info.environment }}</span></div>
        <div class="row"><span class="k">服务器时间</span><span class="v">{{ info.serverTime }}</span></div>
        <div class="row"><span class="k">启动时间</span><span class="v">{{ info.startedAt }}</span></div>
        <div class="row"><span class="k">操作系统</span><span class="v">{{ info.platform }}</span></div>
        <div class="row"><span class="k">运行环境版本</span><span class="v">Node {{ info.nodeVersion }} · Electron {{ info.electronVersion }}</span></div>
      </div>
    </div>

    <!-- 块 2：数据库信息 -->
    <div class="panel">
      <div style="display: flex; align-items: center; justify-content: space-between">
        <p class="panel-title" style="margin: 0">数据库信息</p>
        <button class="btn btn-sm" :disabled="dbExporting" @click="doExportDb">{{ dbExporting ? '导出中…' : '导出数据库备份' }}</button>
      </div>
      <div class="desc-list" style="margin-top: 12px">
        <div class="row"><span class="k">数据库类型</span><span class="v">{{ db.type }}</span></div>
        <div class="row"><span class="k">连接状态</span><span class="v">
          <span :class="db.connected ? 'tag tag-green' : 'tag tag-red'">{{ db.connected ? '已连接' : '未连接' }}</span>
          <span v-if="!db.connected && db.error" style="margin-left: 8px; color: var(--danger)">{{ db.error }}</span>
        </span></div>
        <div class="row"><span class="k">数据库</span><span class="v">{{ db.database || '-' }}</span></div>
        <div class="row"><span class="k">主机</span><span class="v">{{ db.host || '-' }}</span></div>
        <div class="row"><span class="k">数据库版本</span><span class="v">{{ db.version || '-' }}</span></div>
        <div class="row"><span class="k">表数量</span><span class="v">{{ db.tableCount }}</span></div>
        <div class="row"><span class="k">当前连接数</span><span class="v">{{ db.activeConnections }}</span></div>
      </div>
    </div>

    <!-- 块 3：程序操作 -->
    <div class="panel">
      <p class="panel-title">程序操作</p>
      <div class="toolbar" style="margin-top: 8px">
        <button class="btn" @click="doOpenDevConsole">打开控制台</button>
        <button class="btn" @click="doOpenAppFolder">打开程序所在文件夹目录</button>
        <button class="btn" @click="doOpenDataFolder">打开数据文件夹目录</button>
        <button class="btn" @click="doClearCache">清除缓存</button>
      </div>
      <p class="hint" style="margin-top: 10px">控制台为渲染层开发者工具；数据文件夹存放应用配置与上传附件等</p>
    </div>

    <!-- 块 4：外观（默认主题 + 全局默认字号） -->
    <div class="panel">
      <div style="display: flex; align-items: center; justify-content: space-between">
        <p class="panel-title" style="margin: 0">外观（默认主题）</p>
        <button class="btn btn-primary btn-sm" :disabled="themeSaving" @click="saveDefaultTheme">{{ themeSaving ? '保存中…' : '保存' }}</button>
      </div>
      <div class="field" style="margin-top: 12px; margin-bottom: 0">
        <label>新用户 / 无本地主题偏好的用户首次登录使用的主题</label>
        <select v-model="defaultTheme" class="select" style="max-width: 220px">
          <option value="light">亮色</option>
          <option value="dark">暗色</option>
          <option value="system">跟随系统</option>
        </select>
        <p class="hint">个人可在侧边栏底部主题切换器覆盖自己的偏好；本配置只作为首次登录兜底</p>
      </div>
    </div>

    <!-- 块 5：全局默认字号 -->
    <FontScalePanel mode="global" />

    <!-- 块 5：系统参数 -->
    <div class="panel">
      <div style="display: flex; align-items: center; justify-content: space-between">
        <p class="panel-title" style="margin: 0">系统参数</p>
        <button class="btn btn-primary btn-sm" @click="openCreate">新增系统参数</button>
      </div>

      <div class="toolbar" style="margin-top: 12px">
        <input v-model="keyword" class="input" style="width: 220px" placeholder="参数键 / 描述" @keyup.enter="search" />
        <button class="btn btn-primary" @click="search">查询</button>
        <button class="btn" @click="reset">重置</button>
      </div>

      <div class="tbl-wrap">
        <table v-resizable-columns v-sortable-columns="{ field: sortField, order: sortOrder, onSort }" class="tbl">
          <thead>
            <tr>
              <th data-sort="id">ID</th>
              <th data-sort="configKey">参数键</th>
              <th data-sort="configValue" style="width: 120px">参数值</th>
              <th data-sort="configType">类型</th>
              <th data-sort="description">描述</th>
              <th style="width: 130px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in params" :key="p.id" @click="openDetail(p, paramDetailFields, '系统参数详情')">
              <td>{{ p.id }}</td>
              <td class="ellipsis" style="font-family: var(--font-mono)">{{ p.configKey }}</td>
              <td class="ellipsis" style="max-width: 120px">{{ p.configValue || '-' }}</td>
              <td><span class="tag tag-blue">{{ p.configType }}</span></td>
              <td class="ellipsis">{{ p.description || '-' }}</td>
              <td>
                <div class="ops" @click.stop>
                  <button class="btn btn-sm" @click="openEdit(p)">编辑</button>
                  <button class="btn btn-sm btn-danger" @click="doDelete(p)">删除</button>
                </div>
              </td>
            </tr>
            <tr v-if="params.length === 0">
              <td colspan="6"><div class="empty">暂无系统参数</div></td>
            </tr>
          </tbody>
        </table>
        <div class="pager">
          <button class="btn btn-sm" :disabled="page <= 1" @click="page--; loadParams()">上一页</button>
          <span>第 {{ page }} / {{ totalPages || 1 }} 页</span>
          <button class="btn btn-sm" :disabled="page >= totalPages" @click="page++; loadParams()">下一页</button>
          <span>共 {{ total }} 条</span>
        </div>
      </div>
    </div>

    <!-- 块 6：日志与诊断 -->
    <div class="panel">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px">
        <p class="panel-title" style="margin: 0">日志与诊断</p>
        <div class="toolbar" style="margin: 0">
          <select v-model="logLevel" class="select" style="width: 120px" @change="loadLogs">
            <option value="all">全部日志</option>
            <option value="error">仅错误</option>
            <option value="warn">错误+警告</option>
          </select>
          <button class="btn btn-sm" @click="loadDiag">刷新</button>
        </div>
      </div>
      <div class="desc-list" style="margin-top: 12px">
        <div class="row"><span class="k">运行时长</span><span class="v">{{ diag.uptimeText || '-' }}</span></div>
        <div class="row"><span class="k">主进程内存</span><span class="v">{{ diag.memoryText || '-' }}</span></div>
        <div class="row"><span class="k">日志文件</span><span class="v">{{ diag.logFileText || '-' }}</span></div>
      </div>
      <div class="log-box">
        <div v-for="l in logLines" :key="l.idx" class="log-line" :class="{ 'log-err': l.level === 'ERROR' }">
          <span class="log-no">{{ l.idx }}</span>
          <span class="log-text">{{ l.text }}</span>
        </div>
        <div v-if="logLines.length === 0" class="empty">暂无日志</div>
      </div>
      <div class="toolbar" style="margin-top: 10px">
        <button class="btn btn-sm" @click="doExportLog">导出日志</button>
        <button class="btn btn-sm" @click="doOpenLogFolder">打开日志目录</button>
      </div>
      <p class="hint" style="margin-top: 8px">日志记录主进程运行信息（含 SQL 与连接参数），请勿外传；超过 5MB 自动轮转保留最近 3 份</p>
    </div>

    <!-- 新增 / 编辑系统参数弹窗 -->
    <AdminConfigFormDialog
      v-model:visible="showModal"
      :is-edit="isEdit"
      :edit-id="editId"
      :initial="form"
      @saved="onParamSaved"
    />
  </div>

  <!-- 系统参数行详情弹窗 -->
  <RowDetailDialog v-model:visible="detailVisible" :title="detailTitle" :row="detailRow" :fields="detailFields" />
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import RowDetailDialog from '../../components/common/RowDetailDialog.vue'
import AdminConfigFormDialog from '../../components/admin/AdminConfigFormDialog.vue'
import FontScalePanel from '../../components/common/FontScalePanel.vue'
import { getSystemInfo, getDatabaseInfo, listParams, createParam, updateParam, deleteParam, exportDb, openDevConsole, openAppFolder, openDataFolder, clearCache, getDiagInfo, getDiagLogs, exportDiagLog, openDiagFolder } from '../../api'
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'
import { refreshAfterWrite } from '../../composables/useGlobalRefresh'
import { useAutoRefresh } from '../../composables/useAutoRefresh'
import { useAppName } from '../../composables/useAppName'

// 超级管理员独立页面：系统配置（系统信息 / 数据库信息 / 系统参数 三块）
const { refreshAppName } = useAppName()

// ===== 日志与诊断 =====
const diag = ref({})
const logLevel = ref('all')
const logLines = ref([])

// 诊断概览：运行时长 / 内存 / 日志文件大小（打开面板即拉取）
async function loadDiag() {
  const res = await getDiagInfo()
  if (res && res.success) diag.value = res.data || {}
  loadLogs()
}

// 按级别筛选读取日志：最新 200 行倒序展示
async function loadLogs() {
  const res = await getDiagLogs({ level: logLevel.value, limit: 200 })
  if (res && res.success) {
    logLines.value = (res.data && res.data.lines) || []
  } else {
    dialogAlert((res && res.message) || '读取日志失败')
  }
}

// 导出日志到用户选择的位置
async function doExportLog() {
  const res = await exportDiagLog()
  if (res && res.canceled) return
  if (res && res.success) dialogAlert('日志已导出')
  else dialogAlert((res && res.message) || '导出失败')
}

// 打开日志目录
async function doOpenLogFolder() {
  const res = await openDiagFolder()
  if (!res || !res.success) dialogAlert((res && res.message) || '打开日志目录失败')
}
const info = ref({})
const db = ref({})
const dbExporting = ref(false)

const keyword = ref('')
const page = ref(1)
const sortField = ref('')
const sortOrder = ref('')
const params = ref([])
const total = ref(0)
const totalPages = ref(1)

const showModal = ref(false)
const isEdit = ref(false)
const editId = ref(null)
const form = reactive({ configKey: '', configValue: '', configType: 'string', description: '' })

// ===== 默认主题（外观） =====
const defaultTheme = ref('system')
const themeSaving = ref(false)
let themeParamId = null

// 读取 system.theme 参数：以参数键精确检索（分页/关键字不影响定位），缺失时回退 system
async function loadDefaultTheme() {
  const res = await listParams({ page: 1, keyword: 'system.theme' })
  if (res && res.success) {
    const found = ((res.data && res.data.list) || []).find((p) => p.configKey === 'system.theme')
    if (found) {
      themeParamId = found.id
      defaultTheme.value = ['light', 'dark', 'system'].includes(found.configValue) ? found.configValue : 'system'
    }
  }
}

// 保存默认主题：参数已存在则编辑，否则新增（复用 system:params-*，超管鉴权已有）
async function saveDefaultTheme() {
  if (themeSaving.value) return
  themeSaving.value = true
  try {
    const value = defaultTheme.value
    let res
    if (themeParamId) {
      res = await updateParam(themeParamId, { configValue: value })
    } else {
      res = await createParam({
        configKey: 'system.theme',
        configValue: value,
        configType: 'string',
        description: '默认主题：light/dark/system（超管可配，无本地偏好的用户首次登录兜底）'
      })
    }
    if (res && res.success) {
      themeParamId = res.data ? res.data.id : themeParamId
      await refreshAfterWrite('默认主题已保存')
      loadParams()
    } else {
      dialogAlert((res && res.message) || '保存失败')
    }
  } finally {
    themeSaving.value = false
  }
}

// ===== 行详情 =====
const detailVisible = ref(false)
const detailRow = ref(null)
const detailFields = ref([])
const detailTitle = ref('')
// 系统参数详情字段：完整参数值在弹窗中查看（表格内单行省略）
const paramDetailFields = [
  { key: 'id', label: 'ID' },
  { key: 'configKey', label: '参数键' },
  { key: 'configValue', label: '参数值' },
  { key: 'configType', label: '类型' },
  { key: 'description', label: '描述' }
]
function openDetail(row, fields, title) {
  detailRow.value = row
  detailFields.value = fields
  detailTitle.value = title
  detailVisible.value = true
}

async function loadInfo() {
  const res = await getSystemInfo()
  if (res && res.success) info.value = res.data || {}
}
async function loadDb() {
  const res = await getDatabaseInfo()
  if (res && res.success) db.value = res.data || {}
}
async function loadParams() {
  const res = await listParams({ page: page.value, keyword: keyword.value, sortField: sortField.value, sortOrder: sortOrder.value })
  if (res && res.success) {
    params.value = (res.data && res.data.list) || []
    total.value = (res.data && res.data.total) || 0
    totalPages.value = (res.data && res.data.totalPages) || 1
  } else {
    dialogAlert((res && res.message) || '加载系统参数失败')
  }
}
function search() {
  page.value = 1
  loadParams()
}
function onSort(field, order) {
  sortField.value = field
  sortOrder.value = order
  page.value = 1
  loadParams()
}
function reset() {
  keyword.value = ''
  page.value = 1
  loadParams()
}

function openCreate() {
  isEdit.value = false
  editId.value = null
  Object.assign(form, { configKey: '', configValue: '', configType: 'string', description: '' })
  showModal.value = true
}
function openEdit(p) {
  isEdit.value = true
  editId.value = p.id
  Object.assign(form, {
    configKey: p.configKey,
    configValue: p.configValue || '',
    configType: p.configType || 'string',
    description: p.description || ''
  })
  showModal.value = true
}

// 保存成功：刷新参数列表并提示；顺带重读品牌信息（修改系统名称后顶栏/登录页即时生效）
async function onParamSaved() {
  await refreshAfterWrite(isEdit.value ? '保存成功' : '新增成功')
  refreshAppName()
  loadParams()
}

async function doDelete(p) {
  const ok = await dialogConfirm(`确定删除系统参数「${p.configKey}」吗？`)
  if (!ok) return
  const res = await deleteParam(p.id)
  if (res && res.success) {
    await refreshAfterWrite('删除成功')
  } else {
    dialogAlert((res && res.message) || '删除失败')
  }
}

async function doExportDb() {
  dbExporting.value = true
  try {
    const res = await exportDb()
    if (res && res.canceled) return
    if (res && res.success) dialogAlert('数据库备份导出成功')
    else dialogAlert((res && res.message) || '导出失败')
  } finally {
    dbExporting.value = false
  }
}

// 程序操作：打开控制台 / 程序目录 / 数据目录
async function doOpenDevConsole() {
  const res = await openDevConsole()
  if (!res || !res.success) dialogAlert((res && res.message) || '打开控制台失败')
}
async function doOpenAppFolder() {
  const res = await openAppFolder()
  if (!res || !res.success) dialogAlert((res && res.message) || '打开程序目录失败')
}
async function doOpenDataFolder() {
  const res = await openDataFolder()
  if (!res || !res.success) dialogAlert((res && res.message) || '打开数据目录失败')
}
// 清除缓存后全局刷新，让新资源生效
async function doClearCache() {
  const res = await clearCache()
  if (res && res.success) {
    await refreshAfterWrite('缓存清除成功')
  } else {
    dialogAlert((res && res.message) || '清除缓存失败')
  }
}

onMounted(() => {
  loadInfo()
  loadDb()
  loadParams()
  loadDefaultTheme()
  loadDiag()
})
// 数据变动（本页写操作或外部改动）后后台静默重拉参数列表与系统信息
useAutoRefresh(() => {
  loadParams()
  loadInfo()
  loadDb()
})
</script>

<style scoped>
/* 日志查看区：等宽字体、暗底，错误行标红；高度固定内部滚动 */
.log-box {
  margin-top: 12px;
  height: 320px;
  overflow-y: auto;
  background: var(--bg-muted);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.7;
}
.log-line {
  display: flex;
  gap: 10px;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-2);
}
.log-no {
  flex-shrink: 0;
  color: var(--text-3);
  user-select: none;
}
.log-text {
  min-width: 0;
}
.log-err {
  color: var(--danger);
}
</style>
