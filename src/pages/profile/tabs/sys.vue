<template>
  <div class="sys-tab">
    <!-- 状态区域 -->
    <section class="card card-wide card-system">
      <div class="card-head">
        <h3 class="card-title">运行状态</h3>
      </div>
      <div class="sys-row">
        <div class="sys-box">
          <span class="sys-key">后端服务状态</span>
          <span class="sys-val">
            <span class="status-dot" :class="serverOk ? 'on' : 'err'"></span>{{ serverOk ? '服务正常' : '服务异常' }}
          </span>
        </div>
        <div class="sys-box">
          <span class="sys-key">Python后端算法服务状态</span>
          <span class="sys-val">
            <span>正在开发中</span>
          </span>
        </div>
        <div class="sys-box clickable" @click="openDb">
          <span class="sys-key">数据库连接状态</span>
          <span class="sys-val">
            <span class="status-dot" :class="dbOk ? 'on' : 'err'"></span>{{ dbOk ? '已连接' : '连接失败' }}<span class="arrow"> ›</span>
          </span>
        </div>
        <div class="sys-box">
          <span class="sys-key">应用运行时长</span>
          <span class="sys-val">{{ uptimeText }}</span>
        </div>
      </div>
    </section>

    <!-- 配置区域 -->
    <section class="card card-wide card-system">
      <div class="card-head">
        <h3 class="card-title">配置</h3>
      </div>
      <p class="dev-tip">正在开发中</p>
    </section>

    <!-- 工具区域 -->
    <section class="card card-wide card-system">
      <div class="card-head">
        <h3 class="card-title">工具</h3>
      </div>
      <div class="sys-row">
        <div class="sys-box clickable" @click="openClear">
          <span class="sys-key">清理本地缓存</span>
          <span class="sys-val arrow">清理 ›</span>
        </div>
      </div>
      <div class="sys-row">
        <div class="sys-box clickable" @click="openTables">
          <span class="sys-key">查看数据表</span>
          <span class="sys-val arrow">查看 ›</span>
        </div>
      </div>
      <div class="sys-row">
        <div class="sys-box clickable" :title="userDataPath ? userDataPath + '（点击打开）' : '点击打开'" @click="handleOpenUserDataDir">
          <span class="sys-key">用户数据目录</span>
          <span class="sys-val">
            <span class="arrow">打开 ›</span>
          </span>
        </div>
      </div>
      <div class="sys-row">
        <div class="sys-box clickable" :title="appPath ? appPath + '（点击打开）' : '点击打开'" @click="handleOpenAppDir">
          <span class="sys-key">程序文件所在目录</span>
          <span class="sys-val">
            <span class="arrow">打开 ›</span>
          </span>
        </div>
      </div>
      <div class="sys-row">
        <div class="sys-box clickable" title="将当前库的表结构和数据导出为 SQL 备份文件" @click="handleExportDb">
          <span class="sys-key">导出数据库备份</span>
          <span class="sys-val arrow">导出 ›</span>
        </div>
      </div>
      <div class="sys-row">
        <div class="sys-box clickable" title="打开开发者控制台（DevTools），可查看日志、网络请求与调试" @click="handleOpenDevTools">
          <span class="sys-key">打开开发者控制台（DevTools）</span>
          <span class="sys-val arrow">打开 ›</span>
        </div>
      </div>
    </section>

    <!-- 关于区域 -->
    <section class="card card-wide card-system">
      <div class="card-head">
        <h3 class="card-title">关于</h3>
      </div>
      <!-- 应用信息 -->
      <div class="sys-row">
        <div class="sys-box">
          <span class="sys-key">系统名称</span>
          <span class="sys-val">{{ sysName || '—' }}</span>
        </div>
        <div class="sys-box clickable" title="点击检查更新" @click="openUpdate">
          <span class="sys-key">版本号</span>
          <span class="sys-val version-val">
            <span class="ver-text">{{ sysVersion || '—' }}<template v-if="releaseDate">（{{ releaseDate }}）</template></span>
          </span>
        </div>
      </div>
      <!-- 环境信息 -->
      <div class="sys-row">
        <div class="sys-box">
          <span class="sys-key">操作系统</span>
          <span class="sys-val">{{ env.platform || '—' }}</span>
        </div>
        <div class="sys-box">
          <span class="sys-key">Node.js 版本</span>
          <span class="sys-val">{{ env.nodeVersion || '—' }}</span>
        </div>
        <div class="sys-box">
          <span class="sys-key">Electron 版本</span>
          <span class="sys-val">{{ env.electronVersion || '—' }}</span>
        </div>
        <div class="sys-box">
          <span class="sys-key">Vue 版本</span>
          <span class="sys-val">{{ env.vueVersion || '—' }}</span>
        </div>
      </div>
      <!-- 开发者联系方式 -->
      <div class="sys-row">
        <div class="sys-box">
          <span class="sys-key">开发者邮箱</span>
          <span class="sys-val">
            <a class="link" href="mailto:1509054114@qq.com">1509054114@qq.com</a>
          </span>
        </div>
        <div class="sys-box">
          <span class="sys-key">开发者GitHub</span>
          <span class="sys-val">
            <a class="link" href="https://github.com/yconghua/grad-studio" target="_blank">yconghua/grad-studio</a>
          </span>
        </div>
      </div>
    </section>

    <!-- 数据库信息弹窗（真实连接） -->
    <div class="modal-mask" v-if="showDb" @click.self="showDb = false">
      <div class="modal">
        <h3 class="modal-title">数据库信息</h3>
        <div v-if="dbLoading" class="modal-text">加载中…</div>
        <template v-else-if="dbInfo">
          <div class="kv-list">
            <div class="kv-row">
              <span class="kv-key">主机</span>
              <span class="kv-val">{{ dbInfo.host }}:{{ dbInfo.port }}</span>
            </div>
            <div class="kv-row">
              <span class="kv-key">数据库名</span>
              <span class="kv-val">{{ dbInfo.database }}</span>
            </div>
            <div class="kv-row">
              <span class="kv-key">用户名</span>
              <span class="kv-val">{{ dbInfo.user }}</span>
            </div>
            <div class="kv-row">
              <span class="kv-key">连接状态</span>
              <span class="kv-val" :class="dbInfo.status === 'connected' ? 'ok' : 'err'">{{ dbInfo.status === 'connected' ? '已连接' : '连接失败' }}</span>
            </div>
          </div>
          <p v-if="dbInfo.status !== 'connected' && dbInfo.error" class="modal-text err">{{ dbInfo.error }}</p>
        </template>
        <div v-else class="modal-text">正在开发中</div>
        <div class="modal-foot">
          <button class="save-btn ghost" @click="showDb = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 清理本地缓存弹窗（Radio 单选） -->
    <div class="modal-mask" v-if="showClear" @click.self="showClear = false">
      <div class="modal">
        <h3 class="modal-title">清理本地缓存</h3>
        <label class="radio-row" v-for="opt in clearOptions" :key="opt.value">
          <input type="radio" :value="opt.value" v-model="clearTarget" />
          <span>{{ opt.label }}</span>
        </label>
        <p v-if="clearMsg" class="msg" :class="clearOk ? 'ok' : 'err'">{{ clearMsg }}</p>
        <div class="modal-foot">
          <button class="save-btn ghost" @click="showClear = false" :disabled="clearLoading">取消</button>
          <button class="save-btn danger" @click="onClear" :disabled="clearLoading">确认清除</button>
        </div>
      </div>
    </div>

    <!-- 查看数据表弹窗（每张表一块，竖排） -->
    <div class="modal-mask" v-if="showTables" @click.self="showTables = false">
      <div class="modal modal-tables">
        <h3 class="modal-title">数据表</h3>
        <div v-if="tablesLoading" class="modal-text">加载中…</div>
        <div v-else-if="tablesErr" class="modal-text err">{{ tablesErr }}</div>
        <div v-else-if="tablesInfo.length" class="tables-list">
          <div class="table-block" v-for="t in tablesInfo" :key="t.name">
            <div class="table-head">
              <span class="table-name">{{ t.name }}</span>
              <span class="table-count">{{ t.count }} 条数据</span>
            </div>
            <div class="field-list" v-if="t.columns.length">
              <span
                class="field-chip"
                :class="{ pk: col.key === 'PRI' }"
                v-for="col in t.columns"
                :key="col.name"
              >{{ col.name }} {{ col.type }}</span>
            </div>
            <div v-else class="field-empty">无字段</div>
          </div>
        </div>
        <div v-else class="modal-text">暂无数据表</div>
        <div class="modal-foot">
          <button class="save-btn ghost" @click="showTables = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 操作提示弹窗 -->
    <div class="modal-mask" v-if="showTip" @click.self="showTip = false">
      <div class="modal modal-sm modal-tip">
        <h3 class="modal-title">提示</h3>
        <p class="modal-text">{{ tipMsg }}</p>
        <div class="modal-foot">
          <button class="save-btn" @click="showTip = false">知道了</button>
        </div>
      </div>
    </div>

    <!-- 检查更新弹窗（关于 → 版本号点击；打开即自动检查一次，可手动重新检查） -->
    <div class="modal-mask" v-if="showUpdate" @click.self="showUpdate = false">
      <div class="modal modal-update">
        <h3 class="modal-title">检查更新</h3>
        <div class="kv-list">
          <div class="kv-row">
            <span class="kv-key">当前版本</span>
            <span class="kv-val">{{ sysVersion || '—' }}</span>
          </div>
          <div class="kv-row">
            <span class="kv-key">最新版本</span>
            <span class="kv-val" v-if="updateState !== 'ok'">{{ updateState === 'checking' ? '检查中…' : '—' }}</span>
            <span class="kv-val" :class="updateResult.hasUpdate ? 'has-update' : 'ok'" v-else>
              {{ updateResult.latest || '—' }}
            </span>
          </div>
        </div>

        <p v-if="updateState === 'checking'" class="modal-text update-tip">正在连接服务器检查，请稍候…</p>
        <div v-else-if="updateState === 'error'" class="update-msg err">{{ updateError }}</div>
        <template v-else-if="updateState === 'ok'">
          <p v-if="updateResult.hasUpdate" class="update-msg has-update">
            发现新版本 <b>{{ updateResult.latest }}</b>，可下载安装升级。
          </p>
          <p v-else class="update-msg ok">当前已是最新版本。</p>
          <div v-if="updateResult.hasUpdate && updateResult.notes" class="update-notes">
            <p class="update-notes-title">更新说明</p>
            <pre class="update-notes-body">{{ updateResult.notes }}</pre>
          </div>
        </template>

        <div class="modal-foot">
          <button class="save-btn ghost" @click="showUpdate = false" :disabled="updateState === 'checking'">关闭</button>
          <button
            v-if="updateState === 'ok' && updateResult.hasUpdate"
            class="save-btn"
            @click="downloadUpdate"
          >去下载</button>
          <button v-else class="save-btn" @click="checkUpdate" :disabled="updateState === 'checking'">检查更新</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { version as vueVersion } from 'vue'
import { useRouter } from 'vue-router'
import {
  logout,
  getSysInfo,
  getDbInfo,
  getTablesInfo,
  clearCache,
  getUserDataPath,
  openUserDataDir,
  getAppPath,
  openAppDir,
  exportDatabase,
  openDevTools,
  checkForUpdates
} from '../../../api'

const router = useRouter()
// 应用信息：系统名称 / 版本号 / 发布日期（来自后端 package.json，写活）
const sysName = ref('')
const sysVersion = ref('')
const releaseDate = ref('')
// 运行环境信息（OS / Node / Electron 来自主进程，Vue 版本取当前依赖）
const env = ref({ platform: '', nodeVersion: '', electronVersion: '', vueVersion: vueVersion || '' })
// 状态区域：后端服务 / 数据库连接 / 运行时长
const serverOk = ref(false)
const dbOk = ref(false)
const startedAt = ref(0)
const nowTick = ref(Date.now())
const uptimeText = computed(() => {
  if (!startedAt.value) return '—'
  const diff = Math.max(0, nowTick.value - startedAt.value)
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  return `${days} 天 ${hours} 小时 ${mins} 分钟`
})
// 运行时长：挂载后每分钟刷新一次
let uptimeTimer = null

// 数据库信息弹窗：真实连接数据（点击时拉取）
const showDb = ref(false)
const dbLoading = ref(false)
const dbInfo = ref(null)
async function loadDbInfo() {
  dbLoading.value = true
  dbInfo.value = null
  try {
    const res = await getDbInfo()
    if (res && res.success) dbInfo.value = res
    else dbInfo.value = { status: 'disconnected', error: (res && res.message) || '获取失败' }
  } catch (e) {
    dbInfo.value = { status: 'disconnected', error: '请求异常：' + (e && e.message ? e.message : e) }
  } finally {
    dbLoading.value = false
  }
}
function openDb() {
  showDb.value = true
  loadDbInfo()
}

// 挂载时拉取：系统信息（服务状态 + 运行环境）+ 数据库连接状态
async function loadSysStatus() {
  try {
    const res = await getSysInfo()
    if (res && res.success) {
      serverOk.value = true
      sysName.value = res.name || ''
      sysVersion.value = res.version || ''
      releaseDate.value = res.releaseDate || ''
      startedAt.value = res.startedAt || 0
      env.value = {
        platform: res.platform || '',
        nodeVersion: res.nodeVersion || '',
        electronVersion: res.electronVersion || '',
        vueVersion: vueVersion || ''
      }
    } else {
      serverOk.value = false
    }
  } catch (e) {
    serverOk.value = false
  }
  try {
    const res = await getDbInfo()
    dbOk.value = !!(res && res.success && res.status === 'connected')
  } catch (e) {
    dbOk.value = false
  }
}

// 清理本地缓存（Modal + Radio 单选；localStorage 选项会清登录态）
const showClear = ref(false)
const clearTarget = ref('electron')
const clearOptions = [
  { value: 'electron', label: 'Electron 应用缓存（不影响登录）' },
  { value: 'local', label: '本地存储 localStorage（清除登录态，需重新登录）' },
  { value: 'all', label: '全部清除（以上两者都清）' }
]
const clearMsg = ref('')
const clearOk = ref(false)
const clearLoading = ref(false)
function openClear() {
  clearTarget.value = 'electron'
  clearMsg.value = ''
  clearOk.value = false
  showClear.value = true
}
async function onClear() {
  clearMsg.value = ''
  clearLoading.value = true
  try {
    if (clearTarget.value === 'electron' || clearTarget.value === 'all') {
      const res = await clearCache()
      if (!res || !res.success) {
        clearMsg.value = (res && res.message) || '清理失败'
        clearOk.value = false
        clearLoading.value = false
        return
      }
    }
    if (clearTarget.value === 'local' || clearTarget.value === 'all') {
      // 先通知主进程退出登录（清掉内存中的 currentUser），再清 localStorage，
      // 避免出现「前端已登出、后端会话还活着」的错位状态；
      // 主进程退出失败不阻断本地清理（兼容纯网页端等无 window.api 的环境）
      try {
        await logout()
      } catch (e) {
        // 忽略主进程退出异常，继续清理本地存储
      }
      localStorage.clear()
    }
    clearOk.value = true
    clearMsg.value = '清理成功'
    if (clearTarget.value !== 'electron') {
      // 登录态已被清除：稍后跳转登录页重新登录
      setTimeout(() => router.push('/login'), 800)
    }
  } catch (e) {
    clearMsg.value = '清理过程出现异常，请重试'
    clearOk.value = false
  } finally {
    clearLoading.value = false
  }
}

// 查看数据表（当前库所有表 + 字段 + 行数，点击时拉取）
const showTables = ref(false)
const tablesLoading = ref(false)
const tablesErr = ref('')
const tablesInfo = ref([])
async function loadTablesInfo() {
  tablesLoading.value = true
  tablesErr.value = ''
  tablesInfo.value = []
  try {
    const res = await getTablesInfo()
    if (res && res.success) tablesInfo.value = res.tables || []
    else tablesErr.value = (res && res.message) || '查询失败'
  } catch (e) {
    tablesErr.value = '请求异常：' + (e && e.message ? e.message : e)
  } finally {
    tablesLoading.value = false
  }
}
function openTables() {
  showTables.value = true
  loadTablesInfo()
}

// 用户数据目录：路径展示（挂载时拉取）+ 点击打开（系统文件管理器）
const userDataPath = ref('')
async function loadUserDataPath() {
  try {
    const res = await getUserDataPath()
    if (res && res.success) userDataPath.value = res.path || ''
  } catch (e) {
    // 拉取失败保持占位符
  }
}
async function handleOpenUserDataDir() {
  try {
    const res = await openUserDataDir()
    if (res && res.success) openTip(`已打开目录：${res.path}`)
    else openTip((res && res.message) || '打开失败，请稍后重试')
  } catch (e) {
    openTip('打开过程出现异常，请稍后重试')
  }
}

// 程序文件所在目录：路径展示（挂载时拉取）+ 点击打开（系统文件管理器）
const appPath = ref('')
async function loadAppPath() {
  try {
    const res = await getAppPath()
    if (res && res.success) appPath.value = res.path || ''
  } catch (e) {
    // 拉取失败保持占位符
  }
}
async function handleOpenAppDir() {
  try {
    const res = await openAppDir()
    if (res && res.success) openTip(`已打开目录：${res.path}`)
    else openTip((res && res.message) || '打开失败，请稍后重试')
  } catch (e) {
    openTip('打开过程出现异常，请稍后重试')
  }
}

// 导出数据库备份：主进程弹保存对话框 → 导出 SQL 文件 → 提示结果
const exporting = ref(false)
async function handleExportDb() {
  if (exporting.value) return
  exporting.value = true
  try {
    const res = await exportDatabase()
    if (res && res.canceled) return // 用户主动取消，不打扰
    if (res && res.success) {
      const size = res.bytes ? (res.bytes / 1024).toFixed(1) + ' KB' : '—'
      openTip(`备份完成：${res.path}\n（${res.tables} 张表 / ${res.rows} 行 / ${size}）`)
    } else {
      openTip((res && res.message) || '导出失败，请稍后重试')
    }
  } catch (e) {
    openTip('导出过程出现异常，请稍后重试')
  } finally {
    exporting.value = false
  }
}

// 打开开发者控制台（DevTools）：主进程以 detach 独立窗口弹出，失败时弹提示
async function handleOpenDevTools() {
  try {
    const res = await openDevTools()
    if (res && !res.success) openTip((res && res.message) || '打开控制台失败，请稍后重试')
  } catch (e) {
    openTip('打开控制台过程出现异常，请稍后重试')
  }
}

// 检查更新（关于 → 版本号点击）：查 GitHub Releases 最新版并对比本地版本
// state: idle（未检查）/ checking（检查中）/ ok（成功）/ error（失败）
const showUpdate = ref(false)
const updateState = ref('idle')
const updateResult = ref(null) // { hasUpdate, current, latest, notes, url }
const updateError = ref('')
async function checkUpdate() {
  updateState.value = 'checking'
  updateError.value = ''
  try {
    const res = await checkForUpdates()
    if (!res || !res.success) {
      updateState.value = 'error'
      updateError.value = (res && res.message) || '检查失败，请稍后重试'
      return
    }
    updateResult.value = res
    updateState.value = 'ok'
  } catch (e) {
    updateState.value = 'error'
    updateError.value = '请求异常：' + (e && e.message ? e.message : e)
  }
}
function openUpdate() {
  showUpdate.value = true
  updateState.value = 'idle'
  updateResult.value = null
  updateError.value = ''
  // 打开弹窗即自动检查一次；失败后可通过「检查更新」按钮重试
  checkUpdate()
}
function downloadUpdate() {
  const url = updateResult.value && updateResult.value.url
  // 外链 https 由主进程 windowOpenHandler 转交系统浏览器打开（不弹新 Electron 窗口）
  if (url) window.open(url, '_blank')
}

// 操作提示弹窗
const showTip = ref(false)
const tipMsg = ref('')
function openTip(msg) {
  tipMsg.value = msg
  showTip.value = true
}

onMounted(async () => {
  // 系统管理（管理员可见）：服务状态 / 环境信息 / 数据库连接状态
  loadSysStatus()
  // 用户数据目录路径（系统管理 → 工具）
  loadUserDataPath()
  // 程序文件所在目录路径（系统管理 → 工具）
  loadAppPath()
  // 运行时长：每分钟刷新一次
  uptimeTimer = setInterval(() => {
    nowTick.value = Date.now()
  }, 60000)
})

onUnmounted(() => {
  if (uptimeTimer) clearInterval(uptimeTimer)
})
</script>

<style scoped>
.card {
  background: #fff;
  border-radius: 8px;
  padding: 20px 24px;
  margin: 0 auto;
}
.card-wide {
  max-width: 100%;
}
.card-system {
  width: 60%;
  margin-bottom: 20px;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.card-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  color: #1f2329;
}
.save-btn {
  height: 38px;
  padding: 0 22px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  color: #fff;
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
  background: #fff;
  color: #0d80e0;
  border: 1px solid #0d80e0;
}
.save-btn.danger {
  background: linear-gradient(135deg, #ea4335 0%, #d93025 100%);
}
.msg {
  font-size: 13px;
  margin: 0 0 12px;
}
.msg.ok {
  color: #19a558;
}
.msg.err {
  color: #ea4335;
}

/* 系统管理：竖排 + 底部细线分隔 */
.sys-row {
  display: block;
}
.sys-row:first-of-type {
  margin-top: 0;
}
.sys-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #f2f4f7;
  font-size: 14px;
}
/* 最后一条（数据库信息）不显示分隔线 */
.sys-row:last-of-type .sys-box:last-child {
  border-bottom: none;
}
.sys-box.clickable {
  cursor: pointer;
  transition: background 0.2s;
}
.sys-box.clickable:hover {
  background: #e8f0fe;
}
.sys-key {
  width: auto;
  color: #8a9099;
}
.sys-val {
  color: #1f2329;
}
.sys-val.arrow {
  color: #0d80e0;
}

/* 状态圆点（绿=正常 / 红=异常） */
.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}
.status-dot.on {
  background: #19a558;
}
.status-dot.err {
  background: #ea4335;
}

/* 外部链接（邮箱 / GitHub）与箭头 */
.sys-val .link {
  color: #0d80e0;
  text-decoration: none;
}
.sys-val .link:hover {
  text-decoration: underline;
}
.sys-box .arrow {
  color: #0d80e0;
}

/* 配置区域占位 */
.dev-tip {
  margin: 8px 0 0;
  padding: 32px 0;
  text-align: center;
  font-size: 14px;
  color: #8a9099;
  background: #fafbfc;
  border-radius: 8px;
}

/* 清理缓存弹窗：Radio 选项 */
.radio-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 0;
  font-size: 14px;
  color: #1f2329;
  cursor: pointer;
}
.radio-row input {
  margin-top: 3px;
}

/* 查看数据表弹窗：表块竖排 + 字段 chips */
.modal-tables {
  min-width: 560px;
}
.tables-list {
  max-height: 60vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.table-block {
  border: 1px solid #f0f2f5;
  border-radius: 8px;
  padding: 12px 14px;
}
.table-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.table-name {
  font-size: 14px;
  font-weight: 600;
  color: #0d80e0;
}
.table-count {
  font-size: 13px;
  color: #8a9099;
}
.field-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.field-chip {
  padding: 3px 10px;
  border-radius: 8px;
  background: #f2f6fb;
  color: #4e5969;
  font-size: 12px;
  white-space: nowrap;
}
.field-chip.pk {
  background: #e8f0fe;
  color: #0d80e0;
  border: 1px solid #cfe0f8;
}
.field-empty {
  font-size: 13px;
  color: #8a9099;
}

/* 弹窗内键值列表（数据库信息） */
.kv-list {
  border: 1px solid #f0f2f5;
  border-radius: 8px;
  overflow: hidden;
}
.kv-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  font-size: 14px;
  border-bottom: 1px solid #f0f2f5;
}
.kv-row:last-child {
  border-bottom: none;
}
.kv-key {
  color: #8a9099;
  width: 80px;
}
.kv-val {
  color: #1f2329;
  font-weight: 500;
  text-align: right;
}
.kv-val.ok {
  color: #19a558;
}
.kv-val.err {
  color: #ea4335;
}
.modal-text.err {
  color: #ea4335;
}

/* 关于 → 版本号行：检查更新入口 */
.version-val {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}
.version-val .ver-text {
  color: #1f2329;
}

.sys-box.clickable:hover .update-link {
  text-decoration: underline;
}

/* 检查更新弹窗 */
.modal-update {
  width: 520px;
  max-width: 92vw;
}
.update-tip {
  margin: 14px 0 0;
  color: #8a9099;
}
.update-msg {
  margin: 14px 0 0;
  font-size: 14px;
  line-height: 1.7;
}
.update-msg.ok {
  color: #19a558;
}
.update-msg.err {
  color: #ea4335;
}
.update-msg.has-update {
  color: #0d80e0;
  font-weight: 500;
}
.update-msg.has-update b {
  font-size: 16px;
}
.kv-val.has-update {
  color: #0d80e0;
  font-weight: 600;
}
.update-notes {
  margin-top: 14px;
  border: 1px solid #f0f2f5;
  border-radius: 8px;
  background: #fafbfc;
  padding: 10px 14px;
}
.update-notes-title {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 600;
  color: #4e5969;
}
.update-notes-body {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.7;
  color: #4e5969;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 40vh;
  overflow-y: auto;
  font-family: inherit;
}

/* 弹窗 */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  backdrop-filter: blur(2px);
}
.modal {
  background: #fff;
  border-radius: 8px;
  padding: 22px 24px;
  width: auto;
  min-width: 380px;
  max-width: 90vw;
  max-height: 84vh;
  overflow-y: auto;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}
.modal-sm {
  width: 320px;
}
.modal-tip {
  width: auto;
  min-width: 400px;
  max-width: 600px;
}
.modal-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0 0 16px;
}
.modal-text {
  font-size: 14px;
  color: #4e5969;
  margin: 0 0 18px;
  line-height: 1.6;
}
.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}
</style>
