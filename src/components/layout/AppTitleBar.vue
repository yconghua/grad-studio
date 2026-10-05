<template>
  <div class="app-titlebar" @contextmenu.prevent>
    <div class="tb-drag"></div>
    <div class="tb-controls">
      <button class="tb-btn" title="最小化" @click="minimize">
        <MinusOutlined />
      </button>
      <button class="tb-btn" :title="isMaximized ? '还原' : '最大化'" @click="toggleMaximize">
        <svg v-if="!isMaximized" viewBox="0 0 16 16" width="13" height="13" class="tb-icon">
          <rect x="2" y="2.5" width="11.5" height="11.5" fill="none" stroke="currentColor" stroke-width="1.2" />
        </svg>
        <svg v-else viewBox="0 0 16 16" width="13" height="13" class="tb-icon">
          <rect x="3.5" y="4" width="8.5" height="8.5" fill="none" stroke="currentColor" stroke-width="1.2" />
          <path d="M5 4 V3 H13 V11 H12" fill="none" stroke="currentColor" stroke-width="1.2" />
        </svg>
      </button>
      <button class="tb-btn tb-close" title="关闭" @click="closeWin">
        <CloseOutlined />
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
// 无边框窗口的自绘标题栏：拖拽区 + 最小化 / 最大化还原 / 关闭按钮
// 关闭走 win:close，主进程 close 事件按页面决定「登录页退出」或「登录后隐藏到托盘」
import { MinusOutlined, CloseOutlined } from '@ant-design/icons-vue'

const isMaximized = ref(false)
let unsubscribeMax = null

function minimize() {
  if (window.api && window.api.window) window.api.window.minimize()
}

// 最大化 / 还原切换；主进程在状态变化时推送 win:maximized-changed 同步图标
function toggleMaximize() {
  if (window.api && window.api.window) window.api.window.maximize()
}

function closeWin() {
  if (window.api && window.api.window) window.api.window.close()
}

onMounted(() => {
  // 初始化按钮状态 + 订阅最大化变化（双击拖拽区等系统路径同样同步）
  if (window.api && window.api.window) {
    window.api.window.isMaximized().then((res) => {
      if (res && typeof res.maximized === 'boolean') isMaximized.value = res.maximized
    })
    unsubscribeMax = window.api.window.onMaximizedChanged((max) => {
      isMaximized.value = !!max
    })
  }
})

onUnmounted(() => {
  if (unsubscribeMax) unsubscribeMax()
})
</script>

<style scoped>
.app-titlebar {
  height: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  -webkit-app-region: drag;
  user-select: none;
}
.tb-drag {
  flex: 1;
  min-width: 0;
}
.tb-controls {
  display: flex;
  -webkit-app-region: no-drag;
}
.tb-btn {
  width: 44px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-2);
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tb-icon {
  display: block;
}
.tb-btn:hover {
  background: var(--bg-hover);
  color: var(--text);
}
.tb-close:hover {
  background: #e81123;
  color: #fff;
}
</style>
