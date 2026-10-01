<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">课题组成员</h2>
        <p class="page-sub">本课题组成员管理（不能创建新用户，只能从已有用户中选择加入）</p>
      </div>
    </div>

    <MemberManagePanel v-if="groupId" :group-id="groupId" :is-super="false" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import MemberManagePanel from '../../components/MemberManagePanel.vue'
import { getOwnGroup } from '../../api'

const groupId = ref(null)

onMounted(async () => {
  const res = await getOwnGroup()
  if (res && res.success) groupId.value = res.data.id
})
</script>
