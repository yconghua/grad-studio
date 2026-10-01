<template>
  <div v-if="visible" class="privacy-overlay">
    <div class="privacy-backdrop" @click="emit('close')"></div>
    <div class="privacy-dialog" role="dialog" aria-modal="true">
      <div class="privacy-head">
        <h3>切换数据库</h3>
        <button type="button" class="privacy-close" @click="emit('close')" aria-label="关闭">×</button>
      </div>
      <div class="privacy-body">
        <p v-if="dbMsg" class="msg" :class="dbMsgOk ? 'ok' : 'err'">{{ dbMsg }}</p>
        <div v-if="dbConnLoading" class="privacy-lead">加载中…</div>
        <div v-else class="conn-list">
          <div
            v-for="c in dbConnections"
            :key="c.id"
            class="conn-item"
            :class="{ active: c.id === dbActive }"
          >
            <div class="conn-main">
              <div class="conn-name">
                {{ c.name }}
                <span v-if="c.id === dbActive" class="conn-badge">当前</span>
              </div>
              <div class="conn-meta">{{ c.host }}:{{ c.port }} · {{ c.database }}</div>
            </div>
            <div class="conn-actions">
              <button
                type="button"
                class="conn-switch"
                :disabled="c.id === dbActive"
                @click="onSwitchDb(c.id)"
              >{{ c.id === dbActive ? '使用中' : '切换' }}</button>
              <button
                type="button"
                class="conn-delete"
                @click="onDeleteDb(c.id)"
              >删除</button>
            </div>
          </div>
        </div>
        <div class="modal-foot">
          <button type="button" class="save-btn ghost" @click="emit('add-db')">+ 添加新数据库</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { getDbConnections, switchDb } from '../../api'

// 切换数据库弹窗（从登录页抽离）：自持连接清单加载与切换操作
// - 切换成功：emit('db-changed') 让基础配置弹窗刷新当前库；并 emit('close') 关闭本弹窗
// - 删除按钮：当前在用的连接需先切换（后端另有「至少保留一个」兜底），通过后 emit('request-delete', id) 交由父组件弹确认框
// - 父组件在删除成功后通过 extMsg / refreshKey 驱动本弹窗刷新与提示
const props = defineProps({
  visible: { type: Boolean, default: false },
  // 外部信号：添加 / 删除数据库成功后递增，本组件监听到后重新加载连接清单
  refreshKey: { type: Number, default: 0 },
  // 外部消息（删除结果等）：由父组件传入，显示在弹窗内的消息行
  extMsg: { type: String, default: '' },
  extMsgOk: { type: Boolean, default: false }
})
const emit = defineEmits(['close', 'add-db', 'db-changed', 'request-delete'])

const dbMsg = ref('')
const dbMsgOk = ref(false)
const dbConnLoading = ref(false)
const dbConnections = ref([])
const dbActive = ref('')

async function loadConnections() {
  dbConnLoading.value = true
  try {
    const res = await getDbConnections()
    if (res && res.success) {
      dbConnections.value = res.list || []
      dbActive.value = res.active
    }
  } catch (e) {
    // 忽略读取异常
  } finally {
    dbConnLoading.value = false
  }
}

// 打开时：清空消息并加载清单
watch(
  () => props.visible,
  (v) => {
    if (v) {
      dbMsg.value = ''
      dbMsgOk.value = false
      loadConnections()
    }
  }
)
// 添加 / 删除数据库成功后由父组件 bump refreshKey 触发刷新
watch(
  () => props.refreshKey,
  () => {
    if (props.visible) loadConnections()
  }
)
// 外部消息（删除结果等）注入到消息行
watch(
  () => props.extMsg,
  (m) => {
    if (m) {
      dbMsg.value = m
      dbMsgOk.value = !!props.extMsgOk
    }
  }
)

// 切换当前生效连接
async function onSwitchDb(id) {
  dbMsg.value = ''
  try {
    const res = await switchDb(id)
    if (res && res.success) {
      dbMsgOk.value = true
      dbMsg.value = res.message || '切换成功'
      dbActive.value = id
      // 通知父组件刷新基础配置里的当前数据库显示，并关闭本弹窗
      emit('db-changed')
      emit('close')
    } else {
      dbMsgOk.value = false
      dbMsg.value = (res && res.message) || '切换失败'
    }
  } catch (e) {
    dbMsgOk.value = false
    dbMsg.value = '切换过程出现异常，请重试'
  }
}

// 删除连接：当前正在使用的需先切换（后端还有「至少保留一个」兜底校验），通过后交父组件弹确认框
function onDeleteDb(id) {
  dbMsg.value = ''
  if (id === dbActive.value) {
    dbMsgOk.value = false
    dbMsg.value = '请先切换到其他连接再删除'
    return
  }
  emit('request-delete', id)
}
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
.privacy-lead {
  font-size: 13px;
  line-height: 1.8;
  color: #4e5969;
  margin: 0 0 8px;
}

/* 连接列表 */
.conn-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 4px 0 14px;
}
.conn-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border: 1px solid #e6e9ee;
  border-radius: 8px;
  background: #fff;
}
.conn-item.active {
  border-color: #0d80e0;
  background: #f3f9ff;
}
.conn-main {
  width: 300px;
}
.conn-name {
  font-size: 14px;
  font-weight: 600;
  color: #1d2129;
}
.conn-badge {
  margin-left: 8px;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 400;
  color: #fff;
  background: #0d80e0;
}
.conn-meta {
  font-size: 12px;
  color: #8a9099;
  margin-top: 2px;
}
/* 操作按钮组：整体靠右（配合 .conn-item 的 space-between，信息靠左、按钮靠右） */
.conn-actions {
  display: flex;
  gap: 10px;
}
.conn-switch {
  height: 32px;
  padding: 0 16px;
  border: none;
  border-radius: 7px;
  background: #0d80e0;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.2s;
}
.conn-switch:hover:not(:disabled) {
  opacity: 0.92;
}
.conn-switch:disabled {
  background: #c9d3df;
  cursor: not-allowed;
}
.conn-delete {
  height: 32px;
  padding: 0 14px;
  border: 1px solid #f3c2bd;
  border-radius: 7px;
  background: #fff;
  color: #ea4335;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}
.conn-delete:hover {
  background: #fdecea;
}

/* 通用消息 + 弹窗底部按钮 */
.msg {
  font-size: 13px;
  margin: 0 0 12px;
}
.msg.ok {
  color: #19a558;
}
.msg.err {
  color: #ea4335;
}
.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin: 18px 18px 10px 0;
}
.save-btn {
  height: 38px;
  padding: 0 22px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}
.save-btn:hover {
  opacity: 0.92;
}
.save-btn.ghost {
  background: #fff;
  color: #0d80e0;
  border: 1px solid #0d80e0;
}
</style>
