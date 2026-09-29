<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">ℹ️ 系统介绍</h2>
        <p class="page-desc">系统基本信息、运行环境与当前数据库连接状态</p>
      </div>
    </div>

    <!-- 系统信息 -->
    <div class="card">
      <div class="card-head">
        <h3 class="card-title">🖥️ 系统信息</h3>
        <div class="uptime">
          <div class="uptime-value">{{ uptimeText || '—' }}</div>
          <div class="uptime-label">已连续运行</div>
        </div>
      </div>
      <div v-if="loading" class="state">加载中…</div>
      <div v-else class="info-grid">
        <div class="info-item"><span class="info-label">系统名称</span><span class="info-value">{{ appName }}</span></div>
        <div class="info-item"><span class="info-label">版本</span><span class="info-value">{{ sysInfo.version ? 'v' + sysInfo.version : '—' }}</span></div>
        <div class="info-item"><span class="info-label">启动时间</span><span class="info-value">{{ formatTime(sysInfo.startedAt) }}</span></div>
        <div class="info-item"><span class="info-label">操作系统</span><span class="info-value">{{ sysInfo.platform || '—' }}</span></div>
        <div class="info-item"><span class="info-label">Node 版本</span><span class="info-value">{{ sysInfo.nodeVersion || '—' }}</span></div>
        <div class="info-item"><span class="info-label">Electron 版本</span><span class="info-value">{{ sysInfo.electronVersion || '—' }}</span></div>
      </div>
    </div>

    <!-- 当前数据库 -->
    <div class="card">
      <div class="card-head">
        <h3 class="card-title">🗄️ 当前数据库</h3>
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

    <!-- 本地数据与目录 -->
    <div class="card">
      <div class="card-head">
        <h3 class="card-title">📂 本地数据与目录</h3>
      </div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">用户数据目录</span><span class="info-value path">{{ userDataPath || '—' }}</span></div>
        <div class="info-item"><span class="info-label">程序目录</span><span class="info-value path">{{ appPath || '—' }}</span></div>
      </div>
      <div class="dir-actions">
        <button class="btn btn-secondary" @click="onOpenDataDir">📂 打开数据目录</button>
        <span class="dir-tip">数据库与本地数据存放在该目录，迁移 / 备份时可直接定位。</span>
      </div>
    </div>

    <!-- 技术栈与版权 -->
    <div class="card">
      <div class="card-head">
        <h3 class="card-title">📦 技术栈与版权</h3>
      </div>
      <div class="tech-chips">
        <span v-for="t in techStack" :key="t" class="chip">{{ t }}</span>
      </div>
      <div class="license-row"><span class="info-label">开源协议</span><span class="info-value">MIT</span></div>
      <div class="license-row"><span class="info-label">作者</span><span class="info-value">yconghua</span></div>
      <div class="license-row">
        <span class="info-label">项目仓库</span>
        <button class="link" @click="onOpenRepo">github.com/yconghua/grad-studio ↗</button>
      </div>
      <div class="copyright">© 2026 grad-studio · MIT License</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  getSysInfo,
  getDbInfo,
  getUserDataPath,
  getAppPath,
  openUserDataDir,
  openExternal
} from '../../api'
import { useAppName } from '../../composables/useAppName'
import { dialogAlert } from '../../composables/useDialog'

const { appName } = useAppName()

const sysInfo = ref({})
const dbInfo = ref({})
const userDataPath = ref('')
const appPath = ref('')
const loading = ref(true)

const techStack = ['Vue 3', 'Electron', 'MySQL', 'Ant Design Vue']
const REPO_URL = 'https://github.com/yconghua/grad-studio'

// 已连续运行时长：由主进程返回的启动时间实时计算，异常输入兜底为空
const uptimeText = computed(() => calcRuntime(sysInfo.value.startedAt))

function calcRuntime(startedAt) {
  if (!startedAt) return ''
  const start = new Date(startedAt)
  if (isNaN(start.getTime())) return ''
  const ms = Date.now() - start.getTime()
  if (ms < 0) return ''
  const totalMinutes = Math.floor(ms / 60000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days} 天 ${hours} 小时`
  if (hours > 0) return `${hours} 小时 ${minutes} 分钟`
  return `${minutes} 分钟`
}

function formatTime(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return '—'
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

async function load() {
  loading.value = true
  try {
    const [info, db, ud, ap] = await Promise.all([
      getSysInfo(),
      getDbInfo(),
      getUserDataPath(),
      getAppPath()
    ])
    if (info && info.success) sysInfo.value = info
    if (db && db.success) dbInfo.value = db
    if (ud && ud.success) userDataPath.value = ud.path
    if (ap && ap.success) appPath.value = ap.path
  } catch (e) {
    // 任一接口失败保持空值，不阻塞页面展示
  } finally {
    loading.value = false
  }
}

async function onOpenDataDir() {
  try {
    const res = await openUserDataDir()
    if (!res || !res.success) dialogAlert((res && res.message) || '打开失败，请重试')
  } catch (e) {
    dialogAlert('打开失败，请重试')
  }
}

async function onOpenRepo() {
  try {
    const res = await openExternal(REPO_URL)
    if (!res || !res.success) dialogAlert((res && res.message) || '打开链接失败')
  } catch (e) {
    dialogAlert('打开链接失败')
  }
}

onMounted(load)
</script>

<style scoped>
.page { max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
.page-title { margin: 0 0 4px; font-size: 18px; color: #1f2329; }
.page-desc { margin: 0; font-size: 13px; color: #8a9099; }
.card { background: #fff; border: 1px solid #eceff3; border-radius: 12px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04); padding: 16px; }
.card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.card-title { margin: 0; font-size: 15px; color: #1f2329; }
.state { padding: 40px 0; text-align: center; color: #8a9099; font-size: 13px; }

.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
.info-item { display: flex; gap: 10px; font-size: 13px; line-height: 1.7; }
.info-label { color: #8a9099; flex: 0 0 auto; min-width: 96px; }
.info-value { color: #1f2329; word-break: break-all; }
.info-value.path { font-family: Consolas, Monaco, monospace; font-size: 12px; }

.badge { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 12px; }
.badge-ok { background: #e8f7ee; color: #19a558; }
.badge-err { background: #fdecec; color: #ea4335; }
.db-error { margin: 10px 0 0; color: #ea4335; font-size: 12px; }

.uptime { text-align: right; }
.uptime-value { font-size: 26px; font-weight: 700; color: #0d80e0; line-height: 1.1; white-space: nowrap; }
.uptime-label { font-size: 12px; color: #8a9099; margin-top: 2px; }

.btn { height: 34px; padding: 0 16px; border-radius: 8px; font-size: 13px; cursor: pointer; border: 1px solid #dfe3e8; background: #fff; color: #1f2329; }
.btn-secondary:hover { border-color: #0d80e0; color: #0d80e0; }
.dir-actions { display: flex; align-items: center; gap: 12px; margin-top: 14px; }
.dir-tip { font-size: 12px; color: #8a9099; }

.tech-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
.chip { padding: 3px 12px; border-radius: 999px; background: #eef6ff; color: #0d80e0; font-size: 12px; }
.license-row { display: flex; gap: 10px; font-size: 13px; line-height: 1.9; }
.link { background: none; border: none; color: #0d80e0; cursor: pointer; font-size: 13px; padding: 0; }
.link:hover { text-decoration: underline; }
.copyright { margin-top: 16px; text-align: center; font-size: 12px; color: #b8bec4; }
</style>
