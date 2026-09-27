<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">🗃️ 数据总览</h2>
        <p class="page-desc">按课题组 / 成员 / 用户 / 角色维度浏览平台全部业务数据（仅超级管理员可见）</p>
      </div>
    </div>

    <!-- 大导航 Tab -->
    <div class="tabs">
      <button v-for="t in tabs" :key="t.key" class="tab" :class="{ active: activeTab === t.key }" @click="switchTab(t.key)">
        {{ t.label }}
      </button>
    </div>

    <div class="ov-body">
      <!-- 左侧列表（小导航） -->
      <div class="side card">
        <!-- 角色模式：四个角色 -->
        <template v-if="activeTab === 'role'">
          <div class="side-title">选择角色</div>
          <div v-for="r in roleItems" :key="r.value" class="side-item role-item" :class="{ active: activeRole === r.value }"
            @click="selectRole(r.value)">
            <span class="role-name">{{ r.label }}</span>
            <span class="role-count">{{ roleCount(r.value) }} 人</span>
          </div>
        </template>

        <!-- 课题组 / 成员模式：课题组列表 -->
        <template v-else-if="activeTab === 'group' || activeTab === 'member'">
          <div class="side-title">{{ activeTab === 'member' ? '选择课题组（查看成员）' : '选择课题组' }}</div>
          <div v-if="loadingGroups" class="state">加载中…</div>
          <div v-else-if="!groups.length" class="state">暂无课题组</div>
          <div v-for="g in groups" :key="g.id" class="side-item" :class="{ active: activeGroupId === g.id }"
            @click="selectGroup(g)">
            <div class="side-main">{{ g.name }}（{{ g.code }}）</div>
            <div class="side-sub">管理员：{{ g.admin_username || '—' }} · 成员 {{ g.member_count }} 人</div>
          </div>
        </template>

        <!-- 用户模式：用户列表 -->
        <template v-else>
          <div class="side-title">选择用户</div>
          <div class="side-filter">
            <select v-model="userRoleFilter" class="input sm" @change="clearUserDetail">
              <option value="">全部角色</option>
              <option v-for="r in roleItems" :key="r.value" :value="r.value">{{ r.label }}</option>
            </select>
            <input v-model="userKeyword" class="input sm" placeholder="按账号/姓名过滤" />
          </div>
          <div v-if="loadingUsers" class="state">加载中…</div>
          <div v-else-if="!filteredUsers.length" class="state">暂无匹配用户</div>
          <div v-for="u in filteredUsers" :key="u.id" class="side-item" :class="{ active: activeUserId === u.id }"
            @click="selectUser(u)">
            <div class="side-main">{{ u.real_name ? `${u.real_name}（${u.username}）` : u.username }}</div>
            <div class="side-sub">{{ roleLabel(u.role) }} · {{ u.groups_text || '未入组' }}</div>
          </div>
        </template>
      </div>

      <!-- 右侧详情 -->
      <div class="main card">
        <!-- 课题组模式：组详情 -->
        <template v-if="activeTab === 'group'">
          <div v-if="!activeGroupId" class="state">👈 在左侧选择一个课题组查看全部业务数据</div>
          <template v-else>
            <div class="ctx-head">
              <span class="ctx-title">📌 {{ currentGroupName }}</span>
              <span class="ctx-sub">按课题组维度 · 全部业务模块</span>
            </div>
            <GroupDetail :detail="groupDetail" />
          </template>
        </template>

        <!-- 成员模式：成员表 → 成员详情 -->
        <template v-else-if="activeTab === 'member'">
          <div v-if="!activeGroupId" class="state">👈 在左侧选择一个课题组查看成员</div>
          <template v-else-if="memberUserId">
            <div class="ctx-head">
              <span class="ctx-title">🧑‍🎓 {{ memberUserName }}</span>
              <span class="ctx-sub">成员维度 · 全部业务模块</span>
              <button class="btn btn-mini back-btn" @click="memberUserId = null">← 返回成员列表</button>
            </div>
            <UserDetail :detail="userDetail" />
          </template>
          <template v-else>
            <div class="ctx-head">
              <span class="ctx-title">🧑‍🤝‍🧑 {{ currentGroupName }} · 成员列表</span>
              <span class="ctx-sub">{{ groupDetail && groupDetail.members ? groupDetail.members.length : 0 }} 人</span>
            </div>
            <div v-if="loadingGroupDetail" class="state">加载中…</div>
            <div v-else-if="!groupDetail || !groupDetail.members || !groupDetail.members.length" class="state">该课题组暂无成员</div>
            <table v-else class="tbl">
              <thead>
                <tr>
                  <th>账号</th><th>姓名</th><th>组内角色</th><th>状态</th><th>加入时间</th><th>备注</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in groupDetail.members" :key="m.id">
                  <td>{{ m.username }}</td>
                  <td>{{ m.real_name || '—' }}</td>
                  <td>{{ groupRoleLabel(m.role_in_group) }}</td>
                  <td>{{ statusLabel(m.member_status) }}</td>
                  <td>{{ fmtTime(m.joined_at) }}</td>
                  <td>{{ m.remark || '—' }}</td>
                  <td class="ops"><button class="link" @click="openMemberUser(m)">查看数据</button></td>
                </tr>
              </tbody>
            </table>
          </template>
        </template>

        <!-- 用户模式：用户详情 -->
        <template v-else-if="activeTab === 'user'">
          <div v-if="!activeUserId" class="state">👈 在左侧选择一个用户查看全部业务数据</div>
          <template v-else>
            <div class="ctx-head">
              <span class="ctx-title">👤 {{ currentUserName }}</span>
              <span class="ctx-sub">用户维度 · 全部业务模块</span>
            </div>
            <UserDetail :detail="userDetail" />
          </template>
        </template>

        <!-- 角色模式：角色用户表 → 用户详情 -->
        <template v-else>
          <div v-if="!activeRole" class="state">👈 在左侧选择一个角色查看用户列表</div>
          <template v-else-if="roleUserId">
            <div class="ctx-head">
              <span class="ctx-title">👤 {{ roleUserName }}</span>
              <span class="ctx-sub">角色：{{ roleLabel(activeRole) }} · 用户维度</span>
              <button class="btn btn-mini back-btn" @click="roleUserId = null">← 返回角色用户列表</button>
            </div>
            <UserDetail :detail="userDetail" />
          </template>
          <template v-else>
            <div class="ctx-head">
              <span class="ctx-title">👥 {{ roleLabel(activeRole) }}</span>
              <span class="ctx-sub">{{ roleUsers.length }} 个账号</span>
            </div>
            <div v-if="!roleUsers.length" class="state">该角色下暂无账号</div>
            <table v-else class="tbl">
              <thead>
                <tr>
                  <th>ID</th><th>账号</th><th>姓名</th><th>状态</th><th>需改密</th><th>所属课题组</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="u in roleUsers" :key="u.id">
                  <td>{{ u.id }}</td>
                  <td>{{ u.username }}</td>
                  <td>{{ u.real_name || '—' }}</td>
                  <td>{{ statusLabel(u.status) }}</td>
                  <td>{{ u.must_change_password ? '是' : '否' }}</td>
                  <td>{{ u.groups_text || '—' }}</td>
                  <td class="ops"><button class="link" @click="openRoleUser(u)">查看数据</button></td>
                </tr>
              </tbody>
            </table>
          </template>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  listOverviewGroups,
  getOverviewGroupDetail,
  listOverviewUsers,
  getOverviewUserDetail
} from '../../../api'
import GroupDetail from './GroupDetail.vue'
import UserDetail from './UserDetail.vue'

const tabs = [
  { key: 'group', label: '按课题组' },
  { key: 'member', label: '按成员' },
  { key: 'user', label: '按用户' },
  { key: 'role', label: '按角色' }
]
const roleItems = [
  { value: 'super_admin', label: '超级管理员' },
  { value: 'group_admin', label: '课题组管理员' },
  { value: 'mentor', label: '导师' },
  { value: 'student', label: '学生' }
]
function roleLabel(r) {
  const o = roleItems.find((x) => x.value === r)
  return o ? o.label : r
}
function groupRoleLabel(r) {
  return { group_admin: '课题组管理员', mentor: '导师', student: '学生' }[r] || r
}
function statusLabel(s) {
  return { active: '正常', disabled: '禁用', leave: '离组' }[s] || s
}
function fmtTime(s) {
  if (!s) return ''
  return String(s).replace('T', ' ').replace(/\.\d{3}Z$/, '').replace(/\.\d{3}$/, '').replace('Z', '')
}

const activeTab = ref('group')
const groups = ref([])
const users = ref([])
const loadingGroups = ref(false)
const loadingUsers = ref(false)

// 课题组相关
const activeGroupId = ref(null)
const groupDetail = ref(null)
const loadingGroupDetail = ref(false)
const currentGroupName = computed(() => {
  const g = groups.value.find((x) => x.id === activeGroupId.value)
  return g ? `${g.name}（${g.code}）` : ''
})

// 用户相关
const activeUserId = ref(null)
const userDetail = ref(null)
const loadingUserDetail = ref(false)
const currentUserName = ref('')
const userRoleFilter = ref('')
const userKeyword = ref('')

// 成员模式：成员下钻
const memberUserId = ref(null)
const memberUserName = ref('')

// 角色模式
const activeRole = ref('')
const roleUserId = ref(null)
const roleUserName = ref('')

function switchTab(key) {
  if (activeTab.value === key) return
  activeTab.value = key
  // 清空右栏上下文，避免跨 Tab 残留
  activeGroupId.value = null
  groupDetail.value = null
  activeUserId.value = null
  userDetail.value = null
  memberUserId.value = null
  roleUserId.value = null
  activeRole.value = ''
}

async function loadGroups() {
  loadingGroups.value = true
  try {
    const res = await listOverviewGroups()
    if (res && res.success) groups.value = res.groups || []
    else groups.value = []
  } catch (e) {
    groups.value = []
  } finally {
    loadingGroups.value = false
  }
}

async function loadUsers() {
  loadingUsers.value = true
  try {
    const res = await listOverviewUsers('')
    if (res && res.success) users.value = res.users || []
    else users.value = []
  } catch (e) {
    users.value = []
  } finally {
    loadingUsers.value = false
  }
}

async function selectGroup(g) {
  activeGroupId.value = g.id
  memberUserId.value = null
  roleUserId.value = null
  activeUserId.value = null
  userDetail.value = null
  loadingGroupDetail.value = true
  groupDetail.value = null
  try {
    const res = await getOverviewGroupDetail(g.id)
    if (res && res.success) groupDetail.value = res.data
    else groupDetail.value = null
  } catch (e) {
    groupDetail.value = null
  } finally {
    loadingGroupDetail.value = false
  }
}

async function loadUserDetail(userId) {
  loadingUserDetail.value = true
  userDetail.value = null
  try {
    const res = await getOverviewUserDetail(userId)
    if (res && res.success) userDetail.value = res.data
    else userDetail.value = null
  } catch (e) {
    userDetail.value = null
  } finally {
    loadingUserDetail.value = false
  }
}

function selectUser(u) {
  activeUserId.value = u.id
  currentUserName.value = u.real_name ? `${u.real_name}（${u.username}）` : u.username
  loadUserDetail(u.id)
}

function openMemberUser(m) {
  memberUserId.value = m.user_id
  memberUserName.value = m.real_name ? `${m.real_name}（${m.username}）` : m.username
  loadUserDetail(m.user_id)
}

function selectRole(r) {
  activeRole.value = r
  roleUserId.value = null
  activeGroupId.value = null
  groupDetail.value = null
  activeUserId.value = null
  userDetail.value = null
}

function openRoleUser(u) {
  roleUserId.value = u.id
  roleUserName.value = u.real_name ? `${u.real_name}（${u.username}）` : u.username
  loadUserDetail(u.id)
}

function clearUserDetail() {
  activeUserId.value = null
  userDetail.value = null
}

const filteredUsers = computed(() => {
  let list = users.value
  if (userRoleFilter.value) list = list.filter((u) => u.role === userRoleFilter.value)
  const k = userKeyword.value.trim().toLowerCase()
  if (k) {
    list = list.filter((u) => String(u.username).toLowerCase().includes(k) || String(u.real_name || '').toLowerCase().includes(k))
  }
  return list
})

const roleUsers = computed(() => users.value.filter((u) => u.role === activeRole.value))

function roleCount(r) {
  return users.value.filter((u) => u.role === r).length
}

onMounted(() => {
  loadGroups()
  loadUsers()
})
</script>

<style scoped>
.page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; justify-content: space-between; align-items: flex-start; }
.page-title { margin: 0; font-size: 18px; color: #1f2329; }
.page-desc { margin: 4px 0 0; font-size: 13px; color: #8a9099; }

.tabs { display: flex; gap: 8px; }
.tab {
  height: 34px; padding: 0 18px; border-radius: 8px; font-size: 13px; cursor: pointer;
  border: 1px solid #dfe3e8; background: #fff; color: #1f2329;
}
.tab:hover { border-color: #0d80e0; color: #0d80e0; }
.tab.active { background: linear-gradient(135deg, #0d80e0, #19a558); border: none; color: #fff; font-weight: 600; }

.ov-body { display: flex; gap: 16px; align-items: flex-start; }
.side { width: 300px; flex: 0 0 300px; max-height: calc(100vh - 220px); overflow-y: auto; }
.side-title { font-size: 13px; font-weight: 600; color: #4e5969; margin-bottom: 10px; }
.side-filter { display: flex; gap: 8px; margin-bottom: 10px; }
.side-filter .input.sm { flex: 1; min-width: 0; }
.side-item {
  padding: 10px 12px; border-radius: 8px; cursor: pointer; margin-bottom: 4px;
  border: 1px solid transparent;
}
.side-item:hover { background: #f2f7ff; }
.side-item.active { background: #eef6ff; border-color: #0d80e0; }
.side-main { font-size: 13px; color: #1f2329; font-weight: 600; }
.side-sub { font-size: 12px; color: #8a9099; margin-top: 2px; }
.role-item { display: flex; justify-content: space-between; align-items: center; }
.role-count { font-size: 12px; color: #0d80e0; background: #eef6ff; border-radius: 999px; padding: 2px 8px; }

.main { flex: 1; min-width: 0; max-height: calc(100vh - 220px); overflow-y: auto; }
.ctx-head { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.ctx-title { font-size: 15px; font-weight: 600; color: #1f2329; }
.ctx-sub { font-size: 12px; color: #8a9099; }
.back-btn { margin-left: auto; height: 28px; padding: 0 12px; font-size: 12px; }

.card {
  background: #fff; border: 1px solid #eceff3; border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04); padding: 16px;
}
.state { padding: 40px 0; text-align: center; color: #8a9099; font-size: 13px; }
.input {
  height: 34px; padding: 0 10px; font-size: 13px;
  border: 1px solid #dfe3e8; border-radius: 8px; outline: none; background: #fff; color: #1f2329;
}
.input:focus { border-color: #0d80e0; }
.btn { height: 34px; padding: 0 16px; border-radius: 8px; font-size: 13px; cursor: pointer; border: 1px solid #dfe3e8; background: #fff; color: #1f2329; }
.btn-mini { height: 28px; padding: 0 12px; font-size: 12px; }
.btn-mini:hover { border-color: #0d80e0; color: #0d80e0; }

.tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.tbl th { background: #f7f9fc; text-align: left; padding: 10px 12px; color: #4e5969; font-weight: 600; border-bottom: 1px solid #eceff3; }
.tbl td { padding: 10px 12px; border-bottom: 1px solid #eceff3; color: #1f2329; }
.tbl tbody tr:nth-child(even) { background: #fafbfc; }
.tbl tbody tr:hover { background: #eef6ff; }
.ops { display: flex; gap: 12px; }
.link { background: none; border: none; color: #0d80e0; cursor: pointer; font-size: 13px; padding: 0; }
</style>
