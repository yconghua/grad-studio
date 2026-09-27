<template>
  <div class="group-selector">
    <span class="gs-label">课题组</span>
    <!-- 组列表可用：下拉选择（超管为全量组，其他角色为所属组） -->
    <select
      v-if="groups.length"
      class="gs-select"
      :value="currentGroupId || ''"
      @change="onSelect"
    >
      <option value="" disabled>请选择课题组</option>
      <option v-for="g in groups" :key="g.id" :value="g.id">
        {{ g.name }}（{{ g.code }}）{{ g.role_in_group ? '· ' + roleText(g.role_in_group) : '' }}
      </option>
    </select>
    <!-- 组列表为空 / 加载失败：手动输入 group_id 兜底 -->
    <input
      v-else
      class="gs-input"
      type="number"
      min="1"
      placeholder="输入课题组ID"
      :value="currentGroupId || ''"
      @change="onInput"
    />
    <span v-if="!currentGroupId" class="gs-tip">未设置</span>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useGroupContext } from '../composables/useGroupContext'

const { currentGroupId, groups, loadGroups, setGroupId } = useGroupContext()

// 组内角色文案（groupMine 返回的 role_in_group）
const ROLE_TEXT = { group_admin: '管理员', mentor: '导师', student: '学生' }
function roleText(r) {
  return ROLE_TEXT[r] || r
}

onMounted(() => {
  loadGroups()
})

function onSelect(e) {
  setGroupId(e.target.value)
}
function onInput(e) {
  setGroupId(e.target.value)
}
</script>

<style scoped>
.group-selector { display: inline-flex; align-items: center; gap: 8px; }
.gs-label { font-size: 13px; color: #4e5969; white-space: nowrap; }
.gs-select, .gs-input {
  height: 32px; padding: 0 10px; font-size: 13px;
  border: 1px solid #dfe3e8; border-radius: 8px; outline: none; background: #fff;
  color: #1f2329; min-width: 160px;
}
.gs-select:focus, .gs-input:focus { border-color: #0d80e0; }
.gs-input { width: 140px; }
.gs-tip { font-size: 12px; color: #ea4335; }
</style>
