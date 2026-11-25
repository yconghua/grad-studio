<template>
  <div v-if="open" class="modal-mask" @click.self="close">
    <div class="modal pwd-dialog">
      <div class="modal-head">
        <h3>修改密码</h3>
        <button type="button" class="modal-close" @click="close">×</button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field field-full">
            <label>原密码</label>
            <input v-model="oldPassword" type="password" class="input" placeholder="请输入原密码" />
          </div>
          <div class="field field-full">
            <label>新密码</label>
            <input v-model="newPassword" type="password" class="input" placeholder="至少 6 位，须包含大小写字母" maxlength="50" />
            <p class="hint">至少 6 位且包含大小写字母</p>
          </div>
          <div class="field field-full">
            <label>确认新密码</label>
            <input v-model="confirmPassword" type="password" class="input" placeholder="请再次输入新密码" maxlength="50" />
          </div>
        </div>
        <p v-if="errorMsg" class="err-msg">{{ errorMsg }}</p>
        <p class="tip">修改成功后当前登录状态会退出，需使用新密码重新登录。</p>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn" @click="close">取消</button>
        <button type="button" class="btn btn-primary" :disabled="changing" @click="submit">
          {{ changing ? '修改中…' : '确认修改' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { changePassword } from '../../api'

// 修改密码弹窗：校验规则与服务端 authService.changePassword 一致；
// 成功后由父组件清除会话并跳转登录页（本组件只负责提交与错误展示）。
const props = defineProps({
  open: { type: Boolean, default: false },
  username: { type: String, default: '' }
})
const emit = defineEmits(['update:open', 'changed'])

const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const changing = ref(false)
const errorMsg = ref('')

watch(
  () => props.open,
  (v) => {
    if (!v) return
    oldPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    changing.value = false
    errorMsg.value = ''
  },
  { immediate: true }
)

function validate() {
  if (!oldPassword.value) return '请输入原密码'
  if (!newPassword.value) return '请输入新密码'
  if (newPassword.value.length < 6) return '新密码长度至少 6 位'
  if (!/[A-Z]/.test(newPassword.value) || !/[a-z]/.test(newPassword.value)) return '新密码必须包含大小写字母'
  if (newPassword.value !== confirmPassword.value) return '两次输入的新密码不一致'
  return ''
}

async function submit() {
  if (changing.value) return
  const err = validate()
  if (err) {
    errorMsg.value = err
    return
  }
  changing.value = true
  errorMsg.value = ''
  try {
    const res = await changePassword({
      username: props.username,
      oldPassword: oldPassword.value,
      newPassword: newPassword.value,
      confirmPassword: confirmPassword.value
    })
    if (res && res.success) {
      emit('update:open', false)
      emit('changed')
    } else {
      errorMsg.value = (res && res.message) || '修改失败'
    }
  } finally {
    changing.value = false
  }
}

function close() {
  emit('update:open', false)
}
</script>

<style scoped>
.modal.pwd-dialog {
  width: 460px;
  max-width: calc(92vw / var(--app-font-zoom, 1));
}
.err-msg {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--danger);
}
.tip {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
}
</style>
