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
          <span v-if="!db.connected && db.error" style="margin-left: 8px; color: #e5484d">{{ db.error }}</span>
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

    <!-- 块 4：系统参数 -->
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
        <table class="tbl">
          <thead>
            <tr>
              <th>ID</th>
              <th>参数键</th>
              <th>参数值</th>
              <th>类型</th>
              <th>描述</th>
              <th style="width: 130px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in params" :key="p.id">
              <td>{{ p.id }}</td>
              <td style="font-family: monospace">{{ p.configKey }}</td>
              <td style="max-width: 260px">{{ p.configValue || '-' }}</td>
              <td><span class="tag tag-blue">{{ p.configType }}</span></td>
              <td>{{ p.description || '-' }}</td>
              <td>
                <div class="ops">
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

    <!-- 新增 / 编辑系统参数弹窗 -->
    <div v-if="showModal" class="modal-mask" @click.self="showModal = false">
      <div class="modal">
        <div class="modal-head">
          <h3>{{ isEdit ? '编辑系统参数' : '新增系统参数' }}</h3>
          <button type="button" class="modal-close" @click="showModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label>参数键</label>
            <input v-model.trim="form.configKey" class="input" placeholder="例如 system.name" />
          </div>
          <div class="field">
            <label>参数值</label>
            <textarea v-model="form.configValue" placeholder="请输入参数值"></textarea>
          </div>
          <div class="field">
            <label>参数类型</label>
            <select v-model="form.configType" class="select">
              <option value="string">string（字符串）</option>
              <option value="number">number（预留）</option>
              <option value="boolean">boolean（预留）</option>
              <option value="json">json（预留）</option>
            </select>
            <p class="hint">当前统一按字符串处理，类型字段预留后续扩展</p>
          </div>
          <div class="field">
            <label>描述</label>
            <input v-model.trim="form.description" class="input" placeholder="参数描述（选填）" />
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="showModal = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { getSystemInfo, getDatabaseInfo, listParams, createParam, updateParam, deleteParam, exportDb, openDevConsole, openAppFolder, openDataFolder, clearCache } from '../../api'
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'
import { refreshAfterWrite } from '../../composables/useGlobalRefresh'

// 超级管理员独立页面：系统配置（系统信息 / 数据库信息 / 系统参数 三块）
const info = ref({})
const db = ref({})
const dbExporting = ref(false)

const keyword = ref('')
const page = ref(1)
const params = ref([])
const total = ref(0)
const totalPages = ref(1)

const showModal = ref(false)
const isEdit = ref(false)
const saving = ref(false)
const editId = ref(null)
const form = reactive({ configKey: '', configValue: '', configType: 'string', description: '' })

async function loadInfo() {
  const res = await getSystemInfo()
  if (res && res.success) info.value = res.data || {}
}
async function loadDb() {
  const res = await getDatabaseInfo()
  if (res && res.success) db.value = res.data || {}
}
async function loadParams() {
  const res = await listParams({ page: page.value, keyword: keyword.value })
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

async function save() {
  if (!form.configKey) return dialogAlert('请输入参数键')
  saving.value = true
  try {
    const data = {
      configKey: form.configKey,
      configValue: form.configValue,
      configType: form.configType,
      description: form.description
    }
    const res = isEdit.value ? await updateParam(editId.value, data) : await createParam(data)
    if (res && res.success) {
      showModal.value = false
      await refreshAfterWrite(isEdit.value ? '保存成功' : '新增成功')
    } else {
      dialogAlert((res && res.message) || '保存失败')
    }
  } finally {
    saving.value = false
  }
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
})
</script>
