<template>
  <div class="app-titlebar" @contextmenu.prevent>
    <div class="tb-drag"></div>
    <div class="tb-controls">
      <button class="tb-btn" title="最小化" @click="minimize">
        <MinusOutlined />
      </button>
      <button class="tb-btn tb-close" title="关闭" @click="closeWin">
        <CloseOutlined />
      </button>
    </div>
  </div>
</template>

<script setup>
// 无边框窗口的自绘标题栏：拖拽区 + 最小化 / 关闭按钮
// 关闭走 win:close，主进程 close 事件按页面决定「登录页退出」或「登录后隐藏到托盘」
import { MinusOutlined, CloseOutlined } from '@ant-design/icons-vue'

function minimize() {
  if (window.api && window.api.window) window.api.window.minimize()
}

function closeWin() {
  if (window.api && window.api.window) window.api.window.close()
}
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
.tb-btn:hover {
  background: var(--bg-hover);
  color: var(--text);
}
.tb-close:hover {
  background: #e81123;
  color: #fff;
}
</style>
