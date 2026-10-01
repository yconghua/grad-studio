<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">工作台</h2>
        <p class="page-sub">学生工作台（仅显示当前学生自己的信息）</p>
      </div>
    </div>

    <div class="panel" style="max-width: 640px">
      <p class="panel-title">欢迎使用</p>
      <div class="desc-list">
        <div class="row"><span class="k">用户名</span><span class="v">{{ user ? user.username : '' }}</span></div>
        <div class="row"><span class="k">真实姓名</span><span class="v">{{ user ? user.realName || '-' : '' }}</span></div>
        <div class="row"><span class="k">当前角色</span><span class="v">学生</span></div>
        <div class="row"><span class="k">所属课题组</span><span class="v">{{ user && user.groupId ? '已加入课题组（ID：' + user.groupId + '）' : '未加入课题组' }}</span></div>
        <div class="row"><span class="k">我的导师</span><span class="v">{{ user && user.mentorId ? '已指定导师（ID：' + user.mentorId + '）' : '暂未指定导师' }}</span></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getCurrentUser } from '../../api'
import { useSession } from '../../composables/useSession'

// 学生独立工作台（与其他角色工作台为独立文件）
const { getSessionUser } = useSession()
const user = ref(getSessionUser())

// 回库刷新，保证课题组 / 导师信息最新
onMounted(async () => {
  const res = await getCurrentUser()
  if (res && res.success) user.value = res.data
})
</script>
