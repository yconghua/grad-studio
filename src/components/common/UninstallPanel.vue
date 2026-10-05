<template>
  <div class="panel">
    <div class="panel-head"><span class="panel-title">卸载程序</span></div>
    <div class="uninstall-row">
      <div class="uninstall-info">
        <p class="uninstall-title">卸载 Grad Studio</p>
        <p class="uninstall-sub">
          {{ available
            ? '卸载并删除本程序（安装目录内文件）。你的数据（账号记忆、缓存、业务数据）将保留，不会一并删除。'
            : '当前为开发模式，无卸载入口；打包安装版可在本页执行卸载。' }}
        </p>
      </div>
      <button class="btn btn-danger" type="button" :disabled="!available" @click="onUninstall">卸载程序</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { dialogConfirm } from '../../composables/useDialog'
import { showToast } from '../../composables/useToast'

// 设置页「卸载程序」：仅打包安装版可用（NSIS 卸载器存在时）。
// 卸载只删安装目录文件，用户数据（记住我/缓存/业务数据）保留；
// 开发模式（npm run dev）下无卸载器，按钮置灰，不提供伪卸载避免误删开发目录
const available = ref(false)

onMounted(async () => {
  try {
    const res = await window.api.sys.uninstallAvailable()
    if (res && res.success) available.value = !!res.available
  } catch (e) {
    // 探测失败保持禁用
  }
})

async function onUninstall() {
  const ok = await dialogConfirm('卸载将删除本程序及安装目录内文件，你的数据会保留。确定继续？')
  if (!ok) return
  try {
    const res = await window.api.sys.uninstallApp()
    if (res && res.success) {
      showToast(res.message || '正在启动卸载程序…')
    } else {
      showToast((res && res.message) || '卸载失败，请重试')
    }
  } catch (e) {
    showToast('卸载失败，请重试')
  }
}
</script>

<style scoped>
.uninstall-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
}
.uninstall-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.uninstall-sub {
  font-size: 12px;
  color: var(--muted);
  margin-top: 4px;
  line-height: 1.6;
}
.btn-danger {
  flex-shrink: 0;
  border-color: #ffa39e;
  background: #fff1f0;
  color: #cf1322;
}
.btn-danger:hover:not(:disabled) {
  border-color: #ff7875;
  color: #a8071a;
  background: #ffccc7;
}
</style>
