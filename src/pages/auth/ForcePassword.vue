<template>
  <div class="force-page">
    <div class="force-card">
      <div class="head">
        <h2 class="title">首次登录需修改密码</h2>
        <p class="sub">出于安全考虑，请先修改初始密码后再使用系统</p>
      </div>

      <div class="form">
        <label class="label">账号</label>
        <input class="input" :value="username" disabled />

        <label class="label">原密码（初始密码）</label>
        <input v-model="oldPassword" type="password" class="input" placeholder="请输入初始密码" @keyup.enter="submit" />

        <label class="label">新密码</label>
        <input v-model="newPassword" type="password" class="input" placeholder="请输入新密码" @keyup.enter="submit" />

        <label class="label">确认新密码</label>
        <input v-model="confirmPassword" type="password" class="input" placeholder="请再次输入新密码" @keyup.enter="submit" />

        <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

        <button class="btn" @click="submit" :disabled="saving">{{ saving ? '提交中…' : '确认修改并进入系统' }}</button>
      </div>

      <p class="tip">修改成功后即可正常使用系统；如忘记初始密码，请联系管理员重置。</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { changePassword } from '../../api'
import { useSession } from '../../composables/useSession'

const router = useRouter()
const { getSessionUser, setSession } = useSession()

const username = ref('')
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const errorMsg = ref('')
const saving = ref(false)

onMounted(() => {
  const u = getSessionUser()
  if (!u) {
    router.replace('/login')
    return
  }
  username.value = u.username || ''
})

async function submit() {
  errorMsg.value = ''
  if (!oldPassword.value) {
    errorMsg.value = '请输入初始密码'
    return
  }
  if (!newPassword.value) {
    errorMsg.value = '请输入新密码'
    return
  }
  if (newPassword.value.length < 6) {
    errorMsg.value = '新密码长度至少 6 位'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    errorMsg.value = '两次输入的新密码不一致'
    return
  }
  saving.value = true
  try {
    const res = await changePassword(username.value, oldPassword.value, newPassword.value)
    if (res && res.success) {
      // 更新会话中的强制改密标记，然后进入首页
      const u = getSessionUser() || {}
      setSession({ ...u, mustChangePassword: false })
      router.replace('/')
    } else {
      errorMsg.value = (res && res.message) || '修改失败，请重试'
    }
  } catch (e) {
    errorMsg.value = '修改过程出现异常，请重试'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.force-page {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eef2ff;
}
.force-card {
  width: 380px;
  max-width: 92vw;
  background: #fff;
  border-radius: 14px;
  padding: 34px 30px;
  box-shadow: 0 12px 40px rgba(13, 128, 224, 0.14);
}
.head {
  margin-bottom: 20px;
}
.title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #1d2129;
}
.sub {
  margin: 6px 0 0;
  font-size: 13px;
  color: #8a9099;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.label {
  font-size: 13px;
  color: #4e5969;
}
.input {
  width: 100%;
  height: 42px;
  padding: 0 12px;
  font-size: 14px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  outline: none;
  box-sizing: border-box;
}
.input:focus {
  border-color: #0d80e0;
}
.input:disabled {
  background: #f2f3f5;
  color: #8a9099;
}
.error {
  margin: 0;
  font-size: 13px;
  color: #ea4335;
}
.btn {
  width: 100%;
  height: 44px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}
.btn:hover {
  opacity: 0.92;
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.tip {
  margin: 16px 0 0;
  font-size: 12px;
  color: #8a9099;
  text-align: center;
  line-height: 1.6;
}
</style>
