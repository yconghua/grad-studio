<template>
  <div v-if="visible" class="privacy-overlay">
    <div class="privacy-backdrop" @click="emit('close')"></div>
    <div class="privacy-dialog" role="dialog" aria-modal="true">
      <div class="privacy-head">
        <h3>基础配置</h3>
        <button type="button" class="privacy-close" @click="emit('close')" aria-label="关闭">×</button>
      </div>
      <div class="privacy-body">
        <div class="sys-info-list">
          <div class="sys-info-row">
            <span class="sys-info-key">系统名称</span>
            <span class="sys-info-val">{{ sysName }}</span>
          </div>
          <div class="sys-info-row">
            <span class="sys-info-key">版本号</span>
            <span class="sys-info-val">{{ sysVersion }}</span>
          </div>
          <div class="sys-info-row">
            <span class="sys-info-key">当前数据库</span>
            <span class="sys-info-val">
              {{ dbName }}
              <span class="db-status" :class="dbStatus === 'connected' ? 'ok' : 'err'">{{ dbStatus === 'connected' ? '已连接' : '未连接' }}</span>
            </span>
          </div>
        </div>
        <div class="sys-info-actions">
          <button type="button" class="sys-btn" @click="emit('switch-db')">切换数据库</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { getDbInfo } from '../../api'
import pkg from '../../../package.json'

// 基础配置弹窗（从登录页抽离）：自持「程序名称 / 版本号 / 当前数据库」展示
// 父组件通过 visible 控制显隐；切换数据库后由父组件 bump refreshKey 触发刷新。
const props = defineProps({
  visible: { type: Boolean, default: false },
  // 外部信号：切换数据库成功后递增，本组件监听到后重新读取当前数据库信息
  refreshKey: { type: Number, default: 0 }
})
const emit = defineEmits(['close', 'switch-db'])

// 程序名称 / 版本号：实时读取 package.json（非前端写死；改 package.json 后重新构建即生效）
const sysName = (pkg.build && pkg.build.productName) || pkg.name
const sysVersion = pkg.version
// 当前数据库：打开弹窗时直接从后端读取（后端已放开登录守卫，无需登录即可显示）
const dbName = ref('')
const dbStatus = ref('')

async function loadDbInfo() {
  dbName.value = '加载中…'
  dbStatus.value = ''
  try {
    const res = await getDbInfo()
    if (res && res.success) {
      dbName.value = res.database
      dbStatus.value = res.status
    } else {
      dbName.value = '读取失败'
    }
  } catch (e) {
    dbName.value = '读取失败'
  }
}

// 打开时加载；切换成功后由父组件 bump refreshKey 触发刷新
watch(
  () => props.visible,
  (v) => {
    if (v) loadDbInfo()
  }
)
watch(
  () => props.refreshKey,
  () => {
    if (props.visible) loadDbInfo()
  }
)
</script>

<style scoped>
.privacy-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.privacy-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
}
.privacy-dialog {
  position: relative;
  z-index: 1;
  width: 560px;
  max-width: 92vw;
  max-height: 80vh;
  background: #fff;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
}
.privacy-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid #eceff3;
}
.privacy-head h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #1d2129;
}
.privacy-close {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: #f2f3f5;
  color: #4e5969;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.2s;
}
.privacy-close:hover {
  background: #e5e6eb;
}
.privacy-body {
  padding: 18px 22px;
  overflow-y: auto;
}

/* 基础配置：竖排信息列表 */
.sys-info-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 0;
}
.sys-info-row {
  display: flex;
  align-items: flex-start;
  padding: 12px 2px;
  border-bottom: 1px solid #f2f4f7;
  font-size: 14px;
}
.sys-info-row:last-child {
  border-bottom: none;
}
.sys-info-key {
  flex: 0 0 96px;
  color: #8a9099;
}
.sys-info-val {
  flex: 1;
  color: #1d2129;
  font-weight: 500;
  word-break: break-all;
}

/* 状态标签与操作按钮 */
.db-status {
  margin-left: 8px;
  font-size: 12px;
  font-weight: 400;
}
.db-status.ok {
  color: #19a558;
}
.db-status.err {
  color: #ea4335;
}
.sys-info-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}
.sys-btn {
  height: 36px;
  padding: 0 16px;
  border: none;
  border-radius: 8px;
  background: #0d80e0;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}
.sys-btn:hover {
  opacity: 0.92;
}
</style>
