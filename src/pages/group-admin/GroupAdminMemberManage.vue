<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">课题组成员</h2>
        <p class="page-sub">本课题组成员管理（不能创建新用户，只能从已有用户中选择加入）</p>
      </div>
    </div>

    <div v-if="groupStopped" class="banner banner-warn">课题组已停用，仅可查看与维护存量，不能加入新成员</div>

    <MemberManagePanel v-if="groupId" :group-id="groupId" :is-super="false" :disabled="groupStopped" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import MemberManagePanel from '../../components/MemberManagePanel.vue'
import { getOwnGroup } from '../../api'

const groupId = ref(null)
const groupStopped = ref(false)

onMounted(async () => {
  const res = await getOwnGroup()
  if (res && res.success) {
    groupId.value = res.data.id
    groupStopped.value = res.data.status === 0
  }
})
</script>

<style scoped>
.banner-warn {
  padding: 10px 14px;
  margin-bottom: 16px;
  border-radius: var(--radius-sm);
  background: var(--warning-soft);
  border: 1px solid color-mix(in srgb, var(--warning) 25%, var(--bg-card));
  color: var(--warning);
  font-size: 13px;
}
</style>
