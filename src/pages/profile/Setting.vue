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
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { changePassword } from '../../api'
import { useSession } from '../../composables/useSession'
import { dialogAlert } from '../../composables/useDialog'

const { getSessionUser } = useSession()
const username = getSessionUser() ? getSessionUser().username : ''

const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const error = ref('')
const saving = ref(false)

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
