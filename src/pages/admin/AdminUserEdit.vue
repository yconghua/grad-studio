<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">编辑用户</h2>
        <p class="page-sub">用户：{{ user && user.username }}（{{ user ? roleText(user.role) : '' }}）</p>
      </div>
      <button class="btn" @click="router.push('/admin/users')">返回列表</button>
    </div>

    <div class="panel">
      <div class="tabs">
        <button type="button" class="tab" :class="{ active: tab === 'account' }" @click="tab = 'account'">账号密码</button>
        <button type="button" class="tab" :class="{ active: tab === 'profile' }" @click="tab = 'profile'">资料</button>
      </div>

      <!-- 账号密码 Tab -->
      <template v-if="tab === 'account'">
        <div class="form-grid">
          <div class="field">
            <label>用户名（区分大小写）</label>
            <input v-model.trim="account.username" class="input" placeholder="请输入用户名" />
          </div>
          <div class="field">
            <label>角色</label>
            <select v-model="account.role" class="select" :disabled="isSuper">
              <option v-for="(t, r) in ALL_ROLES_TEXT" :key="r" :value="r">{{ t }}</option>
            </select>
            <p v-if="isSuper" class="hint">超级管理员角色不可修改</p>
          </div>
          <div class="field">
            <label>密码（留空表示不修改）</label>
            <input v-model="account.password" type="password" class="input" placeholder="留空则不修改密码" />
            <p class="hint">修改后该用户下次登录需重新设置密码；长度至少 6 位且包含大小写字母</p>
          </div>
          <div class="field">
            <label>确认密码</label>
            <input v-model="account.confirmPassword" type="password" class="input" placeholder="请再次输入密码" />
          </div>
          <div class="field">
            <label>状态</label>
            <select v-model="account.status" class="select" :disabled="isSuper">
              <option :value="1">启用</option>
              <option :value="0">禁用</option>
            </select>
            <p v-if="isSuper" class="hint">超级管理员不可禁用</p>
          </div>
        </div>
        <div class="modal-foot" style="padding: 0; border: none">
          <button class="btn btn-primary" :disabled="saving" @click="saveAccount">{{ saving ? '保存中…' : '保存' }}</button>
        </div>
      </template>

      <!-- 资料 Tab -->
      <template v-else>
        <div class="form-grid">
          <div class="field">
            <label>真实姓名</label>
            <input v-model.trim="profile.realName" class="input" placeholder="请输入真实姓名" />
          </div>
          <div class="field">
            <label>手机号</label>
            <input v-model.trim="profile.phone" class="input" placeholder="请输入手机号" />
          </div>
          <div class="field">
            <label>邮箱</label>
            <input v-model.trim="profile.email" class="input" placeholder="请输入邮箱" />
          </div>
          <div class="field">
            <label>性别</label>
            <select v-model="profile.gender" class="select">
              <option :value="0">未知</option>
              <option :value="1">男</option>
              <option :value="2">女</option>
            </select>
          </div>
          <div class="field field-full">
            <label>头像</label>
            <div class="avatar-preview">
              <img v-if="profile.avatar" :src="avatarUrl(profile.avatar)" class="avatar-lg" alt="头像" />
              <span v-else class="avatar avatar-empty avatar-lg">?</span>
              <div>
                <button type="button" class="btn btn-sm" @click="chooseAvatar">选择头像</button>
                <p class="hint">从本机选择图片文件，将复制到应用数据目录</p>
              </div>
            </div>
          </div>
          <div class="field">
            <label>所属课题组</label>
            <select v-model="profile.groupId" class="select" @change="onGroupChange">
              <option value="">暂不加入课题组</option>
              <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
            </select>
          </div>
          <div class="field" v-if="user && user.role === 'student'">
            <label>导师（仅学生）</label>
            <select v-model="profile.mentorId" class="select">
              <option value="">暂不指定导师</option>
              <option v-for="m in mentors" :key="m.id" :value="m.id">{{ m.realName || m.username }}</option>
            </select>
            <p class="hint">导师与学生必须属于同一课题组</p>
          </div>
        </div>
        <div class="modal-foot" style="padding: 0; border: none">
          <button class="btn btn-primary" :disabled="saving" @click="saveProfile">{{ saving ? '保存中…' : '保存' }}</button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getUser, updateAccount, updateProfile, listGroups, listUsers, pickAttachment } from '../../api'
import { dialogAlert } from '../../composables/useDialog'
import { avatarUrl } from '../../utils/avatar'
import { refreshAfterWrite } from '../../composables/useGlobalRefresh'
import { fetchAll } from '../../utils/fetchAll'
import { roleText } from '../../utils/labels'
import { ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN, ROLE_MENTOR, ROLE_STUDENT } from '../../config/constants'

// 超级管理员独立页面：用户编辑（账号密码 / 资料 两个 Tab，分别保存）
const route = useRoute()
const router = useRouter()
const userId = Number(route.params.id)

const tab = ref('account')
const user = ref(null)
const groups = ref([])
const mentors = ref([])
const saving = ref(false)

const ALL_ROLES_TEXT = {
  [ROLE_SUPER_ADMIN]: '超级管理员',
  [ROLE_GROUP_ADMIN]: '课题组管理员',
  [ROLE_MENTOR]: '导师',
  [ROLE_STUDENT]: '学生'
}

const account = reactive({ username: '', password: '', confirmPassword: '', role: '', status: 1 })
const profile = reactive({ realName: '', phone: '', email: '', gender: 0, avatar: '', groupId: '', mentorId: '' })

const isSuper = () => user.value && user.value.role === ROLE_SUPER_ADMIN

async function load() {
  const res = await getUser(userId)
  if (!res || !res.success) {
    dialogAlert((res && res.message) || '加载用户失败')
    return
  }
  user.value = res.data
  account.username = res.data.username || ''
  account.password = ''
  account.confirmPassword = ''
  account.role = res.data.role
  account.status = res.data.status
  profile.realName = res.data.realName || ''
  profile.phone = res.data.phone || ''
  profile.email = res.data.email || ''
  profile.gender = res.data.gender || 0
  profile.avatar = res.data.avatar || ''
  profile.groupId = res.data.groupId === null || res.data.groupId === undefined ? '' : res.data.groupId
  profile.mentorId = res.data.mentorId === null || res.data.mentorId === undefined ? '' : res.data.mentorId

  groups.value = await fetchAll(listGroups)
  if (res.data.role === ROLE_STUDENT && profile.groupId) {
    mentors.value = await fetchAll(listUsers, { role: 'mentor', groupId: profile.groupId })
  }
}

// 选择课题组后加载该组导师（供指定导师）
async function onGroupChange() {
  profile.mentorId = ''
  mentors.value = []
  if (!profile.groupId) return
  mentors.value = await fetchAll(listUsers, { role: 'mentor', groupId: profile.groupId })
}

// 选择头像
async function chooseAvatar() {
  const res = await pickAttachment()
  if (res && res.success) profile.avatar = res.path
  else if (res && !res.canceled) dialogAlert(res.message || '选择头像失败')
}

// 账号密码 Tab 保存
async function saveAccount() {
  if (!account.username) return dialogAlert('请输入用户名')
  if (account.password && account.password !== account.confirmPassword) return dialogAlert('两次输入的密码不一致')
  saving.value = true
  try {
    const res = await updateAccount(userId, {
      username: account.username,
      password: account.password,
      confirmPassword: account.confirmPassword,
      role: account.role,
      status: Number(account.status)
    })
    if (res && res.success) {
      await refreshAfterWrite('保存成功')
    } else {
      dialogAlert((res && res.message) || '保存失败')
    }
  } finally {
    saving.value = false
  }
}

// 资料 Tab 保存
async function saveProfile() {
  saving.value = true
  try {
    const res = await updateProfile(userId, {
      realName: profile.realName,
      phone: profile.phone,
      email: profile.email,
      gender: Number(profile.gender),
      avatar: profile.avatar,
      groupId: profile.groupId === '' ? null : Number(profile.groupId),
      mentorId: profile.mentorId === '' ? null : Number(profile.mentorId)
    })
    if (res && res.success) {
      await refreshAfterWrite('保存成功')
    } else {
      dialogAlert((res && res.message) || '保存失败')
    }
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>
