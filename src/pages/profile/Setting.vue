<template>
  <div class="page">
    <h3 class="title">个人设置</h3>

    <div class="section">
      <h4 class="section-title">修改密码</h4>
      <div class="form">
        <div class="field">
          <label class="label">原密码</label>
          <input v-model="oldPassword" type="password" class="input" />
        </div>
        <div class="field">
          <label class="label">新密码</label>
          <input v-model="newPassword" type="password" class="input" />
        </div>
        <div class="field">
          <label class="label">确认新密码</label>
          <input v-model="confirmPassword" type="password" class="input" />
        </div>
        <p v-if="error" class="error">{{ error }}</p>
        <button class="btn btn-primary" @click="save" :disabled="saving">{{ saving ? '提交中…' : '修改密码' }}</button>
      </div>
    </div>

    <div class="section">
      <h4 class="section-title">档案信息</h4>
      <p class="tip">个人与学术信息（姓名、专业、邮箱等）请在「学术档案」页签中维护。</p>
    </div>

    <div class="section">
      <h4 class="section-title">通知偏好</h4>
      <p class="tip">设置哪些事件接收站内消息与系统桌面通知（站内消息始终写入消息中心，关闭桌面通知后不再弹系统提示）。</p>
      <div class="pref-table">
        <div class="pref-row pref-head">
          <span class="pref-event">事件类型</span>
          <span class="pref-toggle">站内消息</span>
          <span class="pref-toggle">桌面通知</span>
        </div>
        <div v-for="item in prefList" :key="item.event_type" class="pref-row">
          <span class="pref-event">{{ item.label }}</span>
          <label class="switch"><input type="checkbox" :checked="item.inapp_enabled === 1" @change="togglePref(item, 'inapp_enabled', $event.target.checked)" /><span class="slider"></span></label>
          <label class="switch"><input type="checkbox" :checked="item.desktop_enabled === 1" @change="togglePref(item, 'desktop_enabled', $event.target.checked)" /><span class="slider"></span></label>
        </div>
      </div>
      <p v-if="prefError" class="error">{{ prefError }}</p>
      <p v-else-if="prefSaved" class="pref-saved">✓ 偏好已自动保存</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { changePassword, system } from '../../api'
import { useSession } from '../../composables/useSession'
import { dialogAlert } from '../../composables/useDialog'

const { getSessionUser } = useSession()
const username = getSessionUser() ? getSessionUser().username : ''

const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const error = ref('')
const saving = ref(false)

// ===== 通知偏好（开关改动即自动保存，防抖 300ms） =====
const prefList = ref([])
const prefError = ref('')
const prefSaved = ref(false)
let saveTimer = null

onMounted(async () => {
  try {
    const res = await system.getNotificationPref()
    prefList.value = (res && res.success && res.list) || []
  } catch (e) {
    prefList.value = []
  }
})

// 开关切换：item 里存数字 1/0（checkbox 直接 v-model 数字会因 looseEqual 判断全部显示关闭）
function togglePref(item, key, checked) {
  item[key] = checked ? 1 : 0
  autoSavePref()
}

function autoSavePref() {
  prefError.value = ''
  clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    if (!prefList.value.length) return
    try {
      const payload = prefList.value.map((p) => ({
        event_type: p.event_type,
        inapp_enabled: p.inapp_enabled ? 1 : 0,
        desktop_enabled: p.desktop_enabled ? 1 : 0
      }))
      const res = await system.saveNotificationPref(payload)
      if (res && res.success) {
        prefSaved.value = true
        setTimeout(() => { prefSaved.value = false }, 2500)
      } else {
        prefError.value = (res && res.message) || '保存失败'
      }
    } catch (e) {
      prefError.value = '保存过程出现异常，请重试'
    }
  }, 300)
}

async function save() {
  error.value = ''
  if (!oldPassword.value) {
    error.value = '请输入原密码'
    return
  }
  if (!newPassword.value) {
    error.value = '请输入新密码'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    error.value = '两次输入的新密码不一致'
    return
  }
  saving.value = true
  try {
    const res = await changePassword(username, oldPassword.value, newPassword.value)
    if (res && res.success) {
      await dialogAlert('密码已修改')
      oldPassword.value = ''
      newPassword.value = ''
      confirmPassword.value = ''
    } else {
      error.value = (res && res.message) || '修改失败'
    }
  } catch (e) {
    error.value = '修改过程出现异常，请重试'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.page {
  background: #fff;
  border: 1px solid #eceff3;
  border-radius: 12px;
  padding: 20px 22px;
}
.title {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
}
.section {
  padding: 14px 0;
  border-top: 1px solid #eceff3;
}
.section:first-of-type {
  border-top: none;
}
.section-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
}
.tip {
  margin: 0;
  font-size: 13px;
  color: #8a9099;
}
.form {
  max-width: 360px;
}
.field {
  margin-bottom: 12px;
}
.label {
  display: block;
  font-size: 13px;
  color: #4e5969;
  margin-bottom: 6px;
}
.input {
  width: 100%;
  min-height: 38px;
  padding: 0 10px;
  font-size: 13px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  outline: none;
  box-sizing: border-box;
}
.input:focus {
  border-color: #0d80e0;
}
.error {
  margin: 8px 0;
  font-size: 13px;
  color: #ea4335;
}
.pref-table {
  margin: 12px 0;
  max-width: 460px;
  border: 1px solid #eceff3;
  border-radius: 10px;
  overflow: hidden;
}
.pref-row {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid #f2f3f5;
}
.pref-row:last-child {
  border-bottom: none;
}
.pref-head {
  background: #f7f8fa;
  font-size: 12px;
  color: #8a9099;
}
.pref-event {
  flex: 1;
  font-size: 13px;
  color: #1f2329;
}
.pref-toggle {
  width: 90px;
  text-align: center;
}
.switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
  margin: 0 12px;
}
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background: #dfe3e8;
  border-radius: 22px;
  transition: 0.2s;
}
.slider::before {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  left: 3px;
  top: 3px;
  background: #fff;
  border-radius: 50%;
  transition: 0.2s;
}
.switch input:checked + .slider {
  background: #0d80e0;
}
.switch input:checked + .slider::before {
  transform: translateX(18px);
}
.pref-saved {
  margin: 10px 0 0;
  font-size: 13px;
  color: #19a558;
}
.btn {
  height: 36px;
  padding: 0 22px;
  font-size: 13px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  background: #fff;
  color: #4e5969;
  cursor: pointer;
}
.btn-primary {
  border: none;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  color: #fff;
  font-weight: 600;
}
.btn-primary:disabled {
  opacity: 0.6;
}
</style>
