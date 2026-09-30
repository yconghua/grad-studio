<template>
  <div class="settings-page">
    <!-- 顶部品牌横幅 -->
    <header class="hero">
      <div class="hero-icon">⚙️</div>
      <div class="hero-main">
        <h2 class="hero-title">设置</h2>
        <p class="hero-desc">应用设置：系统信息、数据库状态、数据目录与卸载</p>
      </div>
      <div class="hero-meta">
        <span class="hero-version">v{{ sysInfo.version || '—' }}</span>
      </div>
    </header>

    <!-- 系统信息 -->
    <section class="card">
      <div class="card-head">
        <div class="card-head-left">
          <span class="card-icon ic-blue">🖥️</span>
          <h3 class="card-title">系统信息</h3>
        </div>
      </div>
      <div v-if="loading" class="state">加载中…</div>
      <div v-else class="info-grid">
        <div class="info-tile"><span class="tile-label">系统名称</span><span class="tile-value">{{ appName }}</span></div>
        <div class="info-tile"><span class="tile-label">版本</span><span class="tile-value">{{ sysInfo.version ? 'v' + sysInfo.version : '—' }}</span></div>
        <div class="info-tile"><span class="tile-label">启动时间</span><span class="tile-value mono">{{ formatTime(sysInfo.startedAt) }}</span></div>
        <div class="info-tile"><span class="tile-label">操作系统</span><span class="tile-value">{{ sysInfo.platform || '—' }}</span></div>
        <div class="info-tile"><span class="tile-label">Node 版本</span><span class="tile-value mono">{{ sysInfo.nodeVersion || '—' }}</span></div>
        <div class="info-tile"><span class="tile-label">Electron 版本</span><span class="tile-value mono">{{ sysInfo.electronVersion || '—' }}</span></div>
      </div>
    </section>

    <!-- 当前数据库 -->
    <section class="card">
      <div class="card-head">
        <div class="card-head-left">
          <span class="card-icon ic-green">🗄️</span>
          <h3 class="card-title">当前数据库</h3>
        </div>
        <span class="badge" :class="dbInfo.status === 'connected' ? 'badge-ok' : 'badge-err'">
          <span class="dot"></span>{{ dbInfo.status === 'connected' ? '已连接' : '未连接' }}
        </span>
      </div>
      <div class="info-grid db-grid">
        <div class="info-tile"><span class="tile-label">主机</span><span class="tile-value">{{ dbInfo.host || '—' }}</span></div>
        <div class="info-tile"><span class="tile-label">端口</span><span class="tile-value mono">{{ dbInfo.port || '—' }}</span></div>
        <div class="info-tile"><span class="tile-label">数据库</span><span class="tile-value">{{ dbInfo.database || '—' }}</span></div>
        <div class="info-tile"><span class="tile-label">用户名</span><span class="tile-value">{{ dbInfo.user || '—' }}</span></div>
      </div>
      <p v-if="dbInfo.error" class="db-error">⚠️ {{ dbInfo.error }}</p>
    </section>

    <!-- 本地数据与目录 -->
    <section class="card">
      <div class="card-head">
        <div class="card-head-left">
          <span class="card-icon ic-amber">📂</span>
          <h3 class="card-title">本地数据与目录</h3>
        </div>
      </div>
      <div class="path-list">
        <div class="path-row">
          <span class="path-label">用户数据目录</span>
          <code class="path-value">{{ userDataPath || '—' }}</code>
        </div>
        <div class="path-row">
          <span class="path-label">程序目录</span>
          <code class="path-value">{{ appPath || '—' }}</code>
        </div>
      </div>
      <div class="dir-actions">
        <button class="btn btn-secondary" @click="onOpenDataDir">📂 打开数据目录</button>
        <span class="dir-tip">数据库与本地数据存放在该目录，迁移 / 备份时可直接定位。</span>
      </div>
    </section>

    <!-- 技术栈与版权 -->
    <section class="card">
      <div class="card-head">
        <div class="card-head-left">
          <span class="card-icon ic-purple">📦</span>
          <h3 class="card-title">技术栈与版权</h3>
        </div>
      </div>
      <div class="tech-chips">
        <span v-for="t in techStack" :key="t" class="chip">{{ t }}</span>
      </div>
      <div class="license-grid">
        <div class="license-row"><span class="info-label">开源协议</span><span class="info-value">MIT</span></div>
        <div class="license-row"><span class="info-label">作者</span><span class="info-value">yconghua</span></div>
        <div class="license-row">
          <span class="info-label">项目仓库</span>
          <button class="link" @click="onOpenRepo">github.com/yconghua/grad-studio ↗</button>
        </div>
        <div class="license-row"><span class="info-label">版权</span><span class="info-value">© 2026 grad-studio · MIT License</span></div>
      </div>
    </section>

    <!-- 卸载应用 -->
    <section class="card card-danger">
      <div class="card-head">
        <div class="card-head-left">
          <span class="card-icon ic-red">🗑️</span>
          <h3 class="card-title">卸载 {{ appName }}</h3>
        </div>
        <span class="badge badge-danger">危险操作</span>
      </div>
      <p class="uninstall-tip">卸载将移除程序文件；数据库与本地数据保留在用户数据目录，不会被删除。如需彻底清除本地数据，请在卸载后手动删除数据目录。</p>
      <div class="dir-actions">
        <button class="btn btn-danger" :disabled="uninstalling" @click="onUninstall">
          {{ uninstalling ? '正在启动卸载…' : '卸载 ' + appName }}
        </button>
        <span class="dir-tip">应用将退出并打开卸载向导，按提示完成即可。</span>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import {
  getSysInfo,
  getDbInfo,
  getUserDataPath,
  getAppPath,
  openUserDataDir,
  openExternal,
  uninstallApp
} from '../../api'
import { useAppName } from '../../composables/useAppName'
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'

const { appName } = useAppName()

const sysInfo = ref({})
const dbInfo = ref({})
const userDataPath = ref('')
const appPath = ref('')
const loading = ref(true)
const uninstalling = ref(false)

const techStack = ['Vue 3', 'Electron', 'MySQL', 'Ant Design Vue']
const REPO_URL = 'https://github.com/yconghua/grad-studio'

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

async function onUninstall() {
  if (uninstalling.value) return
  const ok = await dialogConfirm(
    '卸载将移除程序文件；数据库与本地数据保留在用户数据目录，不会被删除。确定继续吗？',
    '卸载 ' + appName.value
  )
  if (!ok) return
  uninstalling.value = true
  try {
    const res = await uninstallApp()
    if (!res || !res.success) {
      dialogAlert((res && res.message) || '卸载失败，请稍后重试')
      uninstalling.value = false
    }
    // 成功时应用即将退出，无需再提示
  } catch (e) {
    dialogAlert('卸载失败，请稍后重试')
    uninstalling.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.settings-page { max-width: 880px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; padding-bottom: 8px; }

/* ===== 顶部横幅 ===== */
.hero {
  position: relative; overflow: hidden;
  display: flex; align-items: center; gap: 16px;
  padding: 22px 26px; border-radius: 16px;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  box-shadow: 0 10px 26px rgba(13, 128, 224, 0.28);
}
.hero::after {
  content: ''; position: absolute; right: -46px; top: -52px;
  width: 170px; height: 170px; border-radius: 50%;
  background: rgba(255, 255, 255, 0.10);
}
.hero-icon {
  width: 48px; height: 48px; border-radius: 14px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.30);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
}
.hero-main { flex: 1 1 auto; min-width: 0; position: relative; z-index: 1; }
.hero-title { margin: 0; font-size: 20px; font-weight: 700; color: #fff; letter-spacing: 0.5px; }
.hero-desc { margin: 4px 0 0; font-size: 13px; color: rgba(255, 255, 255, 0.88); }
.hero-meta { position: relative; z-index: 1; flex-shrink: 0; }
.hero-version {
  display: inline-block; padding: 5px 14px; border-radius: 999px;
  font-size: 13px; font-weight: 600; color: #fff;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.35);
}

/* ===== 卡片 ===== */
.card {
  background: #fff; border: 1px solid #eceff3; border-radius: 14px;
  box-shadow: 0 1px 3px rgba(16, 24, 40, 0.05);
  padding: 18px 22px 20px;
  transition: box-shadow 0.2s, transform 0.2s;
  animation: rise 0.38s ease both;
}
.card:nth-child(2) { animation-delay: 0.04s; }
.card:nth-child(3) { animation-delay: 0.08s; }
.card:nth-child(4) { animation-delay: 0.12s; }
.card:nth-child(5) { animation-delay: 0.16s; }
.card:nth-child(6) { animation-delay: 0.2s; }
@keyframes rise {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.card:hover { box-shadow: 0 6px 18px rgba(16, 24, 40, 0.07); }
.card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.card-head-left { display: flex; align-items: center; gap: 10px; }
.card-icon {
  width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: 17px;
}
.ic-blue { background: #eef6ff; }
.ic-green { background: #e8f7ee; }
.ic-amber { background: #fff7e6; }
.ic-purple { background: #f3eefc; }
.ic-red { background: #fdecec; }
.card-title { margin: 0; font-size: 15px; font-weight: 600; color: #1f2329; }
.card-danger { border-color: #f5cfcf; background: #fffafa; }
.card-danger:hover { box-shadow: 0 6px 18px rgba(234, 67, 53, 0.08); }
.card-danger .card-title { color: #c0341d; }

.state { padding: 34px 0; text-align: center; color: #8a9099; font-size: 13px; }

/* ===== 信息网格 ===== */
.info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.db-grid { grid-template-columns: repeat(2, 1fr); }
.info-tile {
  background: #f7f9fc; border: 1px solid #eef1f6; border-radius: 10px;
  padding: 10px 13px; display: flex; flex-direction: column; gap: 3px;
  min-width: 0; transition: border-color 0.15s, background 0.15s;
}
.info-tile:hover { border-color: #d8e6f7; background: #fbfdff; }
.tile-label { font-size: 12px; color: #8a9099; }
.tile-value { font-size: 13px; font-weight: 600; color: #1f2329; word-break: break-all; line-height: 1.5; }
.mono { font-family: Consolas, 'Courier New', monospace; font-weight: 500; }

/* ===== 状态徽章 ===== */
.badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 12px; border-radius: 999px; font-size: 12px; font-weight: 600;
}
.badge .dot { width: 7px; height: 7px; border-radius: 50%; }
.badge-ok { background: #e8f7ee; color: #19a558; }
.badge-ok .dot { background: #19a558; animation: pulse 1.8s ease-in-out infinite; }
.badge-err { background: #fdecec; color: #ea4335; }
.badge-err .dot { background: #ea4335; }
.badge-danger { background: #fdecec; color: #c0341d; }
@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(25, 165, 88, 0.4); }
  50% { box-shadow: 0 0 0 4px rgba(25, 165, 88, 0); }
}
.db-error {
  margin: 12px 0 0; padding: 9px 12px; border-radius: 8px;
  background: #fff5f5; border: 1px solid #f5c6c2; color: #ea4335; font-size: 12px;
}

/* ===== 目录路径 ===== */
.path-list { display: flex; flex-direction: column; gap: 10px; }
.path-row { display: flex; align-items: center; gap: 12px; }
.path-label { flex: 0 0 92px; font-size: 13px; color: #8a9099; }
.path-value {
  flex: 1 1 auto; min-width: 0; display: block;
  padding: 8px 12px; border-radius: 8px;
  background: #f7f9fc; border: 1px dashed #dfe3e8;
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 12px; color: #4e5969;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.dir-actions { display: flex; align-items: center; gap: 12px; margin-top: 14px; padding-top: 14px; border-top: 1px dashed #eceff3; }
.dir-tip { font-size: 12px; color: #8a9099; }

/* ===== 按钮 ===== */
.btn {
  height: 34px; padding: 0 16px; border-radius: 8px; font-size: 13px;
  cursor: pointer; border: 1px solid #dfe3e8; background: #fff; color: #1f2329;
  transition: all 0.15s;
}
.btn-secondary:hover { border-color: #0d80e0; color: #0d80e0; background: #f5faff; }
.btn-danger { border-color: #c0341d; color: #c0341d; font-weight: 600; }
.btn-danger:hover:not(:disabled) { background: #c0341d; color: #fff; box-shadow: 0 4px 12px rgba(192, 52, 29, 0.25); }
.btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }
.uninstall-tip { margin: 0; font-size: 13px; line-height: 1.8; color: #7a1f1f; }

/* ===== 技术栈与版权 ===== */
.tech-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.chip {
  padding: 4px 14px; border-radius: 999px; font-size: 12px; font-weight: 500;
  color: #0d80e0; background: linear-gradient(135deg, #eef6ff, #e8f7ee);
  border: 1px solid #d8e8f7;
}
.license-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
.license-row { display: flex; gap: 10px; font-size: 13px; line-height: 1.7; align-items: baseline; }
.info-label { color: #8a9099; flex: 0 0 64px; }
.info-value { color: #1f2329; word-break: break-all; }
.link {
  background: none; border: none; padding: 0; color: #0d80e0;
  cursor: pointer; font-size: 13px; font-family: inherit;
}
.link:hover { text-decoration: underline; }
</style>
