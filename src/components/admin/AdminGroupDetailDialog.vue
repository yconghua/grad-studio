<template>
  <div class="modal-mask" @click.self="$emit('close')">
    <div class="modal lg">
      <div class="modal-head">
        <h3>课题组详情</h3>
        <div class="head-actions">
          <select v-model="currentId" class="select" style="min-width: 200px" @change="onSwitch">
            <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
          </select>
          <button type="button" class="modal-close" @click="$emit('close')">×</button>
        </div>
      </div>
      <div class="modal-body">
        <template v-if="group">
          <!-- 基本信息 -->
          <div class="card">
            <div class="card-head"><h3>基本信息</h3></div>
            <div v-if="groupStopped" class="banner-warn">课题组已停用，仅可查看与维护存量，不能加入新成员</div>
            <div v-else-if="!group.adminUserId" class="banner-warn">本组暂无管理员，超管可指定新组管；公告、组会的日常运营由超管兜底</div>
            <div v-else-if="adminStopped" class="banner-warn">课题组管理员已停用，无法登录处理组内事务，超管可指定新组管或临时接管</div>
            <div class="info-grid">
              <div class="info-item"><label>课题组名称</label><span>{{ group.name }}</span></div>
              <div class="info-item"><label>唯一标识号</label><span class="mono">{{ group.code }}</span></div>
              <div class="info-item"><label>描述</label><span>{{ group.description || '-' }}</span></div>
              <div class="info-item"><label>管理员</label><span>{{ adminName(group.adminUserId) }}</span></div>
              <div class="info-item"><label>状态</label><span><span :class="statusTagClass(group.status)">{{ statusText(group.status) }}</span></span></div>
              <div class="info-item"><label>创建时间</label><span>{{ group.createdAt || '-' }}</span></div>
            </div>
          </div>

          <!-- 概况统计 -->
          <div class="stat-grid">
            <div class="stat-card"><div class="stat-num">{{ memberStats ? memberStats.mentorCount : '-' }}</div><div class="stat-label">导师</div></div>
            <div class="stat-card"><div class="stat-num">{{ memberStats ? memberStats.studentCount : '-' }}</div><div class="stat-label">学生</div></div>
            <div class="stat-card"><div class="stat-num">{{ memberStats ? memberStats.unassignedCount : '-' }}</div><div class="stat-label">未指定导师学生</div></div>
            <div class="stat-card"><div class="stat-num">{{ noticeTotal }}</div><div class="stat-label">公告数</div></div>
            <div class="stat-card"><div class="stat-num">{{ meetingStats ? meetingStats.total : '-' }}</div><div class="stat-label">组会总数</div></div>
            <div class="stat-card"><div class="stat-num">{{ meetingStats ? meetingStats.monthTotal : '-' }}</div><div class="stat-label">本月组会</div></div>
            <div class="stat-card"><div class="stat-num">{{ meetingStats ? meetingStats.participationRate : '-' }}</div><div class="stat-label">参与率</div></div>
          </div>

          <!-- 成员管理 -->
          <MemberManagePanel :group-id="currentId" :is-super="true" :disabled="groupStopped" />
        </template>
        <div v-else class="empty">{{ groups.length ? '加载中…' : '暂无课题组数据' }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import MemberManagePanel from '../member/MemberManagePanel.vue'
import { listGroups, getGroup, listUsers, listNotices, getMeetingStats } from '../../api'
import { superGetMemberStats } from '../../api/member'
import { fetchAll } from '../../utils/fetchAll'
import { statusText, statusTagClass } from '../../utils/labels'

// 超管「课题组设置」列表内嵌的课题组详情弹窗：从列表行传入 groupId
const props = defineProps({
  groupId: { type: Number, required: true }
})
defineEmits(['close'])

const groups = ref([])
const currentId = ref(0)
const group = ref(null)
const memberStats = ref(null)
const noticeTotal = ref(0)
const meetingStats = ref(null)
const admins = ref([])
const groupStopped = computed(() => group.value != null && group.value.status === 0)
// 管理员已停用：adminUserId 指向的用户账号为停用状态
const adminStopped = computed(() => {
  if (!group.value || !group.value.adminUserId) return false
  const a = admins.value.find((x) => x.id === Number(group.value.adminUserId))
  return !!a && a.status === 0
})

async function load() {
  group.value = null
  memberStats.value = null
  meetingStats.value = null
  noticeTotal.value = 0
  const gid = currentId.value
  const [gr, ms, ns, mg] = await Promise.all([
    getGroup(gid),
    superGetMemberStats(gid),
    listNotices({ groupId: gid, page: 1 }),
    getMeetingStats(gid)
  ])
  if (gr && gr.success) group.value = gr.data
  if (ms && ms.success) memberStats.value = ms.data
  if (ns && ns.success) noticeTotal.value = ns.data.total || 0
  if (mg && mg.success) meetingStats.value = mg.data
}

function onSwitch() {
  load()
}

function adminName(adminUserId) {
  if (!adminUserId) return '-'
  const a = admins.value.find((x) => x.id === Number(adminUserId))
  return a ? a.realName || a.username : `用户 #${adminUserId}`
}

onMounted(async () => {
  groups.value = await fetchAll(listGroups)
  currentId.value = props.groupId
  admins.value = await fetchAll(listUsers, { role: 'group_admin' })
  if (currentId.value) load()
})
</script>

<style scoped>
.head-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 16px;
  margin-bottom: 16px;
}
.card-head h3 {
  font-size: 15px;
  color: var(--text);
  margin: 0 0 12px;
}
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.info-item label {
  font-size: 12px;
  color: var(--muted);
}
.info-item span {
  font-size: 13px;
  color: var(--text);
}
.mono {
  font-family: monospace;
  font-size: 12px;
}
.banner-warn {
  padding: 10px 14px;
  margin-bottom: 16px;
  border-radius: var(--radius-sm);
  background: var(--warning-soft);
  border: 1px solid color-mix(in srgb, var(--warning) 25%, var(--bg-card));
  color: var(--warning);
  font-size: 13px;
}
.stat-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}
.stat-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 12px 16px;
  min-width: 110px;
  max-width: 150px;
  text-align: center;
}
.stat-num {
  font-size: 20px;
  font-weight: 600;
  color: var(--primary);
}
.stat-label {
  font-size: 12px;
  color: var(--muted);
  margin-top: 4px;
}
</style>
