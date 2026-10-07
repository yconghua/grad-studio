<template>
  <div v-if="visible" class="privacy-overlay">
    <div class="privacy-backdrop" @click="emit('close')"></div>
    <div class="privacy-dialog" role="dialog" aria-modal="true">
      <div class="privacy-head">
        <h3>编辑数据库连接</h3>
        <button type="button" class="privacy-close" @click="emit('close')" aria-label="关闭">×</button>
      </div>
      <div class="privacy-body">
        <p class="privacy-lead">修改连接信息后保存，将自动测试连通性；密码留空表示不修改原密码。</p>
        <div class="form-row">
          <label class="field-label">名称 <span class="req">*</span></label>
          <input v-model="form.name" class="field-input" type="text" placeholder="如：公司服务器" />
        </div>
        <div class="form-row">
          <label class="field-label">主机 <span class="req">*</span></label>
          <input v-model="form.host" class="field-input" type="text" placeholder="如：rm-xxx.rds.aliyuncs.com 或 localhost" />
        </div>
        <div class="form-row">
          <label class="field-label">端口</label>
          <input v-model="form.port" class="field-input" type="text" placeholder="3306" />
        </div>
        <div class="form-row">
          <label class="field-label">账号 <span class="req">*</span></label>
          <input v-model="form.user" class="field-input" type="text" placeholder="数据库账号" />
        </div>
        <div class="form-row">
          <label class="field-label">密码</label>
          <input v-model="form.password" class="field-input" type="password" :placeholder="hasPassword ? '留空则不修改（已设置）' : '可为空'" />
        </div>
        <div class="form-row">
          <label class="field-label">数据库名 <span class="req">*</span></label>
          <input v-model="form.database" class="field-input" type="text" placeholder="如：gra_studio" />
        </div>
        <p v-if="msg" class="msg" :class="msgOk ? 'ok' : 'err'">{{ msg }}</p>
      </div>
      <div class="modal-foot">
        <button type="button" class="save-btn ghost" @click="emit('close')">取消</button>
        <button type="button" class="save-btn" :disabled="saving" @click="onSubmit">{{ saving ? '保存中…' : '保存' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { updateDb } from '../../api'

// 编辑数据库连接弹窗：表单回填该连接现有配置，保存走 updateDb；
// 密码留空表示不修改（placeholder 提示）；保存成功后 emit('updated') 由父组件刷新列表
const props = defineProps({
  visible: { type: Boolean, default: false },
  connection: { type: Object, default: null }
})
const emit = defineEmits(['close', 'updated'])

const form = ref({ name: '', host: '', port: '3306', user: '', password: '', database: '' })
const hasPassword = ref(false)
const msg = ref('')
const msgOk = ref(false)
const saving = ref(false)

// 打开时回填连接配置；密码不回显，仅提示是否已设置
watch(
  () => props.visible,
  (v) => {
    if (!v) return
    const c = props.connection || {}
    form.value = {
      name: c.name || '',
      host: c.host || '',
      port: c.port != null ? String(c.port) : '3306',
      user: c.user || '',
      password: '',
      database: c.database || ''
    }
    hasPassword.value = !!c.hasPassword
    msg.value = ''
    msgOk.value = false
  }
)

async function onSubmit() {
  msg.value = ''
  const f = form.value
  if (!f.name.trim() || !f.host.trim() || !f.user.trim() || !f.database.trim()) {
    msg.value = '请填写名称、主机、账号与数据库名'
    msgOk.value = false
    return
  }
  saving.value = true
  try {
    const id = props.connection && props.connection.id
    const res = await updateDb(id, {
      name: f.name.trim(),
      host: f.host.trim(),
      port: f.port ? Number(f.port) : 3306,
      user: f.user.trim(),
      password: f.password,
      database: f.database.trim()
    })
    if (res && res.success) {
      msgOk.value = true
      msg.value = res.message || '保存成功'
      emit('updated')
      emit('close')
    } else {
      msgOk.value = false
      msg.value = (res && res.message) || '保存失败'
    }
  } catch (e) {
    msgOk.value = false
    msg.value = '保存过程出现异常，请重试'
  } finally {
    saving.value = false
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
  background: var(--mask);
}
.privacy-dialog {
  position: relative;
  z-index: 1;
  width: 560px;
  max-width: calc(92vw / var(--app-font-zoom, 1));
  max-height: calc(80vh / var(--app-font-zoom, 1));
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
}
.privacy-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid var(--border-light);
}
.privacy-head h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
}
.privacy-close {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--gray-soft);
  color: var(--text-2);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.2s;
}
.privacy-close:hover {
  background: var(--border);
}
.privacy-body {
  padding: 18px 22px;
  overflow-y: auto;
}
.privacy-lead {
  font-size: 13px;
  line-height: 1.8;
  color: var(--text-2);
  margin: 0 0 8px;
}
.form-row {
  margin-bottom: 14px;
}
.field-label {
  display: block;
  font-size: 13px;
  color: var(--text-2);
  margin-bottom: 6px;
}
.req { color: var(--danger); }
.field-input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  font-size: 14px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
  background: var(--bg-card);
}
.field-input:focus {
  border-color: var(--primary);
}
.msg {
  font-size: 13px;
  margin: 0 0 12px;
}
.msg.ok {
  color: var(--success);
}
.msg.err {
  color: var(--danger);
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
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
  color: var(--on-accent);
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
  background: var(--bg-card);
  color: var(--primary);
  border: 1px solid var(--primary);
}
</style>
