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
        <input v-model="newPassword" type="password" class="input" placeholder="至少 6 位，须包含大小写字母" @keyup.enter="submit" />

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
import { ROLE_HOME } from '../../router'

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
  if (!/[A-Z]/.test(newPassword.value) || !/[a-z]/.test(newPassword.value)) {
    errorMsg.value = '新密码必须包含大小写字母'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    errorMsg.value = '两次输入的新密码不一致'
    return
  }
  saving.value = true
  try {
    const res = await changePassword({
      username: username.value,
      oldPassword: oldPassword.value,
      newPassword: newPassword.value,
      confirmPassword: confirmPassword.value
    })
    if (res && res.success) {
      // 更新会话中的强制改密标记，然后按角色进入对应工作台
      const u = getSessionUser() || {}
      setSession({ ...u, mustChangePassword: false })
      router.replace(ROLE_HOME[u.role] || '/login')
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
  overflow: auto;
}
.force-card {
  width: 420px;
  max-width: 92vw;
  background: #fff;
  border-radius: 14px;
  padding: 28px 30px 22px;
  box-shadow: 0 10px 30px rgba(79, 110, 247, 0.12);
}
.head .title {
  margin: 0;
  font-size: 18px;
}
.head .sub {
  font-size: 13px;
  color: #8a919f;
  margin: 6px 0 16px;
}
.label {
  display: block;
  font-size: 13px;
  color: #4b5563;
  margin: 12px 0 6px;
}
.input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}
.input:focus {
  border-color: #4f6ef7;
}
.input[disabled] {
  background: #f7f8fa;
  color: #6b7280;
}
.error {
  color: #e5484d;
  font-size: 13px;
  margin: 10px 0 0;
}
.btn {
  width: 100%;
  height: 42px;
  margin-top: 18px;
  border: none;
  border-radius: 8px;
  background: #4f6ef7;
  color: #fff;
  font-size: 15px;
  cursor: pointer;
}
.btn:hover {
  background: #3d5cf0;
}
.btn[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
}
.tip {
  font-size: 12px;
  color: #8a919f;
  text-align: center;
  margin-top: 14px;
  line-height: 1.7;
}
</style>
