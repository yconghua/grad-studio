<template>
  <!-- 引导说明：标题 + 正文 + 进入聊天（未入组用户同样可发起会话） -->
  <main class="guide-main">
    <div class="guide-card">
      <h2 class="guide-title">{{ title }}</h2>
      <p class="guide-desc">{{ desc }}</p>
      <div class="guide-actions">
        <router-link to="/guide/chat" class="btn btn-primary">进入聊天</router-link>
      </div>
    </div>
  </main>
</template>

<script setup>
import { computed } from 'vue'
import { useSession } from '../../composables/useSession'
import { ROLE_MENTOR, ROLE_STUDENT, ROLE_GROUP_ADMIN } from '../../config/constants'

// 引导说明卡片：未入组导师 / 未入组学生 / 已入组未指定导师学生 / 组管异常未绑定课题组
// 四类状态共用同一页面，按 role / groupId / mentorId 计算文案，与服务端口径一致。
const { getSessionUser } = useSession()
const user = getSessionUser()

const GUIDE_META = {
  'mentor-no-group': {
    title: '你还没有加入课题组',
    desc: '请联系课题组管理员将你加入课题组。加入后即可查看组内公告、会议记录，并由组管为你指定名下学生。'
  },
  'student-no-group': {
    title: '你还没有加入课题组',
    desc: '请联系课题组管理员将你加入课题组。加入后即可查看组内公告和会议记录。'
  },
  'student-no-mentor': {
    title: '你还没有指定导师',
    desc: '你已加入课题组，但还没有指定导师。请联系课题组管理员为你指定导师。'
  },
  'admin-no-group': {
    title: '你当前未绑定课题组',
    desc: '请联系超级管理员为你重新绑定课题组。'
  }
}

const stateKey = computed(() => {
  if (!user) return 'student-no-group'
  if (user.role === ROLE_MENTOR || user.role === ROLE_STUDENT) {
    if (!user.groupId) return user.role === ROLE_MENTOR ? 'mentor-no-group' : 'student-no-group'
    if (user.role === ROLE_STUDENT && !user.mentorId) return 'student-no-mentor'
  }
  if (user.role === ROLE_GROUP_ADMIN && !user.groupId) return 'admin-no-group'
  return 'student-no-group'
})
const meta = computed(() => GUIDE_META[stateKey.value] || GUIDE_META['student-no-group'])
const title = computed(() => meta.value.title)
const desc = computed(() => meta.value.desc)
</script>

<style scoped>
.guide-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow: auto;
}
.guide-card {
  max-width: 460px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 40px 44px;
  text-align: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
}
.guide-title {
  margin: 0 0 14px;
  font-size: 20px;
  font-weight: 700;
  color: #1f2329;
}
.guide-desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.8;
  color: #6b7280;
}
.guide-actions {
  margin-top: 22px;
  display: flex;
  justify-content: center;
}
</style>
