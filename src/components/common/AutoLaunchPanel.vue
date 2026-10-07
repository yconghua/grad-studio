<template>
  <div class="panel">
    <div class="panel-head"><span class="panel-title">开机启动</span></div>
    <div class="auto-row">
      <div class="auto-info">
        <p class="auto-title">开机自动启动</p>
        <p class="auto-sub">
          {{ packaged
            ? (enabled ? '已开启：登录 Windows 后将自动启动本程序。' : '默认关闭；开启后登录 Windows 时将自动启动本程序。')
            : '当前为开发模式，该设置仅在打包安装版中生效。' }}
          此设置由系统保存，清除缓存不会影响。
        </p>
      </div>
      <label class="switch">
        <input type="checkbox" :checked="enabled" :disabled="busy" @change="onToggle" />
        <span class="switch-slider"></span>
      </label>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getAutoLaunch, setAutoLaunch } from '../../api'
import { showToast } from '../../composables/useToast'

// 设置页「开机自动启动」：默认关闭，开关状态由操作系统保存（app.setLoginItemSettings），
// 清除缓存不清除；开发模式下设置不真正生效，仅提示
const enabled = ref(false)
const packaged = ref(true)
const busy = ref(false)

onMounted(async () => {
  try {
    const res = await getAutoLaunch()
    if (res && res.success) {
      enabled.value = !!res.enabled
      packaged.value = !!res.packaged
    }
  } catch (e) {
    // 查询失败保持默认关闭态
  }
})

async function onToggle(e) {
  const next = !!e.target.checked
  busy.value = true
  try {
    const res = await setAutoLaunch(next)
    if (res && res.success) {
      enabled.value = !!res.enabled
      packaged.value = !!res.packaged
      showToast(enabled.value ? '已开启开机自动启动' : '已关闭开机自动启动')
    } else {
      e.target.checked = enabled.value
      showToast((res && res.message) || '设置失败，请重试')
    }
  } catch (err) {
    e.target.checked = enabled.value
    showToast('设置失败，请重试')
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.auto-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
}
.auto-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.auto-sub {
  font-size: 12px;
  color: var(--muted);
  margin-top: 4px;
  line-height: 1.6;
}
.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
}
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.switch-slider {
  position: absolute;
  inset: 0;
  border-radius: var(--radius-full);
  background: var(--border-strong);
  transition: background 0.2s;
  cursor: pointer;
}
.switch-slider::before {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  left: 3px;
  top: 3px;
  border-radius: 50%;
  background: var(--bg-card);
  transition: transform 0.2s;
}
.switch input:checked + .switch-slider {
  background: var(--primary);
}
.switch input:checked + .switch-slider::before {
  transform: translateX(20px);
}
.switch input:disabled + .switch-slider {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
