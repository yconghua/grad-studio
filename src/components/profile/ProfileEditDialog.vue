<template>
  <div v-if="open" class="modal-mask" @click.self="close">
    <div class="modal profile-edit-dialog">
      <div class="modal-head">
        <h3>修改资料</h3>
        <button type="button" class="modal-close" @click="close">×</button>
      </div>
      <div class="modal-body">
        <p class="section-title">基本信息</p>
        <div class="form-grid">
          <div class="field">
            <label>真实姓名</label>
            <input v-model.trim="form.realName" class="input" placeholder="请输入真实姓名" maxlength="50" />
            <p class="hint">不超过 50 个字符</p>
          </div>
          <div class="field">
            <label>手机号</label>
            <input v-model.trim="form.phone" class="input" placeholder="请输入手机号" maxlength="20" />
            <p class="hint">不超过 20 个字符</p>
          </div>
          <div class="field">
            <label>邮箱</label>
            <input v-model.trim="form.email" class="input" placeholder="请输入邮箱" maxlength="100" />
            <p class="hint">不超过 100 个字符</p>
          </div>
          <div class="field">
            <label>性别</label>
            <select v-model.number="form.gender" class="select">
              <option :value="0">未知</option>
              <option :value="1">男</option>
              <option :value="2">女</option>
            </select>
          </div>
          <div class="field field-full">
            <label>头像</label>
            <div class="avatar-preview">
              <img v-if="form.avatar" :src="avatarUrl(form.avatar)" class="avatar-lg" alt="头像" />
              <span v-else class="avatar avatar-empty avatar-lg">?</span>
              <div>
                <button type="button" class="btn btn-sm" @click="chooseAvatar">选择头像</button>
                <button type="button" class="btn btn-sm" v-if="form.avatar" @click="form.avatar = ''">移除头像</button>
                <p class="hint">从本机选择图片文件，将复制到应用数据目录</p>
              </div>
            </div>
          </div>
        </div>

        <p class="section-title">学业资料</p>
        <div class="form-grid">
          <div class="field">
            <label>学历</label>
            <select v-model="form.education" class="select">
              <option value="">未设置</option>
              <option value="专科">专科</option>
              <option value="本科">本科</option>
              <option value="研究生">研究生</option>
            </select>
          </div>
          <div class="field">
            <label>学位</label>
            <select v-model="form.degree" class="select">
              <option value="">未设置</option>
              <option value="无">无</option>
              <option value="学士">学士</option>
              <option value="硕士">硕士</option>
              <option value="博士">博士</option>
            </select>
          </div>
          <div class="field">
            <label>日制</label>
            <select v-model="form.studyType" class="select">
              <option value="">未设置</option>
              <option value="全日制">全日制</option>
              <option value="非全日制">非全日制</option>
            </select>
          </div>
          <div class="field">
            <label>年级</label>
            <input v-model.trim="form.gradeYear" class="input" placeholder="如 2025 / 2026" maxlength="4" />
            <p class="hint">4 位年份，选填</p>
          </div>
          <div class="field">
            <label>专业</label>
            <input v-model.trim="form.major" class="input" placeholder="请输入专业" maxlength="100" />
            <p class="hint">选填，不超过 100 个字符</p>
          </div>
          <div class="field">
            <label>研究方向</label>
            <input v-model.trim="form.researchField" class="input" placeholder="请输入研究方向" maxlength="200" />
            <p class="hint">选填，不超过 200 个字符</p>
          </div>
          <div class="field">
            <label>入学年份</label>
            <input v-model.trim="form.enrollYear" class="input" placeholder="4 位数字" maxlength="4" />
          </div>
          <div class="field">
            <label>毕业年份</label>
            <input v-model.trim="form.graduateYear" class="input" placeholder="4 位数字" maxlength="4" />
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn" @click="close">取消</button>
        <button type="button" class="btn btn-primary" :disabled="saving" @click="save">
          {{ saving ? '保存中…' : '保存' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'
import { updateOwnProfile, pickAttachment } from '../../api'
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'
import { avatarUrl } from '../../utils/avatar'

// 个人资料编辑弹窗：只承担「基本资料 + 学业资料」的编辑与提交；
// 页面侧的展示、会话同步、全局刷新由 ProfileForm 处理。
// 字段与 userService.updateOwnProfile 的白名单严格一致（学号/工号、备注、课题组、导师不在此处）。
const props = defineProps({
  open: { type: Boolean, default: false },
  user: { type: Object, default: null }
})
const emit = defineEmits(['update:open', 'saved'])

const EMPTY = {
  realName: '',
  phone: '',
  email: '',
  gender: 0,
  avatar: '',
  education: '',
  degree: '',
  studyType: '',
  gradeYear: '',
  major: '',
  researchField: '',
  enrollYear: '',
  graduateYear: ''
}

const form = reactive({ ...EMPTY })
const saving = ref(false)
let snapshot = ''

function fillFromUser() {
  const u = props.user || {}
  form.realName = u.realName || ''
  form.phone = u.phone || ''
  form.email = u.email || ''
  form.gender = Number(u.gender) || 0
  form.avatar = u.avatar || ''
  form.education = u.education || ''
  form.degree = u.degree || ''
  form.studyType = u.studyType || ''
  form.gradeYear = u.gradeYear || ''
  form.major = u.major || ''
  form.researchField = u.researchField || ''
  form.enrollYear = u.enrollYear || ''
  form.graduateYear = u.graduateYear || ''
  snapshot = JSON.stringify(form)
}

// 仅打开时回填：页面后台静默刷新替换 user 时不覆盖用户正在编辑的内容
watch(
  () => props.open,
  (v) => {
    if (!v) return
    saving.value = false
    fillFromUser()
  },
  { immediate: true }
)

async function chooseAvatar() {
  const res = await pickAttachment()
  if (res && res.success) form.avatar = res.path
  else if (res && !res.canceled) dialogAlert(res.message || '选择头像失败')
}

// 前端校验与后端限制保持一致（服务端仍是唯一可信校验）
function validate() {
  if (form.realName.length > 50) { dialogAlert('真实姓名不能超过 50 个字符'); return false }
  if (form.phone.length > 20) { dialogAlert('手机号不能超过 20 个字符'); return false }
  if (form.email.length > 100) { dialogAlert('邮箱不能超过 100 个字符'); return false }
  if (![0, 1, 2].includes(Number(form.gender))) { dialogAlert('性别参数不合法'); return false }
  if (form.gradeYear && !/^\d{4}$/.test(form.gradeYear)) { dialogAlert('年级须为 4 位年份（如 2025 / 2026）'); return false }
  if (form.major.length > 100) { dialogAlert('专业不能超过 100 个字符'); return false }
  if (form.researchField.length > 200) { dialogAlert('研究方向不能超过 200 个字符'); return false }
  if (form.enrollYear && !/^\d{4}$/.test(form.enrollYear)) { dialogAlert('入学年份须为 4 位数字'); return false }
  if (form.graduateYear && !/^\d{4}$/.test(form.graduateYear)) { dialogAlert('毕业年份须为 4 位数字'); return false }
  return true
}

async function save() {
  if (saving.value) return
  if (!validate()) return
  saving.value = true
  try {
    const res = await updateOwnProfile({
      realName: form.realName,
      phone: form.phone,
      email: form.email,
      gender: Number(form.gender),
      avatar: form.avatar,
      education: form.education,
      degree: form.degree,
      studyType: form.studyType,
      gradeYear: form.gradeYear,
      major: form.major,
      researchField: form.researchField,
      enrollYear: form.enrollYear,
      graduateYear: form.graduateYear
    })
    if (res && res.success) {
      snapshot = JSON.stringify(form)
      emit('saved', res.data)
      emit('update:open', false)
    } else {
      dialogAlert((res && res.message) || '保存失败')
    }
  } finally {
    saving.value = false
  }
}

async function close() {
  if (JSON.stringify(form) !== snapshot) {
    const ok = await dialogConfirm('资料尚未保存，确定放弃并关闭吗？', '未保存的资料')
    if (!ok) return
  }
  emit('update:open', false)
}
</script>

<style scoped>
.modal.profile-edit-dialog {
  width: 680px;
  max-width: calc(92vw / var(--app-font-zoom, 1));
}
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin: 4px 0 10px;
}
.section-title + .form-grid {
  margin-bottom: 18px;
}
.avatar-preview {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
