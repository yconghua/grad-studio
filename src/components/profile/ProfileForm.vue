<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">{{ title }}</h2>
        <p class="page-sub">{{ subtitle }}</p>
      </div>
    </div>

    <div class="panel" style="max-width: 640px">
      <!-- 账号信息（只读） -->
      <p class="panel-title">账号信息</p>
      <div class="desc-list">
        <div class="row"><span class="k">用户名</span><span class="v">{{ (user && user.username) || '-' }}</span></div>
        <div class="row"><span class="k">角色</span><span class="v">{{ user ? roleText(user.role) : '-' }}</span></div>
        <div class="row" v-if="user && user.groupId"><span class="k">所属课题组</span><span class="v">{{ user.groupName || ('课题组 #' + user.groupId) }}</span></div>
        <div class="row" v-if="user && user.mentorId"><span class="k">导师</span><span class="v">{{ mentorLabel }}</span></div>
      </div>

      <!-- 基本资料（可编辑） -->
      <p class="panel-title" style="margin-top: 20px">基本资料</p>
      <div class="form-grid">
        <div class="field">
          <label>真实姓名</label>
          <input v-model.trim="realName" class="input" placeholder="请输入真实姓名" maxlength="50" />
          <p class="hint">不超过 50 个字符</p>
        </div>
        <div class="field">
          <label>手机号</label>
          <input v-model.trim="phone" class="input" placeholder="请输入手机号" maxlength="20" />
          <p class="hint">不超过 20 个字符</p>
        </div>
        <div class="field">
          <label>邮箱</label>
          <input v-model.trim="email" class="input" placeholder="请输入邮箱" maxlength="100" />
          <p class="hint">不超过 100 个字符</p>
        </div>
        <div class="field">
          <label>性别</label>
          <select v-model="gender" class="select">
            <option :value="0">未知</option>
            <option :value="1">男</option>
            <option :value="2">女</option>
          </select>
        </div>
        <div class="field field-full">
          <label>头像</label>
          <div class="avatar-preview">
            <img v-if="avatar" :src="avatarUrl(avatar)" class="avatar-lg" alt="头像" />
            <span v-else class="avatar avatar-empty avatar-lg">?</span>
            <div>
              <button type="button" class="btn btn-sm" @click="chooseAvatar">选择头像</button>
              <button type="button" class="btn btn-sm" v-if="avatar" @click="avatar = ''">移除头像</button>
              <p class="hint">从本机选择图片文件，将复制到应用数据目录</p>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-foot" style="padding: 0; border: none">
        <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存' }}</button>
      </div>

      <!-- 修改密码（个人资料页入口；改密成功后清会话强制重新登录） -->
      <p class="panel-title" style="margin-top: 24px">修改密码</p>
      <div class="form-grid">
        <div class="field">
          <label>原密码</label>
          <input v-model="oldPassword" type="password" class="input" placeholder="请输入原密码" />
        </div>
        <div class="field">
          <label>新密码</label>
          <input v-model="newPassword" type="password" class="input" placeholder="至少 6 位，须包含大小写字母" maxlength="50" />
          <p class="hint">至少 6 位且包含大小写字母</p>
        </div>
        <div class="field">
          <label>确认新密码</label>
          <input v-model="confirmPassword" type="password" class="input" placeholder="请再次输入新密码" maxlength="50" />
        </div>
      </div>
      <div class="modal-foot" style="padding: 0; border: none">
        <button class="btn btn-primary" :disabled="changingPwd" @click="changePwd">{{ changingPwd ? '修改中…' : '修改密码' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getCurrentUser, updateOwnProfile, changePassword, pickAttachment } from '../../api'
import { dialogAlert } from '../../composables/useDialog'
import { refreshAfterWrite } from '../../composables/useGlobalRefresh'
import { useAutoRefresh } from '../../composables/useAutoRefresh'
import { useSession } from '../../composables/useSession'
import { roleText } from '../../utils/labels'
import { avatarUrl } from '../../utils/avatar'

// 个人资料公共表单（各角色个人资料页复用）：
// 展示账号只读信息 + 基本资料（真实姓名 / 手机号 / 邮箱 / 性别 / 头像），
// 保存成功后同步本地会话快照并全局刷新，保证右上角头像菜单等处立即显示最新资料。
defineProps({
  title: { type: String, default: '个人资料' },
  subtitle: { type: String, default: '' }
})

const { setSession, clearSession } = useSession()
const router = useRouter()

const user = ref(null)

// 导师展示：优先「姓名（账号）」，无姓名时显示账号，兜底导师 #id
const mentorLabel = computed(() => {
  if (!user.value || !user.value.mentorId) return '-'
  const name = user.value.mentorRealName
  const acc = user.value.mentorUsername
  if (name) return `${name}（${acc || ''}）`
  return acc || ('导师 #' + user.value.mentorId)
})
const realName = ref('')
const phone = ref('')
const email = ref('')
const gender = ref(0)
const avatar = ref('')
const saving = ref(false)
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const changingPwd = ref(false)

async function load() {
  const res = await getCurrentUser()
  if (!res || !res.success) {
    dialogAlert((res && res.message) || '加载个人资料失败')
    return
  }
  user.value = res.data
  realName.value = res.data.realName || ''
  phone.value = res.data.phone || ''
  email.value = res.data.email || ''
  gender.value = res.data.gender || 0
  avatar.value = res.data.avatar || ''
}

// 选择头像：调用系统附件选择，复制到应用数据目录
async function chooseAvatar() {
  const res = await pickAttachment()
  if (res && res.success) avatar.value = res.path
  else if (res && !res.canceled) dialogAlert(res.message || '选择头像失败')
}

async function save() {
  saving.value = true
  try {
    const res = await updateOwnProfile({
      realName: realName.value,
      phone: phone.value,
      email: email.value,
      gender: Number(gender.value),
      avatar: avatar.value
    })
    if (res && res.success) {
      // 同步本地会话快照，右上角头像菜单等复用会话的位置立即生效
      setSession(res.data)
      await refreshAfterWrite('保存成功')
    } else {
      dialogAlert((res && res.message) || '保存失败')
    }
  } finally {
    saving.value = false
  }
}

// 修改密码：复用 auth:change-password（校验原密码 → 新密码强度 → 清强制改密标记），
// 成功后清除本地会话并回到登录页，强制用新密码重新登录
async function changePwd() {
  if (!oldPassword.value) return dialogAlert('请输入原密码')
  if (!newPassword.value) return dialogAlert('请输入新密码')
  if (newPassword.value.length < 6) return dialogAlert('新密码长度至少 6 位')
  if (!/[A-Z]/.test(newPassword.value) || !/[a-z]/.test(newPassword.value)) {
    return dialogAlert('新密码必须包含大小写字母')
  }
  if (newPassword.value !== confirmPassword.value) return dialogAlert('两次输入的新密码不一致')
  changingPwd.value = true
  try {
    const res = await changePassword({
      username: (user.value && user.value.username) || '',
      oldPassword: oldPassword.value,
      newPassword: newPassword.value,
      confirmPassword: confirmPassword.value
    })
    if (res && res.success) {
      clearSession()
      router.replace('/login')
      dialogAlert('密码已修改，请使用新密码重新登录')
    } else {
      dialogAlert((res && res.message) || '修改失败')
    }
  } finally {
    changingPwd.value = false
  }
}

onMounted(load)
// 数据变动（本页写操作或外部改动）后后台静默重拉，保持资料最新
useAutoRefresh(load)
</script>
