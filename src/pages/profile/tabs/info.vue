<template>
  <div class="info-tab">
    <!-- 基本信息：只读展示（账号 / 角色 / ID / 创建时间），下方「修改密码」点击行弹窗 -->
    <section class="card card-info">
      <!-- 头像：显示账号的第一个字符 -->
      <div class="avatar-wrap">
        <div class="avatar">{{ avatarChar }}</div>
      </div>
      <div class="card-head">
        <h3 class="card-title">基本信息</h3>
      </div>
      <div class="info-grid">
        <div class="info-cell">
          <span class="info-key">账号</span>
          <span class="info-val">{{ disp(user?.username) }}</span>
        </div>
        <div class="info-cell">
          <span class="info-key">角色</span>
          <span class="info-val">
            <span class="badge" :class="user?.role === ROLE_ADMIN ? 'on' : 'off'">{{ roleText }}</span>
          </span>
        </div>
        <!-- 暂时注释下面的代码，请不要删除了这个代码 -->
        <!--
        <div class="info-cell">
          <span class="info-key">ID</span>
          <span class="info-val">{{ disp(user?.id) }}</span>
        </div>
        -->
        <div class="info-cell clickable" @click="openChangePwd">
          <span class="info-key">修改密码</span>
          <span class="info-val arrow">修改 ›</span>
        </div>
        <div class="info-cell">
          <span class="info-key">创建时间</span>
          <span class="info-val">{{ disp(user?.created_at) }}</span>
        </div>
      </div>
    </section>

    <!-- 修改密码弹窗 -->
    <div class="modal-mask" v-if="showPwd" @click.self="showPwd = false">
      <div class="modal">
        <h3 class="modal-title">修改密码</h3>
        <div class="form-row">
          <label class="field-label">原密码</label>
          <input v-model="oldPwd" class="field-input" type="password" placeholder="请输入原密码" />
        </div>
        <div class="form-row">
          <label class="field-label">新密码</label>
          <input v-model="newPwd" class="field-input" type="password" placeholder="请输入新密码" />
        </div>
        <div class="form-row">
          <label class="field-label">确认新密码</label>
          <input v-model="confirmPwd" class="field-input" type="password" placeholder="请再次输入新密码" />
        </div>
        <p v-if="pwdMsg" class="msg" :class="pwdOk ? 'ok' : 'err'">{{ pwdMsg }}</p>
        <div class="modal-foot">
          <button class="save-btn ghost" @click="showPwd = false">取消</button>
          <button class="save-btn" @click="onChangePwd" :disabled="pwdSaving">确认修改</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { changePassword, getCurrentUser } from '../../../api'
import { ROLE_ADMIN } from '../../../config/constants'
import { useSession } from '../../../composables/useSession'

const { getSessionUser, USER_KEY } = useSession()
// 当前登录用户（挂载时从后端刷新，保持与数据库一致）
const user = ref(getSessionUser())

// 角色中文名
function roleLabel(r) {
  return r === ROLE_ADMIN ? '管理员' : '普通用户'
}
const roleText = computed(() => roleLabel(user.value?.role))

// 头像字符：账号的第一个字符（英文统一大写，无账号时占位 ?）
const avatarChar = computed(() => {
  const name = user.value?.username
  if (!name) return '?'
  const ch = Array.from(name)[0]
  return /[a-zA-Z]/.test(ch) ? ch.toUpperCase() : ch
})

// 空值占位
function disp(v) {
  return v === null || v === undefined || v === '' ? '—' : v
}

// 修改密码（弹窗）
const showPwd = ref(false)
const oldPwd = ref('')
const newPwd = ref('')
const confirmPwd = ref('')
const pwdMsg = ref('')
const pwdOk = ref(false)
const pwdSaving = ref(false)
function openChangePwd() {
  oldPwd.value = ''
  newPwd.value = ''
  confirmPwd.value = ''
  pwdMsg.value = ''
  pwdOk.value = false
  showPwd.value = true
}
async function onChangePwd() {
  pwdMsg.value = ''
  const name = user.value?.username
  if (!name) { pwdMsg.value = '登录信息已失效，请重新登录'; pwdOk.value = false; return }
  if (!oldPwd.value || !newPwd.value) {
    pwdMsg.value = '请填写原密码和新密码'
    pwdOk.value = false
    return
  }
  if (newPwd.value !== confirmPwd.value) {
    pwdMsg.value = '两次输入的新密码不一致'
    pwdOk.value = false
    return
  }
  pwdSaving.value = true
  try {
    const res = await changePassword(user.value.username, oldPwd.value, newPwd.value)
    if (res.success) {
      showPwd.value = false
      oldPwd.value = ''
      newPwd.value = ''
      confirmPwd.value = ''
      pwdMsg.value = ''
      pwdOk.value = false
    } else {
      pwdMsg.value = res.message || '修改失败'
      pwdOk.value = false
    }
  } catch (e) {
    pwdMsg.value = '修改过程出现异常，请重试'
    pwdOk.value = false
  } finally {
    pwdSaving.value = false
  }
}

onMounted(async () => {
  // 重新拉取当前登录用户，与数据库保持一致（写回 localStorage 供其他页签读取）
  try {
    const u = await getCurrentUser()
    if (u) {
      user.value = u
      localStorage.setItem(USER_KEY, JSON.stringify(u))
    }
  } catch (e) {}
})
</script>

<style scoped>
.card {
  background: #fff;
  border-radius: 8px;
  padding: 20px 24px;
  margin: 0 auto;
}
.card-info {
  width: 55%;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.card-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  color: #1f2329;
}
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
.field-input:disabled {
  background: #f5f6f8;
  color: #8a9099;
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

/* 头像：账号首字符圆形 */
.avatar-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 18px;
}
.avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  color: #fff;
  font-size: 30px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(13, 128, 224, 0.25);
  user-select: none;
}

/* 基本信息：竖排单列 */
.info-grid {
  display: grid;
  grid-template-columns: 1fr;
}
.info-cell {
  display: flex;
  align-items: flex-start;
  padding: 12px 0;
  border-bottom: 1px solid #f2f4f7;
  font-size: 14px;
}
.info-cell:last-child {
  border-bottom: none;
}
.info-key {
  flex: 0 0 80px;
  color: #8a9099;
}
.info-val {
  flex: 1;
  color: #1f2329;
  word-break: break-all;
}
.info-cell.clickable {
  cursor: pointer;
  transition: background 0.2s;
}
.info-cell.clickable:hover {
  background: #e8f0fe;
}
.info-val.arrow {
  color: #0d80e0;
}
.badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 8px;
  font-size: 12px;
}
.badge.on {
  background: #e8f7ee;
  color: #19a558;
}
.badge.off {
  background: #eef0f3;
  color: #6b7280;
}

/* 弹窗 */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  backdrop-filter: blur(2px);
}
.modal {
  background: #fff;
  border-radius: 8px;
  padding: 22px 24px;
  width: auto;
  min-width: 380px;
  max-width: 90vw;
  max-height: 84vh;
  overflow-y: auto;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}
.modal-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0 0 16px;
}
.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}
</style>
