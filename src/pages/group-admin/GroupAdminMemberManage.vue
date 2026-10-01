<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">课题组成员</h2>
        <p class="page-sub">本课题组成员管理（不能创建新用户，只能从已有用户中选择加入）</p>
      </div>
    </div>

    <div class="tabs">
      <button type="button" class="tab" :class="{ active: tab === 'members' }" @click="tab = 'members'; loadMembers()">成员管理</button>
      <button type="button" class="tab" :class="{ active: tab === 'students' }" @click="tab = 'students'; loadStudents()">学生与导师</button>
    </div>

    <!-- ===== 成员管理 ===== -->
    <template v-if="tab === 'members'">
      <div class="toolbar">
        <select v-model="mRole" class="select">
          <option value="">全部角色</option>
          <option value="mentor">导师</option>
          <option value="student">学生</option>
        </select>
        <input v-model="mKeyword" class="input" style="width: 220px" placeholder="用户名 / 真实姓名" @keyup.enter="mSearch" />
        <button class="btn btn-primary" @click="mSearch">查询</button>
        <button class="btn" @click="mReset">重置</button>
        <div class="spacer"></div>
        <button class="btn btn-primary" @click="openAdd">添加成员</button>
      </div>

      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>ID</th>
              <th>用户名</th>
              <th>真实姓名</th>
              <th>角色</th>
              <th>状态</th>
              <th>手机号</th>
              <th style="width: 90px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in members" :key="u.id" @click="openDetail(u, memberDetailFields, '成员详情')">
              <td>{{ u.id }}</td>
              <td class="ellipsis">{{ u.username }}</td>
              <td class="ellipsis">{{ u.realName || '-' }}</td>
              <td><span class="tag tag-blue">{{ roleText(u.role) }}</span></td>
              <td><span :class="statusTagClass(u.status)">{{ statusText(u.status) }}</span></td>
              <td>{{ u.phone || '-' }}</td>
              <td>
                <div class="ops" @click.stop>
                  <button class="btn btn-sm btn-danger" @click="doRemove(u)">移除</button>
                </div>
              </td>
            </tr>
            <tr v-if="members.length === 0">
              <td colspan="7"><div class="empty">暂无成员</div></td>
            </tr>
          </tbody>
        </table>
        <div class="pager">
          <button class="btn btn-sm" :disabled="mPage <= 1" @click="mPage--; loadMembers()">上一页</button>
          <span>第 {{ mPage }} / {{ mTotalPages || 1 }} 页</span>
          <button class="btn btn-sm" :disabled="mPage >= mTotalPages" @click="mPage++; loadMembers()">下一页</button>
          <span>共 {{ mTotal }} 条</span>
        </div>
      </div>
    </template>

    <!-- ===== 学生与导师 ===== -->
    <template v-else>
      <div class="toolbar">
        <input v-model="sKeyword" class="input" style="width: 220px" placeholder="用户名 / 真实姓名" @keyup.enter="sSearch" />
        <button class="btn btn-primary" @click="sSearch">查询</button>
        <button class="btn" @click="sReset">重置</button>
      </div>

      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>ID</th>
              <th>用户名</th>
              <th>真实姓名</th>
              <th>手机号</th>
              <th>当前导师</th>
              <th style="width: 220px">指定导师</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in students" :key="u.id" @click="openDetail(u, studentDetailFields, '学生详情')">
              <td>{{ u.id }}</td>
              <td class="ellipsis">{{ u.username }}</td>
              <td class="ellipsis">{{ u.realName || '-' }}</td>
              <td>{{ u.phone || '-' }}</td>
              <td>{{ mentorName(u.mentorId) }}</td>
              <td>
                <div class="ops" @click.stop>
                  <select v-model="mentorPick[u.id]" class="select" style="flex: 1">
                    <option value="">暂不指定</option>
                    <option v-for="m in mentors" :key="m.id" :value="m.id">{{ m.realName || m.username }}</option>
                  </select>
                  <button class="btn btn-sm btn-primary" @click="doSetMentor(u)">保存</button>
                </div>
              </td>
            </tr>
            <tr v-if="students.length === 0">
              <td colspan="6"><div class="empty">暂无学生</div></td>
            </tr>
          </tbody>
        </table>
        <div class="pager">
          <button class="btn btn-sm" :disabled="sPage <= 1" @click="sPage--; loadStudents()">上一页</button>
          <span>第 {{ sPage }} / {{ sTotalPages || 1 }} 页</span>
          <button class="btn btn-sm" :disabled="sPage >= sTotalPages" @click="sPage++; loadStudents()">下一页</button>
          <span>共 {{ sTotal }} 条</span>
        </div>
      </div>
    </template>

    <!-- 添加成员弹窗：从已有用户（未入组）中选择加入 -->
    <div v-if="showAdd" class="modal-mask" @click.self="showAdd = false">
      <div class="modal">
        <div class="modal-head">
          <h3>选择用户加入课题组</h3>
          <button type="button" class="modal-close" @click="showAdd = false">×</button>
        </div>
        <div class="modal-body">
          <div class="toolbar" style="margin: 0 0 12px">
            <select v-model="addRole" class="select" @change="loadCandidates">
              <option value="mentor">导师</option>
              <option value="student">学生</option>
            </select>
            <input v-model="addKeyword" class="input" style="flex: 1" placeholder="搜索用户名 / 真实姓名" @keyup.enter="loadCandidates" />
            <button class="btn btn-primary" @click="loadCandidates">搜索</button>
          </div>
          <div class="cand-list">
            <label v-for="c in candidates" :key="c.id" class="cand-item">
              <input type="checkbox" :value="c.id" v-model="checkedIds" />
              <span>{{ c.realName || c.username }}（{{ c.username }} · {{ roleText(c.role) }}）</span>
            </label>
            <p v-if="candidates.length === 0" class="empty">暂无未入组的{{ addRole === 'mentor' ? '导师' : '学生' }}可选</p>
          </div>
          <p class="hint">只能选择未加入任何课题组的{{ addRole === 'mentor' ? '导师' : '学生' }}；已选择 {{ checkedIds.length }} 人</p>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="showAdd = false">取消</button>
          <button class="btn btn-primary" :disabled="saving || checkedIds.length === 0" @click="doAdd">
            {{ saving ? '加入中…' : '加入课题组' }}
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- 成员 / 学生行详情弹窗 -->
  <RowDetailDialog v-model:visible="detailVisible" :title="detailTitle" :row="detailRow" :fields="detailFields" />
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import RowDetailDialog from '../../components/RowDetailDialog.vue'
import { listMembers, listGroupStudents, removeMember, addMembers, setStudentMentor, listCandidates } from '../../api'
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'
import { refreshAfterWrite } from '../../composables/useGlobalRefresh'
import { fetchAll } from '../../utils/fetchAll'
import { roleText, statusText, statusTagClass } from '../../utils/labels'

// 课题组管理员独立页面：课题组成员管理（仅本课题组）
const tab = ref('members')

// ===== 行详情（成员 / 学生两张表共用） =====
const detailVisible = ref(false)
const detailRow = ref(null)
const detailFields = ref([])
const detailTitle = ref('')
const memberDetailFields = [
  { key: 'id', label: 'ID' },
  { key: 'username', label: '用户名' },
  { key: 'realName', label: '真实姓名' },
  { key: 'role', label: '角色', render: roleText },
  { key: 'status', label: '状态', render: statusText },
  { key: 'phone', label: '手机号' }
]
const studentDetailFields = [
  { key: 'id', label: 'ID' },
  { key: 'username', label: '用户名' },
  { key: 'realName', label: '真实姓名' },
  { key: 'phone', label: '手机号' },
  { key: 'mentorId', label: '当前导师', render: mentorName }
]
function openDetail(row, fields, title) {
  detailRow.value = row
  detailFields.value = fields
  detailTitle.value = title
  detailVisible.value = true
}

// ===== 成员列表 =====
const mRole = ref('')
const mKeyword = ref('')
const mPage = ref(1)
const members = ref([])
const mTotal = ref(0)
const mTotalPages = ref(1)

async function loadMembers() {
  const res = await listMembers({ page: mPage.value, role: mRole.value, keyword: mKeyword.value })
  if (res && res.success) {
    members.value = (res.data && res.data.list) || []
    mTotal.value = (res.data && res.data.total) || 0
    mTotalPages.value = (res.data && res.data.totalPages) || 1
  } else {
    dialogAlert((res && res.message) || '加载成员失败')
  }
}
function mSearch() {
  mPage.value = 1
  loadMembers()
}
function mReset() {
  mRole.value = ''
  mKeyword.value = ''
  mPage.value = 1
  loadMembers()
}
async function doRemove(u) {
  const ok = await dialogConfirm(`确定将「${u.realName || u.username}」移出课题组吗？`)
  if (!ok) return
  const res = await removeMember(u.id)
  if (res && res.success) {
    await refreshAfterWrite('移除成功')
  } else {
    dialogAlert((res && res.message) || '移除失败')
  }
}

// ===== 学生与导师 =====
const sKeyword = ref('')
const sPage = ref(1)
const students = ref([])
const sTotal = ref(0)
const sTotalPages = ref(1)
const mentors = ref([])
const mentorPick = reactive({})

async function loadStudents() {
  const res = await listGroupStudents({ page: sPage.value, keyword: sKeyword.value })
  if (res && res.success) {
    students.value = (res.data && res.data.list) || []
    sTotal.value = (res.data && res.data.total) || 0
    sTotalPages.value = (res.data && res.data.totalPages) || 1
    // 预填每行的导师选择
    for (const u of students.value) {
      mentorPick[u.id] = u.mentorId === null || u.mentorId === undefined ? '' : u.mentorId
    }
  } else {
    dialogAlert((res && res.message) || '加载学生失败')
  }
}
function sSearch() {
  sPage.value = 1
  loadStudents()
}
function sReset() {
  sKeyword.value = ''
  sPage.value = 1
  loadStudents()
}
function mentorName(mentorId) {
  if (!mentorId) return '-'
  const m = mentors.value.find((x) => x.id === Number(mentorId))
  return m ? m.realName || m.username : `用户 #${mentorId}`
}
async function doSetMentor(u) {
  const mentorId = mentorPick[u.id]
  const res = await setStudentMentor(u.id, { mentorId: mentorId === '' ? null : Number(mentorId) })
  if (res && res.success) {
    await refreshAfterWrite('指定导师成功')
  } else {
    dialogAlert((res && res.message) || '指定导师失败')
  }
}

// ===== 添加成员 =====
const showAdd = ref(false)
const addRole = ref('mentor')
const addKeyword = ref('')
const candidates = ref([])
const checkedIds = ref([])
const saving = ref(false)

async function loadCandidates() {
  const res = await listCandidates({ role: addRole.value, keyword: addKeyword.value })
  if (res && res.success) {
    candidates.value = (res.data && res.data.list) || []
  }
}
function openAdd() {
  addRole.value = 'mentor'
  addKeyword.value = ''
  checkedIds.value = []
  loadCandidates()
  showAdd.value = true
}
async function doAdd() {
  saving.value = true
  try {
    const res = await addMembers({ userIds: [...checkedIds.value], role: addRole.value })
    if (res && res.success) {
      showAdd.value = false
      await refreshAfterWrite(`成功加入 ${(res.data && res.data.added) || 0} 人`)
    } else {
      dialogAlert((res && res.message) || '加入失败')
    }
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  loadMembers()
  mentors.value = await fetchAll(listMembers, { role: 'mentor' })
  if (tab.value === 'students') loadStudents()
})
</script>

<style scoped>
.cand-list {
  max-height: 260px;
  overflow: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 8px;
}
.cand-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 6px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
}
.cand-item:hover {
  background: #f5f7fa;
}
</style>
