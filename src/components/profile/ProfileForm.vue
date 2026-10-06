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
        <!-- 学号/工号：学生=学号，导师/管理员=工号；由管理员维护，此处只读 -->
        <div class="row" v-if="user && user.userNo"><span class="k">{{ userNoLabel }}</span><span class="v">{{ user.userNo }}</span></div>
        <div class="row" v-if="user && user.remark"><span class="k">备注</span><span class="v">{{ user.remark }}</span></div>
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

      <!-- 学业资料（可编辑）：学历 / 学位 / 日制 / 年级 / 专业 / 研究方向 / 入学年份 / 毕业年份 -->
      <p class="panel-title" style="margin-top: 20px">学业资料</p>
      <div class="form-grid">
        <div class="field">
          <label>学历</label>
          <select v-model="education" class="select">
            <option value="">未设置</option>
            <option value="专科">专科</option>
            <option value="本科">本科</option>
            <option value="研究生">研究生</option>
          </select>
        </div>
        <div class="field">
          <label>学位</label>
          <select v-model="degree" class="select">
            <option value="">未设置</option>
            <option value="无">无</option>
            <option value="学士">学士</option>
            <option value="硕士">硕士</option>
            <option value="博士">博士</option>
          </select>
        </div>
        <div class="field">
          <label>日制</label>
          <select v-model="studyType" class="select">
            <option value="">未设置</option>
            <option value="全日制">全日制</option>
            <option value="非全日制">非全日制</option>
          </select>
        </div>
        <div class="field">
          <label>年级</label>
          <input v-model.trim="gradeYear" class="input" placeholder="如 2025 / 2026" maxlength="4" />
          <p class="hint">4 位年份，选填</p>
        </div>
        <div class="field">
          <label>专业</label>
          <input v-model.trim="major" class="input" placeholder="请输入专业" maxlength="100" />
          <p class="hint">选填，不超过 100 个字符</p>
        </div>
        <div class="field">
          <label>研究方向</label>
          <input v-model.trim="researchField" class="input" placeholder="请输入研究方向" maxlength="200" />
          <p class="hint">选填，不超过 200 个字符</p>
        </div>
        <div class="field">
          <label>入学年份</label>
          <input v-model.trim="enrollYear" class="input" placeholder="4 位数字" maxlength="4" />
        </div>
        <div class="field">
          <label>毕业年份</label>
          <input v-model.trim="graduateYear" class="input" placeholder="4 位数字" maxlength="4" />
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
// 学业资料（个人可编辑；学号/工号、备注由管理员维护）
const education = ref('')
const degree = ref('')
const studyType = ref('')
const gradeYear = ref('')
const major = ref('')
const researchField = ref('')
const enrollYear = ref('')
const graduateYear = ref('')
const saving = ref(false)
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const changingPwd = ref(false)

// 学号/工号标签随角色：学生=学号，导师/管理员=工号
const userNoLabel = computed(() => (user.value && user.value.role === 'student' ? '学号' : '工号'))

// 用一份用户数据回填页面状态（加载与保存后共用，保证所见即所得）
function applyUser(d) {
  user.value = d
  realName.value = d.realName || ''
  phone.value = d.phone || ''
  email.value = d.email || ''
  gender.value = d.gender || 0
  avatar.value = d.avatar || ''
  education.value = d.education || ''
  degree.value = d.degree || ''
  studyType.value = d.studyType || ''
  gradeYear.value = d.gradeYear || ''
  major.value = d.major || ''
  researchField.value = d.researchField || ''
  enrollYear.value = d.enrollYear || ''
  graduateYear.value = d.graduateYear || ''
}

async function load() {
  const res = await getCurrentUser()
  if (!res || !res.success) {
    dialogAlert((res && res.message) || '加载个人资料失败')
    return
  }
  applyUser(res.data)
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
      avatar: avatar.value,
      education: education.value,
      degree: degree.value,
      studyType: studyType.value,
      gradeYear: gradeYear.value,
      major: major.value,
      researchField: researchField.value,
      enrollYear: enrollYear.value,
      graduateYear: graduateYear.value
    })
    if (res && res.success) {
      // 保存返回的是完整最新资料：立即回填页面，再同步本地会话快照与全局刷新
      applyUser(res.data)
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
