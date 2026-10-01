<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">工作台</h2>
        <p class="page-sub">导师工作台（我的学生管理入口）</p>
      </div>
    </div>

    <div class="stat-cards">
      <div class="stat-card">
        <div class="num">{{ statStudents }}</div>
        <div class="label">我的学生</div>
      </div>
    </div>

    <div class="panel">
      <p class="panel-title">欢迎使用</p>
      <div class="desc-list">
        <div class="row"><span class="k">当前账号</span><span class="v">{{ user ? user.realName || user.username : '' }}</span></div>
        <div class="row"><span class="k">当前角色</span><span class="v">导师</span></div>
        <div class="row"><span class="k">快捷入口</span><span class="v">左侧菜单可查看自己名下的学生</span></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { listMyStudents } from '../../api'
import { useSession } from '../../composables/useSession'

// 导师独立工作台（与其他角色工作台为独立文件）
const { getSessionUser } = useSession()
const user = getSessionUser()

const statStudents = ref('-')

onMounted(async () => {
  const res = await listMyStudents({ page: 1 })
  if (res && res.success) statStudents.value = (res.data && res.data.total) || 0
})
</script>
