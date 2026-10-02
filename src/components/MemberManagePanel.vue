<template>
  <div>
    <!-- 工具栏：角色筛选 / 关键字 / 查询 / 重置 / 添加成员 -->
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
      <button class="btn btn-primary" :disabled="disabled" @click="openAdd">添加成员</button>
    </div>

    <!-- 批量操作条 -->
    <div v-if="selMembers.length" class="toolbar" style="background: var(--primary-soft); border-color: var(--border)">
      <span style="font-size: 13px; color: var(--text)">已选 <b>{{ selMembers.length }}</b> 项</span>
      <button class="btn btn-sm btn-danger" @click="batchRemove">批量移除</button>
      <button class="btn btn-sm" @click="openMentorPick(null)">批量指定导师</button>
      <button class="btn btn-sm" @click="selMembers = []">取消选择</button>
    </div>

    <!-- 成员列表 -->
    <div class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th style="width: 40px">
              <input type="checkbox" :checked="allChecked" @change="toggleAll" />
            </th>
            <th>姓名</th>
            <th>用户名</th>
            <th>角色</th>
            <th>状态</th>
            <th>导师</th>
            <th>加入时间</th>
            <th style="width: 200px">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in members" :key="u.id" @click="openDetail(u)">
            <td @click.stop><input type="checkbox" :value="u.id" v-model="selMembers" /></td>
            <td class="ellipsis">{{ u.realName || '-' }}</td>
            <td class="ellipsis">{{ u.username }}</td>
            <td><span class="tag tag-blue">{{ roleText(u.role) }}</span></td>
            <td>
              <span v-if="u.status === 0" class="tag tag-red">已停用</span>
              <span v-else style="color: var(--text-disabled)">启用</span>
            </td>
            <td class="ellipsis">{{ u.role === 'student' ? (u.mentorName || '-') : '-' }}</td>
            <td>{{ u.joinTime || '-' }}</td>
            <td>
              <div class="ops" @click.stop>
                <button v-if="u.role === 'student'" class="btn btn-sm" @click="openMentorPick(u)">指定导师</button>
                <button class="btn btn-sm btn-danger" @click="doRemove(u)">移除</button>
              </div>
            </td>
          </tr>
          <tr v-if="members.length === 0">
            <td colspan="8"><div class="empty">暂无成员</div></td>
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

    <!-- 指定导师弹窗：单条 / 批量共用 -->
    <div v-if="showMentorPick" class="modal-mask" @click.self="closeMentorPick">
      <div class="modal sm">
        <div class="modal-head">
          <h3>{{ mentorPickTarget ? '指定导师' : '批量指定导师' }}</h3>
          <button type="button" class="modal-close" @click="closeMentorPick">×</button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label>选择导师（仅本组导师）</label>
            <select v-model="mentorPickId" class="select">
              <option value="">请选择导师</option>
              <option v-for="m in mentors" :key="m.id" :value="m.id">{{ m.realName || m.username }}</option>
            </select>
          </div>
          <p class="hint">{{ mentorPickHint }}</p>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="closeMentorPick">取消</button>
          <button class="btn btn-primary" :disabled="!mentorPickId || saving" @click="doMentorPick">确认</button>
        </div>
      </div>
    </div>

    <!-- 行详情 -->
    <RowDetailDialog v-model:visible="detailVisible" :title="detailTitle" :row="detailRow" :fields="detailFields" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import RowDetailDialog from './RowDetailDialog.vue'
import {
  listMembers, addMembers, removeMember, batchRemoveMembers, batchAssignMentor, setStudentMentor, listCandidates,
  superListMembers, superAddMembers, superRemoveMember, superBatchRemoveMembers, superBatchAssignMentor, superSetStudentMentor
} from '../api'
import { dialogAlert, dialogConfirm } from '../composables/useDialog'
import { refreshAfterWrite } from '../composables/useGlobalRefresh'
import { fetchAll } from '../utils/fetchAll'
import { roleText, statusText } from '../utils/labels'

// 课题组成员管理公共面板：超管（任意组，group:* + groupId）与组管（本组，group-admin:*）共用
const props = defineProps({
  groupId: { type: Number, required: true },
  isSuper: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false } // 课题组停用：禁止加入新成员
})

const listApi = props.isSuper ? superListMembers : listMembers
const addApi = props.isSuper ? superAddMembers : addMembers
const removeApi = props.isSuper ? superRemoveMember : removeMember
const batchRemoveApi = props.isSuper ? superBatchRemoveMembers : batchRemoveMembers
const batchAssignApi = props.isSuper ? superBatchAssignMentor : batchAssignMentor
const setMentorApi = props.isSuper ? superSetStudentMentor : setStudentMentor

// ===== 成员列表 =====
const mRole = ref('')
const mKeyword = ref('')
const mPage = ref(1)
const members = ref([])
const mTotal = ref(0)
const mTotalPages = ref(1)

async function loadMembers() {
  selMembers.value = []
  const res = await listApi({ groupId: props.groupId, page: mPage.value, role: mRole.value, keyword: mKeyword.value })
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

// ===== 批量选择 =====
const selMembers = ref([])
const allChecked = computed(() => members.value.length > 0 && selMembers.value.length === members.value.length)
function toggleAll(e) {
  selMembers.value = e.target.checked ? members.value.map((u) => u.id) : []
}

// ===== 行详情 =====
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
  { key: 'mentorName', label: '导师' },
  { key: 'joinTime', label: '加入时间' }
]
function openDetail(row) {
  detailRow.value = row
  detailFields.value = memberDetailFields
  detailTitle.value = '成员详情'
  detailVisible.value = true
}

// ===== 移除 =====
async function doRemove(u) {
  const isMentor = u.role === 'mentor'
  const ok = await dialogConfirm(
    isMentor
      ? `确定将「${u.realName || u.username}」移出课题组吗？移除导师将同时解除其名下学生的导师绑定，学生变为已入组未指定导师。`
      : `确定将「${u.realName || u.username}」移出课题组吗？`
  )
  if (!ok) return
  // 组管通道不带 groupId（服务端强制本组），仅超管通道需要显式传 groupId
  const res = await (props.isSuper ? removeApi(props.groupId, u.id) : removeApi(u.id))
  if (res && res.success) {
    const d = res.data || {}
    if (isMentor && d.removedStudentCount > 0) {
      await refreshAfterWrite(`移除成功，已解绑 ${d.removedStudentCount} 名学生的导师绑定`)
    } else {
      await refreshAfterWrite('移除成功')
    }
  } else {
    dialogAlert((res && res.message) || '移除失败')
  }
}

async function batchRemove() {
  const isAll = selMembers.value.length === mTotal.value
  const ok = await dialogConfirm(
    `确定将选中的 ${selMembers.value.length} 名成员移出课题组吗？${isAll ? '该课题组将被清空成员。' : ''}导师被移除将同步解除其名下学生的导师绑定。`
  )
  if (!ok) return
  // 组管通道不带 groupId，仅超管通道显式传
  const res = await (props.isSuper
    ? batchRemoveApi(props.groupId, [...selMembers.value])
    : batchRemoveApi([...selMembers.value]))
  if (res && res.success) {
    const d = res.data || {}
    const parts = [`已移除 ${d.successCount || 0} 条`]
    if (d.failCount) parts.push(`失败 ${d.failCount} 条`)
    const reasons = (d.failList || []).map((f) => `用户 #${f.id}：${f.reason}`).join('；')
    if (reasons) parts.push(reasons.slice(0, 120))
    await refreshAfterWrite(parts.join('，'))
  } else {
    dialogAlert((res && res.message) || '批量移除失败')
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
  candidates.value = await fetchAll(listCandidates, { role: addRole.value, keyword: addKeyword.value })
}
function openAdd() {
  if (props.disabled) {
    return dialogAlert('课题组已停用，不能加入新成员')
  }
  addRole.value = 'mentor'
  addKeyword.value = ''
  checkedIds.value = []
  loadCandidates()
  showAdd.value = true
}
async function doAdd() {
  saving.value = true
  try {
    const res = await addApi({ groupId: props.groupId, userIds: [...checkedIds.value], role: addRole.value })
    if (res && res.success) {
      const d = res.data || {}
      const parts = [`成功加入 ${d.successCount || 0} 人`]
      if (d.failCount) parts.push(`失败 ${d.failCount} 条`)
      const reasons = (d.failList || []).map((f) => `${f.username || ('用户 #' + f.id)}：${f.reason}`).join('；')
      if (reasons) parts.push(reasons.slice(0, 120))
      showAdd.value = false
      await refreshAfterWrite(parts.join('，'))
    } else {
      dialogAlert((res && res.message) || '加入失败')
    }
  } finally {
    saving.value = false
  }
}

// ===== 指定导师（单条 / 批量共用弹窗）=====
const mentors = ref([])
const showMentorPick = ref(false)
const mentorPickTarget = ref(null) // null = 批量
const mentorPickId = ref('')
const mentorPickHint = computed(() => {
  if (mentorPickTarget.value) {
    return `将把「${mentorPickTarget.value.realName || mentorPickTarget.value.username}」指定给所选导师；已绑定其他导师将被替换。`
  }
  return `将把选中的 ${selMembers.value.length} 名学生指定给所选导师；已绑定其他导师的学生将被替换。`
})

async function loadMentors() {
  mentors.value = await fetchAll(listApi, { groupId: props.groupId, role: 'mentor' })
}
function openMentorPick(target) {
  mentorPickTarget.value = target
  mentorPickId.value = ''
  showMentorPick.value = true
}
function closeMentorPick() {
  showMentorPick.value = false
  mentorPickTarget.value = null
}
async function doMentorPick() {
  if (!mentorPickId.value) return dialogAlert('请选择导师')
  saving.value = true
  try {
    let res
    if (mentorPickTarget.value) {
      // 组管通道不带 groupId，仅超管通道显式传
      res = await (props.isSuper
        ? setMentorApi(props.groupId, mentorPickTarget.value.id, { mentorId: Number(mentorPickId.value) })
        : setMentorApi(mentorPickTarget.value.id, { mentorId: Number(mentorPickId.value) }))
    } else {
      res = await (props.isSuper
        ? batchAssignApi(props.groupId, [...selMembers.value], Number(mentorPickId.value))
        : batchAssignApi([...selMembers.value], Number(mentorPickId.value)))
    }
    if (res && res.success) {
      if (mentorPickTarget.value) {
        closeMentorPick()
        await refreshAfterWrite('指定导师成功')
      } else {
        const d = res.data || {}
        const parts = [`成功 ${d.successCount || 0} 条`]
        if (d.replacedCount) parts.push(`${d.replacedCount} 名原导师被替换`)
        if (d.failCount) parts.push(`失败 ${d.failCount} 条`)
        const reasons = (d.failList || []).map((f) => `用户 #${f.id}：${f.reason}`).join('；')
        if (reasons) parts.push(reasons.slice(0, 120))
        closeMentorPick()
        await refreshAfterWrite(parts.join('，'))
      }
    } else {
      dialogAlert((res && res.message) || '指定导师失败')
    }
  } finally {
    saving.value = false
  }
}

// 组管固定本组；超管详情页切换课题组时重新加载
watch(() => props.groupId, () => {
  mPage.value = 1
  loadMembers()
  loadMentors()
})

onMounted(() => {
  loadMembers()
  loadMentors()
})
</script>

<style scoped>
.cand-list {
  max-height: 260px;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 8px;
}
.cand-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--text-2-strong);
  cursor: pointer;
}
.cand-item:hover {
  background: var(--bg-hover);
}
</style>
