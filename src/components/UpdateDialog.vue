<template>
  <div class="update-mask">
    <div class="update-box">
      <h3 class="update-title">{{ titleText }}</h3>

      <!-- 状态行 -->
      <div class="update-status">
        <span class="status-icon" :class="'st-' + status">{{ statusIcon }}</span>
        <span class="status-text">{{ statusText }}</span>
      </div>

      <!-- 当前更新源 -->
      <div v-if="source" class="source-line">更新源：{{ source }}</div>

      <!-- 下载进度 -->
      <div v-if="status === 'downloading'" class="progress-area">
        <div class="progress-track">
          <div class="progress-bar" :style="{ width: progress + '%' }"></div>
        </div>
        <div class="progress-meta">
          <span>{{ progress }}%</span>
          <span>已下载 {{ fmtBytes(transferred) }} / {{ fmtBytes(total) }}</span>
          <span v-if="speed > 0">速度 {{ fmtBytes(speed) }}/s</span>
          <span v-if="eta != null">剩余 {{ fmtEta(eta) }}</span>
        </div>
      </div>

      <!-- 版本信息 -->
      <div v-if="status === 'available' || status === 'downloading' || status === 'downloaded'" class="version-line">
        最新版本 <b>v{{ latest }}</b>，下载完成后一键安装
      </div>

      <!-- 错误信息 -->
      <div v-if="status === 'error'" class="error-box">{{ message || '未知错误' }}</div>

      <!-- 按钮 -->
      <div class="update-actions">
        <button v-if="status === 'downloaded'" class="btn btn-primary" @click="$emit('install')">立即重启安装</button>
        <button v-if="status === 'error'" class="btn btn-primary" @click="$emit('retry')">重试</button>
        <button v-else class="btn btn-secondary" @click="$emit('close')">{{ closeLabel }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { onUpdateState } from '../api'

// 打开弹窗时由父组件传入当前状态快照做初始值；此后由 update:state 订阅实时刷新
const props = defineProps({
  snapshot: { type: Object, default: () => ({}) }
})
const emit = defineEmits(['close', 'retry', 'install'])

const status = ref('idle')
const progress = ref(0)
const latest = ref('')
const message = ref('')
const speed = ref(0)
const eta = ref(null)
const transferred = ref(0)
const total = ref(0)
const source = ref('')
let offUpdateState = null

function apply(p) {
  if (!p) return
  status.value = p.status || 'idle'
  progress.value = Number(p.progress) || 0
  if (p.latest) latest.value = p.latest
  if (p.message) message.value = p.message
  speed.value = Number(p.speed) || 0
  eta.value = p.eta != null ? Number(p.eta) : null
  transferred.value = Number(p.transferred) || 0
  total.value = Number(p.total) || 0
  if (p.source) source.value = p.source
}

function handleState(payload) {
  apply(payload)
}

onMounted(() => {
  apply(props.snapshot)
  offUpdateState = onUpdateState(handleState)
})
onUnmounted(() => {
  if (offUpdateState) offUpdateState()
})

// 各状态下的标题 / 图标 / 文案
const titleText = computed(() => {
  if (status.value === 'downloading') return `正在下载 v${latest.value || ''}`
  if (status.value === 'downloaded') return '更新就绪'
  if (status.value === 'error') return '更新失败'
  if (status.value === 'checking') return '检查更新'
  if (status.value === 'available') return `发现新版本 v${latest.value || ''}`
  if (status.value === 'installing') return '正在安装更新'
  return '检查更新'
})
const statusIcon = computed(() => {
  if (status.value === 'downloading' || status.value === 'checking') return '⋯'
  if (status.value === 'downloaded') return '✓'
  if (status.value === 'error') return '!'
  if (status.value === 'available') return '↓'
  return '✓'
})
const statusText = computed(() => {
  const map = {
    checking: '正在检查更新…',
    available: '发现新版本，正在准备下载',
    downloading: '正在下载更新包，请稍候',
    downloaded: '新版本已下载完成，点击安装后自动重启',
    installing: '正在安装并重启应用…',
    error: '更新过程中出现问题',
    idle: '当前已是最新版本'
  }
  return map[status.value] || '检查更新'
})
const closeLabel = computed(() => {
  if (status.value === 'downloading' || status.value === 'checking') return '后台继续，先关闭'
  if (status.value === 'idle') return '知道了'
  return '关闭'
})

// 字节格式化：B / KB / MB / GB
function fmtBytes(n) {
  if (!n || n <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`
}

// 剩余秒数格式化：x小时y分 / x分y秒 / x秒
function fmtEta(sec) {
  if (sec == null || !isFinite(sec)) return '--'
  sec = Math.max(0, Math.round(sec))
  if (sec >= 3600) return `${Math.floor(sec / 3600)}小时${Math.floor((sec % 3600) / 60)}分`
  if (sec >= 60) return `${Math.floor(sec / 60)}分${sec % 60}秒`
  return `${sec}秒`
}
</script>

<style scoped>
.update-mask {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6);
  display: flex; align-items: center; justify-content: center; z-index: 200;
}
.update-box {
  width: 420px; background: #fff; border-radius: 12px; padding: 24px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}
.update-title { margin: 0 0 16px; font-size: 16px; color: #1f2329; }
.update-status { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.status-icon {
  width: 24px; height: 24px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; color: #fff; flex-shrink: 0;
}
.status-icon.st-checking, .status-icon.st-available, .status-icon.st-downloading { background: #0d80e0; }
.status-icon.st-downloaded, .status-icon.st-idle { background: #19a558; }
.status-icon.st-error { background: #ea4335; }
.status-text { font-size: 14px; color: #1f2329; }
.source-line { font-size: 12px; color: #86909c; margin-bottom: 12px; }

.progress-area { margin: 8px 0 4px; }
.progress-track {
  height: 8px; background: #eceff3; border-radius: 999px; overflow: hidden;
}
.progress-bar {
  height: 100%; background: linear-gradient(90deg, #0d80e0, #19a558);
  border-radius: 999px; transition: width 0.3s;
}
.progress-meta {
  display: flex; flex-wrap: wrap; gap: 8px 14px;
  margin-top: 8px; font-size: 12px; color: #4e5969;
}

.version-line { font-size: 13px; color: #4e5969; margin-top: 12px; }
.version-line b { color: #0d80e0; }
.error-box {
  margin-top: 12px; background: #fff5f5; border-radius: 8px;
  padding: 10px 12px; font-size: 13px; color: #ea4335; word-break: break-all;
}
.update-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px; }
.btn {
  height: 34px; padding: 0 16px; border-radius: 8px; font-size: 13px; cursor: pointer;
  border: 1px solid #dfe3e8; background: #fff; color: #1f2329;
}
.btn-primary {
  background: linear-gradient(135deg, #0d80e0, #19a558); border: none; color: #fff; font-weight: 600;
}
.btn-secondary:hover { border-color: #0d80e0; color: #0d80e0; }
</style>
