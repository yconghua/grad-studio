<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">{{ title }}</h2>
        <p class="page-sub">{{ subtitle }}</p>
      </div>
      <div v-if="user" class="page-actions">
        <button type="button" class="btn" @click="editVisible = true">修改资料</button>
        <button type="button" class="btn" @click="pwdVisible = true">修改密码</button>
      </div>
    </div>

    <div class="panel" v-if="!user">
      <div class="empty">加载中…</div>
    </div>

    <template v-else>
      <div class="panel" style="max-width: 640px">
        <!-- 账号信息（只读） -->
        <p class="panel-title">账号信息</p>
        <div class="desc-list">
          <div class="row"><span class="k">用户名</span><span class="v">{{ user.username || '-' }}</span></div>
          <div class="row"><span class="k">角色</span><span class="v">{{ roleText(user.role) || '-' }}</span></div>
          <div class="row" v-if="user.groupId"><span class="k">所属课题组</span><span class="v">{{ user.groupName || ('课题组 #' + user.groupId) }}</span></div>
          <div class="row" v-if="user.mentorId"><span class="k">导师</span><span class="v">{{ mentorLabel }}</span></div>
          <!-- 学号/工号：学生=学号，导师/管理员=工号；由管理员维护，此处只读 -->
          <div class="row" v-if="user.userNo"><span class="k">{{ userNoLabel }}</span><span class="v">{{ user.userNo }}</span></div>
          <div class="row" v-if="user.remark"><span class="k">备注</span><span class="v">{{ user.remark }}</span></div>
        </div>

        <!-- 基本资料（只读）：修改走「修改资料」弹窗 -->
        <p class="panel-title" style="margin-top: 20px">基本资料</p>
        <div class="desc-list">
          <div class="row">
            <span class="k">头像</span>
            <span class="v">
              <img v-if="user.avatar" :src="avatarUrl(user.avatar)" class="avatar-lg avatar-readonly" alt="头像" />
              <span v-else class="avatar avatar-empty avatar-lg">?</span>
            </span>
          </div>
          <div class="row"><span class="k">真实姓名</span><span class="v">{{ user.realName || '-' }}</span></div>
          <div class="row"><span class="k">手机号</span><span class="v">{{ user.phone || '-' }}</span></div>
          <div class="row"><span class="k">邮箱</span><span class="v">{{ user.email || '-' }}</span></div>
          <div class="row"><span class="k">性别</span><span class="v">{{ genderText }}</span></div>
        </div>

        <!-- 学业资料（只读）：与基本资料同一弹窗一起修改 -->
        <p class="panel-title" style="margin-top: 20px">学业资料</p>
        <div class="desc-list">
          <div class="row"><span class="k">学历</span><span class="v">{{ user.education || '-' }}</span></div>
          <div class="row"><span class="k">学位</span><span class="v">{{ user.degree || '-' }}</span></div>
          <div class="row"><span class="k">日制</span><span class="v">{{ user.studyType || '-' }}</span></div>
          <div class="row"><span class="k">年级</span><span class="v">{{ user.gradeYear || '-' }}</span></div>
          <div class="row"><span class="k">专业</span><span class="v">{{ user.major || '-' }}</span></div>
          <div class="row"><span class="k">研究方向</span><span class="v">{{ user.researchField || '-' }}</span></div>
          <div class="row"><span class="k">入学年份</span><span class="v">{{ user.enrollYear || '-' }}</span></div>
          <div class="row"><span class="k">毕业年份</span><span class="v">{{ user.graduateYear || '-' }}</span></div>
        </div>

        <!-- 安全设置（只读）：密码修改走「修改密码」弹窗 -->
        <p class="panel-title" style="margin-top: 20px">安全设置</p>
        <div class="desc-list">
          <div class="row">
            <span class="k">登录密码</span>
            <span class="v">
              已设置
              <span v-if="user.mustChangePassword" class="pwd-warn">（当前仍是初始密码，建议立即修改）</span>
            </span>
          </div>
        </div>
      </div>
    </template>

    <ProfileEditDialog v-model:open="editVisible" :user="user" @saved="onProfileSaved" />
    <PasswordChangeDialog v-model:open="pwdVisible" :username="(user && user.username) || ''" @changed="onPasswordChanged" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import ProfileEditDialog from './ProfileEditDialog.vue'
import PasswordChangeDialog from './PasswordChangeDialog.vue'
import { getCurrentUser } from '../../api'
import { dialogAlert } from '../../composables/useDialog'
import { refreshAfterWrite } from '../../composables/useGlobalRefresh'
import { useAutoRefresh } from '../../composables/useAutoRefresh'
import { useSession } from '../../composables/useSession'
import { roleText } from '../../utils/labels'
import { avatarUrl } from '../../utils/avatar'

// 个人资料页（各角色复用）：整页只读展示，修改入口统一为两个弹窗
//   - 「修改资料」：基本资料 + 学业资料（ProfileEditDialog）
//   - 「修改密码」：原密码校验 + 强度校验（PasswordChangeDialog，成功后强制重登）
defineProps({
  title: { type: String, default: '个人资料' },
  subtitle: { type: String, default: '' }
})

const { setSession, clearSession } = useSession()
const router = useRouter()

const user = ref(null)
const editVisible = ref(false)
const pwdVisible = ref(false)

// 导师展示：优先「姓名（账号）」，无姓名时显示账号，兜底导师 #id
const mentorLabel = computed(() => {
  if (!user.value || !user.value.mentorId) return '-'
  const name = user.value.mentorRealName
  const acc = user.value.mentorUsername
  if (name) return `${name}（${acc || ''}）`
  return acc || ('导师 #' + user.value.mentorId)
})
// 学号/工号标签随角色：学生=学号，导师/管理员=工号
const userNoLabel = computed(() => (user.value && user.value.role === 'student' ? '学号' : '工号'))
const GENDER_TEXT = { 0: '未知', 1: '男', 2: '女' }
const genderText = computed(() => {
  if (!user.value) return '-'
  const g = Number(user.value.gender) || 0
  return GENDER_TEXT[g] || '未知'
})

async function load() {
  const res = await getCurrentUser()
  if (!res || !res.success) {
    dialogAlert((res && res.message) || '加载个人资料失败')
    return
  }
  user.value = res.data
}

// 资料保存成功：后端返回完整最新资料，回填页面 + 同步本地会话 + 全局刷新
async function onProfileSaved(dto) {
  if (!dto) {
    load()
    return
  }
  user.value = dto
  setSession(dto)
  await refreshAfterWrite('保存成功')
}

// 密码修改成功：清除本地会话并回登录页，强制用新密码重新登录
function onPasswordChanged() {
  clearSession()
  router.replace('/login')
  dialogAlert('密码已修改，请使用新密码重新登录')
}

onMounted(load)
// 数据变动（本页写操作或外部改动）后后台静默重拉，保持资料最新
useAutoRefresh(load)
</script>

<style scoped>
.page-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.avatar-readonly {
  width: 56px;
  height: 56px;
}
.avatar-empty.avatar-lg {
  width: 56px;
  height: 56px;
}
.pwd-warn {
  color: var(--warning, #d97706);
  font-size: 12px;
}
</style>
