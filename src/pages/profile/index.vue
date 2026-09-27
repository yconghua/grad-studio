<template>
  <div class="profile-page">
    <!-- 账号信息卡片（只读，来自登录会话） -->
    <div class="profile-card">
      <div class="profile-avatar">{{ avatarText }}</div>
      <div class="profile-info">
        <h2 class="profile-name">{{ user?.username || '—' }}</h2>
        <p class="profile-sub">
          <span class="role-tag">{{ roleText }}</span>
          <span class="username">账号：{{ user?.username || '—' }}</span>
        </p>
        <p v-if="myGroups.length" class="profile-groups">
          <span class="groups-label">{{ isGroupAdmin ? '管理的课题组：' : '所属课题组：' }}</span>
          <span v-for="g in myGroups" :key="g.id" class="group-tag">{{ g.name }}（{{ g.code }}）</span>
        </p>
        <p v-if="isStudent" class="profile-groups">
          <span class="groups-label">指导老师：</span>
          <span class="group-tag">{{ mentorText }}</span>
        </p>
        <dl class="profile-detail">
          <div class="detail-row">
            <dt>账号状态</dt>
            <dd>{{ statusText }}</dd>
          </div>
          <div class="detail-row">
            <dt>首次登录改密</dt>
            <dd>{{ user?.mustChangePassword ? '待修改' : '已完成' }}</dd>
          </div>
        </dl>
      </div>
    </div>

    <!-- 个人档案编辑表单 -->
    <div class="form-card">
      <h3 class="form-title">个人档案</h3>
      <div class="form-grid">
        <label class="form-field">
          <span class="field-label">真实姓名</span>
          <input v-model="form.real_name" class="field-input" placeholder="请输入真实姓名" />
        </label>
        <label class="form-field">
          <span class="field-label">性别</span>
          <select v-model="form.gender" class="field-input">
            <option value="">未填写</option>
            <option value="male">男</option>
            <option value="female">女</option>
          </select>
        </label>
        <label class="form-field">
          <span class="field-label">学号 / 工号</span>
          <input v-model="form.student_no" class="field-input" placeholder="请输入学号或工号" />
        </label>
        <label class="form-field">
          <span class="field-label">年级</span>
          <input v-model="form.grade" class="field-input" placeholder="如 2024 级" />
        </label>
        <label class="form-field">
          <span class="field-label">所属学院</span>
          <input v-model="form.college" class="field-input" placeholder="请输入所属学院" />
        </label>
        <label class="form-field">
          <span class="field-label">系 / 研究所</span>
          <input v-model="form.department" class="field-input" placeholder="请输入系或研究所" />
        </label>
        <label class="form-field">
          <span class="field-label">专业 / 研究方向</span>
          <input v-model="form.major" class="field-input" placeholder="请输入专业或研究方向" />
        </label>
        <label class="form-field">
          <span class="field-label">学位类型</span>
          <select v-model="form.degree_type" class="field-input">
            <option value="">未填写</option>
            <option value="master">硕士</option>
            <option value="doctor">博士</option>
          </select>
        </label>
        <label class="form-field">
          <span class="field-label">组内职位</span>
          <input v-model="form.position" class="field-input" placeholder="如 课题负责人 / 组长" />
        </label>
        <label class="form-field">
          <span class="field-label">入组日期</span>
          <input v-model="form.join_date" type="date" class="field-input" />
        </label>
        <label class="form-field">
          <span class="field-label">邮箱</span>
          <input v-model="form.email" class="field-input" placeholder="请输入邮箱" />
        </label>
        <label class="form-field">
          <span class="field-label">手机号</span>
          <input v-model="form.phone" class="field-input" placeholder="请输入手机号" />
        </label>
        <label class="form-field full">
          <span class="field-label">个人简介</span>
          <textarea v-model="form.bio" class="field-input field-textarea" rows="4" placeholder="介绍一下自己…"></textarea>
        </label>
      </div>

      <p v-if="tip" class="form-tip" :class="{ error: tipError, ok: !tipError }">{{ tip }}</p>

      <div class="form-actions">
        <button class="save-btn" :disabled="saving" @click="onSave">
          {{ saving ? '保存中…' : '保存档案' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue'
import { useSession } from '../../composables/useSession'
import { getProfile, updateProfile, listMyGroups, listMyMentor } from '../../api'
import {
  ROLE_SUPER_ADMIN,
  ROLE_GROUP_ADMIN,
  ROLE_MENTOR,
  ROLE_STUDENT,
  ACCOUNT_STATUS_ACTIVE,
  ACCOUNT_STATUS_DISABLED,
  ACCOUNT_STATUS_LEAVE
} from '../../config/constants'

const { getSessionUser } = useSession()
const user = getSessionUser()

const ROLE_TEXT = {
  [ROLE_SUPER_ADMIN]: '超级管理员',
  [ROLE_GROUP_ADMIN]: '课题组管理员',
  [ROLE_MENTOR]: '导师',
  [ROLE_STUDENT]: '学生'
}

const STATUS_TEXT = {
  [ACCOUNT_STATUS_ACTIVE]: '正常',
  [ACCOUNT_STATUS_DISABLED]: '已禁用',
  [ACCOUNT_STATUS_LEAVE]: '离组'
}

const roleText = computed(() => ROLE_TEXT[user?.role] || user?.role || '未知角色')
const isGroupAdmin = computed(() => user?.role === ROLE_GROUP_ADMIN)
const isStudent = computed(() => user?.role === ROLE_STUDENT)
const statusText = computed(() => STATUS_TEXT[user?.status] || user?.status || '未知')
const avatarText = computed(() => {
  const name = user?.username || '?'
  return name.charAt(0).toUpperCase()
})

const EMPTY_FORM = {
  real_name: '',
  gender: '',
  student_no: '',
  email: '',
  phone: '',
  college: '',
  department: '',
  major: '',
  grade: '',
  degree_type: '',
  position: '',
  bio: '',
  join_date: ''
}

const form = reactive({ ...EMPTY_FORM })
const saving = ref(false)

// 所属课题组列表：listMyGroups 返回当前用户所属组（含 name / code）
const myGroups = ref([])
async function loadMyGroups() {
  try {
    const res = await listMyGroups()
    if (res && res.success) myGroups.value = res.groups || []
  } catch (e) {
    myGroups.value = []
  }
}

// 指导老师（仅学生展示）：姓名（账号），无姓名只显示账号
const mentor = ref(null)
const mentorText = computed(() => {
  const m = mentor.value
  if (!m) return '未绑定'
  return m.real_name ? `${m.real_name}（${m.username}）` : m.username
})
async function loadMyMentor() {
  try {
    const res = await listMyMentor()
    if (res && res.success) mentor.value = res.mentor || null
  } catch (e) {
    mentor.value = null
  }
}
const tip = ref('')
const tipError = ref(false)

function fillForm(p) {
  const src = p || {}
  for (const k of Object.keys(EMPTY_FORM)) {
    form[k] = src[k] != null ? String(src[k]) : ''
  }
}

async function loadProfile() {
  try {
    const res = await getProfile()
    if (res && res.success) fillForm(res.profile)
  } catch (e) {}
}

async function onSave() {
  if (saving.value) return
  saving.value = true
  tip.value = ''
  tipError.value = false
  try {
    const res = await updateProfile({ ...form })
    if (res && res.success) {
      tip.value = res.message || '档案已保存'
      tipError.value = false
      fillForm(res.profile)
    } else {
      tip.value = (res && res.message) || '保存失败，请稍后重试'
      tipError.value = true
    }
  } catch (e) {
    tip.value = '保存失败，请稍后重试'
    tipError.value = true
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadProfile()
  loadMyGroups()
  if (isStudent.value) loadMyMentor()
})
</script>

<style scoped>
.profile-page { max-width: 640px; margin: 0 auto; }
.profile-card {
  display: flex; gap: 24px; align-items: flex-start;
  background: #fff; border-radius: 14px; padding: 28px 32px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
}
.profile-avatar {
  flex: 0 0 72px; width: 72px; height: 72px; border-radius: 50%;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  color: #fff; font-size: 30px; font-weight: 700;
  display: inline-flex; align-items: center; justify-content: center;
}
.profile-info { flex: 1 1 auto; }
.profile-name { margin: 0 0 8px; font-size: 22px; color: #1f2329; }
.profile-sub { display: flex; align-items: center; gap: 10px; margin: 0 0 18px; }
.role-tag {
  padding: 3px 12px; border-radius: 999px; font-size: 12px; font-weight: 600;
  color: #0d80e0; background: #eef6ff;
}
.username { font-size: 13px; color: #8a9099; }
.profile-groups { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: -6px 0 14px; }
.groups-label { font-size: 13px; color: #4e5969; }
.group-tag {
  padding: 2px 10px; border-radius: 999px; font-size: 12px;
  color: #19a558; background: #eef9f1; border: 1px solid #d4efdf;
}
.profile-detail { margin: 0; }
.detail-row { display: flex; padding: 8px 0; border-bottom: 1px dashed #eceff3; }
.detail-row:last-child { border-bottom: none; }
.detail-row dt { flex: 0 0 120px; font-size: 13px; color: #8a9099; }
.detail-row dd { flex: 1 1 auto; margin: 0; font-size: 13px; color: #1f2329; }

/* 档案表单 */
.form-card {
  margin-top: 18px; background: #fff; border-radius: 14px; padding: 24px 32px 28px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
}
.form-title { margin: 0 0 18px; font-size: 16px; color: #1f2329; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 18px; }
.form-field { display: flex; flex-direction: column; gap: 6px; }
.form-field.full { grid-column: 1 / -1; }
.field-label { font-size: 12px; color: #8a9099; }
.field-input {
  height: 36px; padding: 0 12px; font-size: 13px; color: #1f2329;
  border: 1px solid #dfe3e8; border-radius: 8px; outline: none; background: #fff;
  box-sizing: border-box;
}
.field-textarea { height: auto; padding: 8px 12px; line-height: 1.6; resize: vertical; }
.field-input:focus { border-color: #0d80e0; }
.field-input::placeholder { color: #b8bec4; }
.form-tip { margin: 14px 0 0; font-size: 13px; }
.form-tip.ok { color: #19a558; }
.form-tip.error { color: #ea4335; }
.form-actions { margin-top: 20px; display: flex; justify-content: flex-end; }
.save-btn {
  height: 38px; padding: 0 28px; border: none; border-radius: 8px; cursor: pointer;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  color: #fff; font-size: 14px; font-weight: 600;
}
.save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
