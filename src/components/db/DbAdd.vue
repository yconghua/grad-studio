<template>
  <div v-if="visible" class="privacy-overlay">
    <div class="privacy-backdrop" @click="emit('close')"></div>
    <div class="privacy-dialog" role="dialog" aria-modal="true">
      <div class="privacy-head">
        <h3>添加新 MySQL 数据库</h3>
        <button type="button" class="privacy-close" @click="emit('close')" aria-label="关闭">×</button>
      </div>
      <div class="privacy-body">
        <p class="privacy-lead">填写目标 MySQL 连接信息，提交后将自动测试连通性并保存。</p>
        <div class="form-row">
          <label class="field-label">名称 *</label>
          <input v-model="addForm.name" class="field-input" type="text" placeholder="如：公司服务器" />
        </div>
        <div class="form-row">
          <label class="field-label">主机 *</label>
          <input v-model="addForm.host" class="field-input" type="text" placeholder="如：rm-xxx.rds.aliyuncs.com 或 localhost" />
        </div>
        <div class="form-row">
          <label class="field-label">端口</label>
          <input v-model="addForm.port" class="field-input" type="text" placeholder="3306" />
        </div>
        <div class="form-row">
          <label class="field-label">账号 *</label>
          <input v-model="addForm.user" class="field-input" type="text" placeholder="数据库账号" />
        </div>
        <div class="form-row">
          <label class="field-label">密码</label>
          <input v-model="addForm.password" class="field-input" type="password" placeholder="可为空" />
        </div>
        <div class="form-row">
          <label class="field-label">数据库名 *</label>
          <input v-model="addForm.database" class="field-input" type="text" placeholder="如：gra_studio" />
        </div>
        <p v-if="addDbMsg" class="msg" :class="addDbOk ? 'ok' : 'err'">{{ addDbMsg }}</p>
      </div>
      <div class="modal-foot">
        <button type="button" class="save-btn ghost" @click="emit('close')">取消</button>
        <button type="button" class="save-btn" :disabled="addDbLoading" @click="onSubmitAddDb">{{ addDbLoading ? '测试中…' : '添加' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { addDb } from '../../api'

// 添加新数据库弹窗（从登录页抽离）：自持表单与提交
// 提交成功：emit('added') 让父组件刷新切换弹窗的连接清单，并 emit('close') 关闭本弹窗
const props = defineProps({
  visible: { type: Boolean, default: false }
})
const emit = defineEmits(['close', 'added'])

const addForm = ref({ name: '', host: '', port: '3306', user: '', password: '', database: '' })
const addDbMsg = ref('')
const addDbOk = ref(false)
const addDbLoading = ref(false)

// 打开时重置表单
watch(
  () => props.visible,
  (v) => {
    if (v) {
      addForm.value = { name: '', host: '', port: '3306', user: '', password: '', database: '' }
      addDbMsg.value = ''
      addDbOk.value = false
    }
  }
)

// 提交新增连接
async function onSubmitAddDb() {
  addDbMsg.value = ''
  const f = addForm.value
  if (!f.name.trim() || !f.host.trim() || !f.user.trim() || !f.database.trim()) {
    addDbMsg.value = '请填写名称、主机、账号与数据库名'
    addDbOk.value = false
    return
  }
  addDbLoading.value = true
  try {
    const res = await addDb({
      name: f.name.trim(),
      host: f.host.trim(),
      port: f.port ? Number(f.port) : 3306,
      user: f.user.trim(),
      password: f.password,
      database: f.database.trim()
    })
    if (res && res.success) {
      addDbOk.value = true
      addDbMsg.value = res.message || '添加成功'
      // 通知父组件刷新连接清单，并关闭本弹窗
      emit('added')
      emit('close')
    } else {
      addDbOk.value = false
      addDbMsg.value = (res && res.message) || '添加失败'
    }
  } catch (e) {
    addDbOk.value = false
    addDbMsg.value = '添加过程出现异常，请重试'
  } finally {
    addDbLoading.value = false
  }
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

/* 表单 */
.form-row {
  margin-bottom: 14px;
}
.field-label {
  display: block;
  font-size: 13px;
  color: #4e5969;
  margin-bottom: 6px;
}
.field-input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  font-size: 14px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
  background: #fff;
}
.field-input:focus {
  border-color: #0d80e0;
}
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
.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.save-btn.ghost {
  background: #fff;
  color: #0d80e0;
  border: 1px solid #0d80e0;
}
</style>
