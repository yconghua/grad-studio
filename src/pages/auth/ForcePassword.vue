<template>
  <div class="force-page">
    <!-- 无边框窗口自绘标题栏（拖拽 + 最小化/关闭） -->
    <AppTitleBar />

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
import { useGlobalLoading } from '../../composables/useGlobalLoading'
import { ROLE_HOME } from '../../router'
import AppTitleBar from '../../components/layout/AppTitleBar.vue'

const router = useRouter()
const { getSessionUser, setSession } = useSession()
const { finish } = useGlobalLoading()

const username = ref('')
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const errorMsg = ref('')
const saving = ref(false)

onMounted(() => {
  const u = getSessionUser()
  if (!u) {
    finish()
    router.replace('/login')
    return
  }
  username.value = u.username || ''
  // 改密页为静态表单：挂载即就绪，解除切换账号等流程的全局加载遮罩
  finish()
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
  flex-direction: column;
  background: var(--primary-soft);
  overflow: auto;
}
.force-card {
  width: 420px;
  max-width: calc(92vw / var(--app-font-zoom, 1));
  margin: auto; /* 标题栏占顶部，卡片在剩余空间居中 */
  background: var(--bg-card);
  border-radius: var(--radius-xl);
  padding: 28px 30px 22px;
  box-shadow: var(--shadow-lg);
}
.head .title {
  margin: 0;
  font-size: 18px;
}
.head .sub {
  font-size: 13px;
  color: var(--muted);
  margin: 6px 0 16px;
}
.label {
  display: block;
  font-size: 13px;
  color: var(--text-2);
  margin: 12px 0 6px;
}
.input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}
.input:focus {
  border-color: var(--primary);
}
.input[disabled] {
  background: var(--bg-muted);
  color: var(--text-3);
}
.error {
  color: var(--danger);
  font-size: 13px;
  margin: 10px 0 0;
}
.btn {
  width: 100%;
  height: 42px;
  margin-top: 18px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--primary);
  color: var(--on-accent);
  font-size: 15px;
  cursor: pointer;
}
.btn:hover {
  background: var(--primary-hover);
}
.btn[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
}
.tip {
  font-size: 12px;
  color: var(--muted);
  text-align: center;
  margin-top: 14px;
  line-height: 1.7;
}
</style>
