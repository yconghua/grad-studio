<template>
  <div class="panel">
    <div class="panel-head"><span class="panel-title">本地缓存</span></div>
    <div class="cache-row">
      <div class="cache-info">
        <p class="cache-title">清空本地缓存</p>
        <p class="cache-sub">清除列宽、主题、标签页、账号历史等本地偏好；登录状态与业务数据不受影响，列宽等将在下次进入页面时重新生成</p>
      </div>
      <button class="btn" type="button" @click="onClear">清空本地缓存</button>
    </div>
  </div>
</template>

<script setup>
import { dialogConfirm } from '../../composables/useDialog'
import { showToast } from '../../composables/useToast'

// 设置页「清空本地缓存」：只清 localStorage（列宽/主题/标签页/账号历史等可再生的 UI 偏好），
// 登录态在 sessionStorage 不受影响；业务数据在数据库，无需重拉
async function onClear() {
  const ok = await dialogConfirm('将清除列宽、主题、标签页、账号历史等本地偏好，登录状态和业务数据不受影响。确定继续？')
  if (!ok) return
  localStorage.clear()
  showToast('本地缓存已清空，部分显示偏好将在下次进入时重置')
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
