<template>
  <div class="password-page">
    <div class="password-card">
      <h2 class="pwd-title">修改密码</h2>
      <p class="pwd-sub">修改后将使用新密码登录；首次登录的初始密码修改后即解除强制改密状态。</p>

      <form @submit.prevent="onSubmit">
        <label class="field-label" for="old-password">原密码</label>
        <input
          id="old-password"
          v-model="oldPassword"
          class="field-input"
          type="password"
          placeholder="请输入原密码"
          autocomplete="current-password"
        />

        <label class="field-label" for="new-password">新密码</label>
        <input
          id="new-password"
          v-model="newPassword"
          class="field-input"
          type="password"
          placeholder="请输入新密码"
          autocomplete="new-password"
        />

        <label class="field-label" for="confirm-password">确认新密码</label>
        <input
          id="confirm-password"
          v-model="confirmPassword"
          class="field-input"
          type="password"
          placeholder="请再次输入新密码"
          autocomplete="new-password"
        />

        <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
        <p v-if="okMsg" class="ok-msg">{{ okMsg }}</p>

        <button class="submit-btn" type="submit" :disabled="loading">
          {{ loading ? '提交中…' : '确认修改' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { changePassword } from '../../api'
import { useSession } from '../../composables/useSession'

const { getSessionUser, setSession } = useSession()
const router = useRouter()

const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const errorMsg = ref('')
const okMsg = ref('')
const loading = ref(false)

async function onSubmit() {
  errorMsg.value = ''
  okMsg.value = ''
  if (!oldPassword.value) { errorMsg.value = '请输入原密码'; return }
  if (!newPassword.value) { errorMsg.value = '请输入新密码'; return }
  if (newPassword.value.length < 6) { errorMsg.value = '新密码长度至少 6 位'; return }
  if (newPassword.value !== confirmPassword.value) { errorMsg.value = '两次输入的新密码不一致'; return }

  loading.value = true
  try {
    const user = getSessionUser()
    const res = await changePassword(user.username, oldPassword.value, newPassword.value)
    if (res && res.success) {
      okMsg.value = res.message || '密码已修改'
      oldPassword.value = ''
      newPassword.value = ''
      confirmPassword.value = ''
      // 同步刷新本地会话：解除强制改密标记，避免后续导航仍被守卫拦截回改密页
      setSession({ ...user, mustChangePassword: false })
      // 若当前处于强制改密状态（首次登录），改密成功后返回主界面
      if (user && user.mustChangePassword) {
        setTimeout(() => router.push('/'), 800)
      }
    } else {
      errorMsg.value = (res && res.message) || '修改失败，请重试'
    }
  } catch (e) {
    errorMsg.value = '修改过程出现异常，请重试'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.password-page { max-width: 440px; margin: 0 auto; padding-top: 24px; }
.password-card {
  background: #fff; border-radius: 14px; padding: 32px 36px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
}
.pwd-title { margin: 0 0 6px; font-size: 20px; color: #1f2329; }
.pwd-sub { margin: 0 0 18px; font-size: 13px; color: #8a9099; line-height: 1.7; }
.field-label { display: block; font-size: 13px; color: #4e5969; margin: 14px 0 6px; }
.field-input {
  width: 100%; height: 40px; padding: 0 12px; font-size: 14px;
  border: 1px solid #dfe3e8; border-radius: 8px; outline: none;
}
.field-input:focus { border-color: #0d80e0; }
.error-msg { margin: 14px 0 0; font-size: 13px; color: #ea4335; }
.ok-msg { margin: 14px 0 0; font-size: 13px; color: #19a558; }
.submit-btn {
  width: 100%; height: 42px; margin-top: 18px; border: none; border-radius: 8px;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  color: #fff; font-size: 15px; font-weight: 600; cursor: pointer;
}
.submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
