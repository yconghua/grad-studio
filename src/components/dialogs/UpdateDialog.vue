<template>
  <div v-if="visible" class="update-overlay">
    <div class="update-backdrop" @click="emit('close')"></div>
    <div class="update-dialog" role="dialog" aria-modal="true">
      <div class="update-head">
        <h3>检查更新</h3>
        <button type="button" class="update-close" @click="emit('close')" aria-label="关闭">×</button>
      </div>
      <div class="update-body">
        <!-- 检查中 -->
        <div v-if="stage === 'checking'" class="update-tip">正在检查更新…</div>

        <!-- 发现新版 -->
        <div v-else-if="stage === 'available'">
          <p class="update-title">发现新版本 v{{ version }}</p>
          <p class="update-desc">当前版本 v{{ currentVersion }}，是否下载并安装新版本？</p>
        </div>

        <!-- 已是最新 -->
        <div v-else-if="stage === 'not-available'">
          <p class="update-title">当前已是最新版本</p>
          <p class="update-desc">v{{ currentVersion }} · 无需更新</p>
        </div>

        <!-- 下载中 -->
        <div v-else-if="stage === 'downloading'">
          <p class="update-title">正在下载更新…</p>
          <div class="progress-track">
            <div class="progress-bar" :style="{ width: percent + '%' }"></div>
          </div>
          <p class="update-desc">{{ percent }}%</p>
        </div>

        <!-- 下载完成 -->
        <div v-else-if="stage === 'downloaded'">
          <p class="update-title">更新包已就绪</p>
          <p class="update-desc">
            重启应用即可完成安装（v{{ version }}）。
            如系统弹出安全提示，可手动运行安装包：
            <span class="file-path">{{ downloadedFile || '应用数据目录 __update__ 下' }}</span>
          </p>
        </div>

        <!-- 安装中 -->
        <div v-else-if="stage === 'installing'">
          <p class="update-title">正在安装，应用将自动重启…</p>
        </div>

        <!-- 错误 -->
        <div v-else-if="stage === 'error'">
          <p class="update-title">更新失败</p>
          <p class="update-desc err">{{ message }}</p>
        </div>
      </div>
      <div class="update-foot">
        <template v-if="stage === 'available'">
          <button type="button" class="save-btn ghost" @click="emit('close')">稍后再说</button>
          <button type="button" class="save-btn" @click="onDownload">下载更新</button>
        </template>
        <template v-else-if="stage === 'downloading'">
          <button type="button" class="save-btn ghost" disabled>下载中…</button>
        </template>
        <template v-else-if="stage === 'downloaded'">
          <button type="button" class="save-btn ghost" @click="emit('close')">稍后</button>
          <button type="button" class="save-btn" @click="onInstall">立即重启安装</button>
        </template>
        <template v-else-if="stage === 'installing'">
          <button type="button" class="save-btn ghost" disabled>安装中…</button>
        </template>
        <template v-else-if="stage === 'error'">
          <button type="button" class="save-btn ghost" @click="emit('close')">关闭</button>
          <button type="button" class="save-btn" @click="onCheck">重试</button>
        </template>
        <template v-else>
          <button type="button" class="save-btn" @click="emit('close')">关闭</button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { checkUpdate, downloadUpdate, installUpdate, getUpdateState, onUpdateEvent, getIntroduction } from '../../api'

// 更新弹窗：打开即检查（或恢复上一次未完成的更新状态），跟随主进程 update:event 推送推进状态
const props = defineProps({
  visible: { type: Boolean, default: false }
})
const emit = defineEmits(['close'])

const stage = ref('idle')
const version = ref('')
const percent = ref(0)
const downloadedFile = ref('')
const message = ref('')
const currentVersion = ref('')

let offEvent = null

// 当前版本号（系统简介接口所有登录角色可用）
async function loadCurrentVersion() {
  try {
    const res = await getIntroduction()
    if (res && res.success && res.data && res.data.version) {
      currentVersion.value = res.data.version
    }
  } catch (e) {
    // 版本号获取失败不影响更新流程展示
  }
}

// 应用主进程推送的更新事件
function applyEvent(ev) {
  if (!ev || !ev.type) return
  const d = ev.data || {}
  stage.value = ev.type
  if (ev.type === 'available' || ev.type === 'downloaded') version.value = d.version || version.value
  if (ev.type === 'downloaded') downloadedFile.value = d.downloadedFile || ''
  if (ev.type === 'downloading') percent.value = Number(d.percent) || 0
  if (ev.type === 'error') message.value = d.message || '检查更新失败，请稍后重试'
}

async function onCheck() {
  stage.value = 'checking'
  try {
    const res = await checkUpdate()
    if (res && res.success && res.data && res.data.stage && res.data.stage !== 'checking') {
      stage.value = res.data.stage
      if (res.data.message) message.value = res.data.message
    }
  } catch (e) {
    stage.value = 'error'
    message.value = '检查更新失败，请稍后重试'
  }
}

async function onDownload() {
  try {
    await downloadUpdate()
  } catch (e) {
    stage.value = 'error'
    message.value = '下载更新失败，请稍后重试'
  }
}

async function onInstall() {
  try {
    await installUpdate()
  } catch (e) {
    stage.value = 'error'
    message.value = '安装失败，请重试'
  }
}

// 打开弹窗：加载当前版本号，先恢复主进程侧的更新状态（已有新版/已下载完成时不重复检查）
watch(
  () => props.visible,
  async (v) => {
    if (!v) return
    loadCurrentVersion()
    try {
      const res = await getUpdateState()
      const s = res && res.success ? res.data : null
      if (s && s.stage && s.stage !== 'idle' && s.stage !== 'checking') {
        stage.value = s.stage
        version.value = s.version || ''
        percent.value = s.percent || 0
        downloadedFile.value = s.downloadedFile || ''
        message.value = s.message || ''
        return
      }
    } catch (e) {
      // 状态查询失败继续走检查流程
    }
    onCheck()
  }
)

onMounted(() => {
  offEvent = onUpdateEvent(applyEvent)
})
onBeforeUnmount(() => {
  if (offEvent) offEvent()
})
</script>

<style scoped>
.update-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.update-backdrop {
  position: absolute;
  inset: 0;
  background: var(--mask);
}
.update-dialog {
  position: relative;
  z-index: 1;
  width: 460px;
  max-width: 92vw;
  max-height: 80vh;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
}
.update-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid var(--border-light);
}
.update-head h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
}
.update-close {
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
.update-close:hover {
  background: var(--border);
}
.update-body {
  padding: 20px 22px;
  overflow-y: auto;
}
.update-tip {
  font-size: 14px;
  color: var(--text-2);
  padding: 8px 0;
}
.update-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 8px;
}
.update-desc {
  font-size: 13px;
  line-height: 1.8;
  color: var(--text-2);
  margin: 0;
  word-break: break-all;
}
.update-desc.err {
  color: var(--danger);
}
.file-path {
  font-family: Consolas, Menlo, monospace;
  font-size: 12px;
  color: var(--text);
  background: var(--gray-soft);
  border-radius: 4px;
  padding: 1px 6px;
}
.progress-track {
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--gray-soft);
  overflow: hidden;
  margin: 12px 0 8px;
}
.progress-bar {
  height: 100%;
  border-radius: var(--radius-full);
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
  transition: width 0.2s;
}
.update-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin: 14px 18px 10px 0;
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
  opacity: 0.55;
  cursor: default;
}
.save-btn.ghost {
  background: var(--bg-card);
  color: var(--primary);
  border: 1px solid var(--primary);
}
</style>
