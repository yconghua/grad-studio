<template>
  <div class="page">
    <h3 class="title">版本更新</h3>

    <!-- 版本信息（原有保留） -->
    <div class="card">
      <div class="row"><span class="k">系统名称</span><span class="v">{{ info.name || '-' }}</span></div>
      <div class="row"><span class="k">当前版本</span><span class="v">{{ info.version || '-' }}</span></div>
      <div class="row"><span class="k">发布日期</span><span class="v">{{ info.releaseDate || '-' }}</span></div>
      <div class="row"><span class="k">运行环境</span><span class="v">{{ info.platform || '-' }}</span></div>
      <div class="row"><span class="k">Node 版本</span><span class="v">{{ info.nodeVersion || '-' }}</span></div>
      <div class="row"><span class="k">Electron</span><span class="v">{{ info.electronVersion || '-' }}</span></div>
    </div>

    <!-- 检查更新（原有保留） -->
    <button class="btn btn-primary check-btn" @click="check" :disabled="checking">
      {{ checking ? '检查中…' : '检查更新' }}
    </button>

    <p v-if="msg" class="msg" :class="msgOk ? 'ok' : 'err'">{{ msg }}</p>

    <div v-if="result && result.hasUpdate" class="update-box">
      <p class="update-title">发现新版本 v{{ result.latest }}</p>
      <p class="update-notes">{{ result.notes }}</p>
      <a class="btn btn-primary link" :href="result.url" target="_blank" rel="noopener noreferrer">前往下载</a>
    </div>
    <p v-else-if="result && result.success" class="msg ok">当前已是最新版本。</p>

    <!-- 当前数据库（只读展示，不切换） -->
    <div class="card db-card">
      <div class="row"><span class="k">数据库主机</span><span class="v">{{ dbInfo.host || '-' }}</span></div>
      <div class="row"><span class="k">端口</span><span class="v">{{ dbInfo.port || '-' }}</span></div>
      <div class="row"><span class="k">数据库名</span><span class="v">{{ dbInfo.database || '-' }}</span></div>
      <div class="row"><span class="k">账号</span><span class="v">{{ dbInfo.user || '-' }}</span></div>
      <div class="row"><span class="k">连接状态</span>
        <span class="v">
          <span v-if="dbInfo.status === 'connected'" class="tag tag-ok">已连接</span>
          <span v-else class="tag tag-err">未连接</span>
          <span v-if="dbInfo.error" class="db-err">（{{ dbInfo.error }}）</span>
        </span>
      </div>
    </div>

    <!-- 开发者工具 / 清理缓存 -->
    <div class="tools">
      <button class="btn" @click="openDev" :disabled="devBusy">打开开发者工具</button>
      <button class="btn" @click="cleanCache" :disabled="cacheBusy">{{ cacheBusy ? '清理中…' : '清理缓存' }}</button>
      <button class="btn" @click="reloadDbInfo" :disabled="dbBusy">刷新数据库信息</button>
    </div>
    <p v-if="toolMsg" class="msg" :class="toolMsgOk ? 'ok' : 'err'">{{ toolMsg }}</p>

    <!-- 开发者链接 -->
    <div class="card links-card">
      <div class="row"><span class="k">开发者主页</span><a class="v link" :href="DEV_GITHUB" target="_blank" rel="noopener noreferrer">{{ DEV_GITHUB }}</a></div>
      <div class="row"><span class="k">代码仓库</span><a class="v link" :href="REPO_URL" target="_blank" rel="noopener noreferrer">{{ REPO_URL }}</a></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getSysInfo, checkForUpdates, getDbInfo, openDevTools, clearCache } from '../../api'

// 开发者信息：与 electron/ipc/sys.js 的 UPDATE_REPO 保持一致
const DEV_GITHUB = 'https://github.com/yconghua'
const REPO_URL = 'https://github.com/yconghua/grad-studio'

const info = ref({})
const dbInfo = ref({})
const checking = ref(false)
const msg = ref('')
const msgOk = ref(true)
const result = ref(null)
const toolMsg = ref('')
const toolMsgOk = ref(true)
const devBusy = ref(false)
const cacheBusy = ref(false)
const dbBusy = ref(false)

onMounted(async () => {
  try {
    const res = await getSysInfo()
    if (res && res.success) info.value = res
  } catch (e) {
    // 忽略
  }
  await loadDbInfo()
})

async function loadDbInfo() {
  dbBusy.value = true
  try {
    const res = await getDbInfo()
    if (res && res.success) dbInfo.value = res
  } catch (e) {
    // 忽略
  } finally {
    dbBusy.value = false
  }
}

async function reloadDbInfo() {
  toolMsg.value = ''
  await loadDbInfo()
  showTool('数据库信息已刷新', true)
}

function showTool(text, ok) {
  toolMsg.value = text
  toolMsgOk.value = ok
}

async function check() {
  checking.value = true
  msg.value = ''
  result.value = null
  try {
    const res = await checkForUpdates()
    if (res && res.success) {
      result.value = res
      msgOk.value = true
    } else {
      msgOk.value = false
      msg.value = (res && res.message) || '检查失败'
    }
  } catch (e) {
    msgOk.value = false
    msg.value = '检查过程出现异常，请重试'
  } finally {
    checking.value = false
  }
}

async function openDev() {
  devBusy.value = true
  toolMsg.value = ''
  try {
    const res = await openDevTools()
    showTool((res && res.message) || '已打开开发者工具', !!(res && res.success))
  } catch (e) {
    showTool('打开开发者工具出现异常，请重试', false)
  } finally {
    devBusy.value = false
  }
}

async function cleanCache() {
  cacheBusy.value = true
  toolMsg.value = ''
  try {
    const res = await clearCache()
    showTool((res && res.message) || '缓存已清理', !!(res && res.success))
  } catch (e) {
    showTool('清理缓存出现异常，请重试', false)
  } finally {
    cacheBusy.value = false
  }
}
</script>

<style scoped>
.page {
  background: #fff;
  border: 1px solid #eceff3;
  border-radius: 12px;
  padding: 20px 22px;
}
.title {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
}
.card {
  border: 1px solid #eceff3;
  border-radius: 10px;
  padding: 8px 16px;
  margin-bottom: 16px;
}
.db-card {
  margin-top: 16px;
}
.links-card {
  margin-top: 16px;
}
.row {
  display: flex;
  padding: 8px 0;
  border-bottom: 1px solid #f0f2f5;
  font-size: 13px;
}
.row:last-child {
  border-bottom: none;
}
.k {
  width: 90px;
  color: #8a9099;
  flex-shrink: 0;
}
.v {
  color: #1f2329;
  word-break: break-all;
}
.check-btn {
  height: 36px;
}
.btn {
  padding: 0 16px;
  font-size: 13px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  background: #fff;
  color: #4e5969;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  height: 34px;
  margin-right: 10px;
}
.btn:disabled {
  opacity: 0.6;
}
.btn-primary {
  border: none;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  color: #fff;
  font-weight: 600;
}
.link {
  margin-top: 0;
  color: #0d80e0;
}
.tools {
  display: flex;
  flex-wrap: wrap;
}
.msg {
  margin: 12px 0 0;
  font-size: 13px;
}
.msg.ok {
  color: #19a558;
}
.msg.err {
  color: #ea4335;
}
.tag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 4px;
  font-size: 12px;
}
.tag-ok {
  background: #e6f7ef;
  color: #19a558;
}
.tag-err {
  background: #fdeaea;
  color: #ea4335;
}
.db-err {
  margin-left: 6px;
  color: #ea4335;
}
.update-box {
  margin-top: 16px;
  padding: 16px;
  border: 1px solid #19a558;
  border-radius: 10px;
  background: #f4fbf7;
}
.update-title {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
  color: #19a558;
}
.update-notes {
  margin: 0 0 8px;
  font-size: 13px;
  color: #4e5969;
  white-space: pre-wrap;
}
</style>
