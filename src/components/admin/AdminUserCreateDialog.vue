<template>
  <!-- 新增用户弹窗（超管用户管理页，账号密码 / 资料 两个 Tab） -->
  <div v-if="visible" class="modal-mask" @click.self="close">
    <div class="modal lg">
      <div class="modal-head">
        <h3>新增用户</h3>
        <button type="button" class="modal-close" @click="close">×</button>
      </div>
      <div class="modal-body">
        <div class="tabs">
          <button type="button" class="tab" :class="{ active: tab === 'account' }" @click="tab = 'account'">账号密码</button>
          <button type="button" class="tab" :class="{ active: tab === 'profile' }" @click="tab = 'profile'">资料</button>
        </div>

        <template v-if="tab === 'account'">
          <div class="form-grid">
            <div class="field">
              <label>用户名（区分大小写）</label>
              <input v-model.trim="form.username" class="input" placeholder="请输入用户名" maxlength="50" />
              <p class="hint">不超过 50 个字符，区分大小写</p>
            </div>
            <div class="field">
              <label>角色</label>
              <select v-model="form.role" class="select" @change="onRoleChange">
                <option v-for="(t, r) in CREATE_ROLES" :key="r" :value="r">{{ t }}</option>
              </select>
            </div>
            <div class="field">
              <label>密码</label>
              <input v-model="form.password" type="password" class="input" placeholder="留空则使用默认密码" />
              <p class="hint">留空将使用该角色默认密码：{{ DEFAULT_PASSWORD_BY_ROLE[form.role] }}；自定义密码至少 6 位且包含大小写字母</p>
            </div>
            <div class="field">
              <label>确认密码</label>
              <input v-model="form.confirmPassword" type="password" class="input" placeholder="请再次输入密码" />
            </div>
            <div class="field">
              <label>状态</label>
              <select v-model="form.status" class="select">
                <option :value="1">启用</option>
                <option :value="0">禁用</option>
              </select>
            </div>
          </div>
        </template>

        <template v-else>
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
              <select v-model="form.gender" class="select">
                <option :value="0">未知</option>
                <option :value="1">男</option>
                <option :value="2">女</option>
              </select>
            </div>
            <!-- 学号/工号：学生=学号，导师/管理员=工号（全局唯一，可空） -->
            <div class="field">
              <label>{{ userNoLabel }}</label>
              <input v-model.trim="form.userNo" class="input" :placeholder="`请输入${userNoLabel}（选填，全局唯一）`" maxlength="50" />
              <p class="hint">选填；{{ userNoLabel }}全局唯一，已被他人使用时会提示</p>
            </div>
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
            <div class="field field-full">
              <label>备注</label>
              <textarea v-model.trim="form.remark" class="input" rows="3" maxlength="500" style="min-height: 76px; resize: vertical" placeholder="选填，不超过 500 个字符"></textarea>
            </div>
            <div class="field field-full">
              <label>头像</label>
              <div class="avatar-preview">
                <img v-if="form.avatar" :src="avatarUrl(form.avatar)" class="avatar-lg" alt="头像" />
                <span v-else class="avatar avatar-empty avatar-lg">?</span>
                <div>
                  <button type="button" class="btn btn-sm" @click="chooseAvatar">选择头像</button>
                  <p class="hint">从本机选择图片文件，将复制到应用数据目录</p>
                </div>
              </div>
            </div>
            <!-- 课题组管理员不绑定课题组（绑定关系由课题组管理的「管理员」字段维护） -->
            <div class="field" v-if="form.role !== 'group_admin'">
              <label>所属课题组</label>
              <select v-model="form.groupId" class="select" @change="onGroupChange">
                <option value="">暂不加入课题组</option>
                <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
              </select>
            </div>
            <div class="field" v-if="form.role === 'student'">
              <label>导师（仅学生）</label>
              <select v-model="form.mentorId" class="select">
                <option value="">暂不指定导师</option>
                <option v-for="m in mentors" :key="m.id" :value="m.id">{{ m.realName || m.username }}</option>
              </select>
            </div>
          </div>
        </template>
      </div>
      <div class="modal-foot">
        <button class="btn" @click="close">取消</button>
        <button class="btn btn-primary" :disabled="saving" @click="saveCreate">{{ saving ? '保存中…' : '保存' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { listUsers, listGroups, createUser, pickAttachment } from '../../api'
import { dialogAlert } from '../../composables/useDialog'
import { avatarUrl } from '../../utils/avatar'
import { useAsyncList } from '../../composables/useAsyncList'
import { DEFAULT_PASSWORD_BY_ROLE } from '../../config/constants'

const props = defineProps({
  visible: { type: Boolean, default: false }
})
const emit = defineEmits(['update:visible', 'saved'])

const CREATE_ROLES = { group_admin: '课题组管理员', mentor: '导师', student: '学生' }
const tab = ref('account')
const saving = ref(false)
// 课题组 / 导师下拉：统一加载状态，失败时弹窗提示
const { data: groups, run: runGroups, error: groupsError } = useAsyncList(listGroups)
const { data: mentors, run: runMentors, error: mentorsError } = useAsyncList(listUsers)
async function loadGroups() {
  await runGroups()
  if (groupsError.value) dialogAlert(groupsError.value)
}
async function loadMentors() {
  await runMentors({ role: 'mentor', groupId: form.groupId })
  if (mentorsError.value) dialogAlert(mentorsError.value)
}

const emptyForm = () => ({
  username: '',
  password: '',
  confirmPassword: '',
  role: 'student',
  status: 1,
  realName: '',
  phone: '',
  email: '',
  gender: 0,
  avatar: '',
  userNo: '',
  education: '',
  degree: '',
  studyType: '',
  gradeYear: '',
  major: '',
  researchField: '',
  enrollYear: '',
  graduateYear: '',
  remark: '',
  groupId: '',
  mentorId: ''
})
const form = reactive(emptyForm())

// 学号/工号标签随角色：学生=学号，导师/管理员=工号
const userNoLabel = computed(() => (form.role === 'student' ? '学号' : '工号'))

// 打开弹窗：重置表单并加载课题组列表
watch(
  () => props.visible,
  async (v) => {
    if (!v) return
    Object.assign(form, emptyForm())
    tab.value = 'account'
    mentors.value = []
    loadGroups()
  }
)

function close() {
  emit('update:visible', false)
}

// 切换角色：课题组管理员不绑定课题组，清空已选课题组与导师
function onRoleChange() {
  if (form.role === 'group_admin') {
    form.groupId = ''
    form.mentorId = ''
    mentors.value = []
  }
}

// 选择课题组后加载该组导师（供指定导师）
async function onGroupChange() {
  form.mentorId = ''
  mentors.value = []
  if (!form.groupId) return
  await loadMentors()
}

// 选择头像：调用系统附件选择，复制到应用数据目录
async function chooseAvatar() {
  const res = await pickAttachment()
  if (res && res.success) form.avatar = res.path
  else if (res && !res.canceled) dialogAlert(res.message || '选择头像失败')
}

async function saveCreate() {
  if (!form.username) return dialogAlert('请输入用户名')
  if (form.password && form.password !== form.confirmPassword) return dialogAlert('两次输入的密码不一致')
  saving.value = true
  try {
    const res = await createUser({ ...form })
    if (res && res.success) {
      emit('saved')
      close()
    } else {
      dialogAlert((res && res.message) || '新增失败')
    }
  } finally {
    saving.value = false
  }
}
</script>
