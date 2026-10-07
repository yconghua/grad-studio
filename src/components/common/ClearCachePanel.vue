<template>
  <div class="panel">
    <div class="panel-head"><span class="panel-title">本地缓存</span></div>
    <div class="cache-row">
      <div class="cache-info">
        <p class="cache-title">清空运行缓存</p>
        <p class="cache-sub">仅清除运行缓存（页面加载缓存、临时数据等）；账号历史、列宽、主题、标签页等偏好全部保留，登录状态不受影响</p>
      </div>
      <button class="btn" type="button" :disabled="clearing" @click="onClear">{{ clearing ? '清理中…' : '清空运行缓存' }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { dialogConfirm } from '../../composables/useDialog'
import { showToast } from '../../composables/useToast'
import { clearCache } from '../../api'

// 设置页「清空运行缓存」：白名单清理
// - 保留：账号历史（gra_account_history_001）、主题（gra_theme_mode）、字号（gra_font_scale）、
//   标签页（gra_studio_tabs_v1）、侧栏布局（gra_studio_side_*）、全部列宽（rc-cols- 前缀）
// - 清理：白名单外的其余 localStorage 临时数据 + 主进程 Chromium/HTTP 缓存
// 登录态在 sessionStorage，不在此范围，清除后无需重新登录
const KEEP_KEYS = [
  'gra_account_history_001',
  'gra_theme_mode',
  'gra_font_scale',
  'gra_studio_tabs_v1',
  'gra_studio_side_collapsed',
  'gra_studio_side_width'
]
const KEEP_PREFIXES = ['rc-cols-']

function shouldKeep(key) {
  return KEEP_KEYS.includes(key) || KEEP_PREFIXES.some((p) => key.startsWith(p))
}

const clearing = ref(false)

async function onClear() {
  const ok = await dialogConfirm('将清除运行缓存（页面加载缓存与临时数据），账号、列宽、主题、标签等偏好会保留。确定继续？')
  if (!ok) return
  clearing.value = true
  let removed = 0
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (!shouldKeep(key)) {
        localStorage.removeItem(key)
        removed++
      }
    }
    const res = await clearCache()
    const mainMsg = res && res.success ? (res.message || '') : ''
    showToast(`运行缓存已清除${removed ? `（本地临时数据 ${removed} 项）` : ''}${mainMsg ? '，' + mainMsg : ''}，账号、列宽、主题、标签等偏好已保留`)
  } catch (e) {
    showToast('清除缓存失败，请重试')
  } finally {
    clearing.value = false
  }
}
</script>

<style scoped>
.cache-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
}
.cache-title { font-size: 14px; font-weight: 600; color: var(--text); }
.cache-sub { font-size: 12px; color: var(--muted); margin-top: 4px; line-height: 1.6; }
</style>
