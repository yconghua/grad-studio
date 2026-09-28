<template>
  <div class="subject-page">
    <div class="header-card">
      <div class="header-left">
        <h2 class="page-title">🔬 课题管理</h2>
      </div>
      <div class="header-right">
        <button class="btn btn-primary" @click="openSubjectModal()">＋ 新增课题</button>
      </div>
    </div>

    <div v-if="!currentGroupId" class="empty-tip">请先在页头选择或输入课题组ID</div>
    <div v-else class="card">
      <p v-if="loading" class="empty-tip">加载中…</p>
      <p v-else-if="!subjects.length" class="empty-tip">暂无课题记录</p>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th></th>
            <th>课题名称</th>
            <th>编号</th>
            <th>类型</th>
            <th>负责人</th>
            <th>状态</th>
            <th>起止时间</th>
            <th>经费</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="s in subjects" :key="s.id">
            <tr class="row-main" @click="toggleExpand(s.id)">
              <td class="cell-arrow">{{ expandedId === s.id ? '▼' : '▶' }}</td>
              <td class="cell-title">{{ s.name }}</td>
              <td>{{ s.code || '—' }}</td>
              <td>{{ typeText(s.subject_type) }}</td>
              <td>{{ nameOf(s.leader_id) }}</td>
              <td><span :class="['status-tag', 'st-' + s.status]">{{ statusText(s.status) }}</span></td>
              <td class="cell-time">{{ s.start_date || '—' }} ~ {{ s.end_date || '—' }}</td>
              <td>{{ s.funding != null ? ('¥' + s.funding) : '—' }}</td>
              <td @click.stop>
                <button class="btn btn-mini" @click="openSubjectModal(s)">编辑</button>
                <button class="btn btn-mini btn-danger" @click="onRemoveSubject(s)">删除</button>
              </td>
            </tr>
            <tr v-if="expandedId === s.id">
              <td colspan="9" class="member-cell">
                <div class="member-panel">
                  <div class="member-panel-head">
                    <span class="member-title">成员列表（{{ membersOf(s.id).length }}）</span>
                    <div class="member-add">
                      <select v-model="memberPick[s.id]">
                        <option disabled value="">请选择成员</option>
                        <option v-for="m in subjectMemberOptions" :key="m.id" :value="m.id">{{ memberLabel(m) }}</option>
                      </select>
                      <button class="btn btn-mini btn-primary" @click="onAddMember(s)">添加</button>
                    </div>
                  </div>
                  <p v-if="loadingMembers" class="empty-tip small">成员加载中…</p>
                  <p v-else-if="!membersOf(s.id).length" class="empty-tip small">暂无成员</p>
                  <table v-else class="data-table inner">
                    <thead>
                      <tr><th>成员</th><th>课题内角色</th><th>加入日期</th><th>状态</th><th>操作</th></tr>
                    </thead>
                    <tbody>
                      <tr v-for="mb in membersOf(s.id)" :key="mb.id">
                        <td class="cell-title">{{ nameOf(mb.user_id) }}</td>
                        <td>{{ mb.role_in_subject === 'leader' ? '负责人' : '参与人' }}</td>
                        <td class="cell-time">{{ mb.join_date || '—' }}</td>
                        <td>{{ mb.status === 'active' ? '参与中' : '已退出' }}</td>
                        <td><button class="btn btn-mini btn-danger" @click="onRemoveMember(mb)">移除</button></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- 课题新增/编辑弹窗 -->
    <div v-if="subjectModal.visible" class="modal-mask" @click.self="subjectModal.visible = false">
      <div class="modal-box">
        <h3 class="modal-title">{{ subjectModal.form.id ? '编辑课题' : '新增课题' }}</h3>
        <div class="form-grid">
          <label class="form-item full">
            <span class="form-label">课题名称 *</span>
            <input v-model="subjectModal.form.name" type="text" placeholder="课题名称" />
          </label>
          <label class="form-item">
            <span class="form-label">课题编号</span>
            <input v-model="subjectModal.form.code" type="text" placeholder="立项编号" />
          </label>
          <label class="form-item">
            <span class="form-label">类型</span>
            <select v-model="subjectModal.form.subject_type">
              <option value="national">国家级</option>
              <option value="provincial">省部级</option>
              <option value="school">校级</option>
              <option value="enterprise">横向</option>
              <option value="self">自选</option>
            </select>
          </label>
          <label class="form-item">
            <span class="form-label">负责人 <i>*</i></span>
            <input v-if="isMentor" :value="mentorSelfLabel" disabled />
            <select v-else v-model="subjectModal.form.leader_id">
              <option :value="0" disabled>请选择负责人</option>
              <option v-for="m in leaderOptions" :key="m.id" :value="m.id">{{ memberLabel(m) }}</option>
            </select>
          </label>
          <label class="form-item">
            <span class="form-label">状态</span>
            <select v-model="subjectModal.form.status">
              <option value="applying">申报中</option>
              <option value="ongoing">进行中</option>
              <option value="completed">已结题</option>
              <option value="suspended">已中止</option>
            </select>
          </label>
          <label class="form-item">
            <span class="form-label">开始日期</span>
            <input v-model="subjectModal.form.start_date" type="date" />
          </label>
          <label class="form-item">
            <span class="form-label">结束日期</span>
            <input v-model="subjectModal.form.end_date" type="date" />
          </label>
          <label class="form-item">
            <span class="form-label">经费金额（元）</span>
            <input v-model="subjectModal.form.funding" type="number" min="0" step="0.01" />
          </label>
          <label class="form-item">
            <span class="form-label">经费来源</span>
            <input v-model="subjectModal.form.source" type="text" placeholder="资助单位" />
          </label>
          <label class="form-item full">
            <span class="form-label">课题简介</span>
            <textarea v-model="subjectModal.form.description" rows="3" placeholder="研究内容简介"></textarea>
          </label>
          <label class="form-item full">
            <span class="form-label">备注</span>
            <input v-model="subjectModal.form.remark" type="text" />
          </label>
        </div>
        <p v-if="subjectModal.error" class="form-error">{{ subjectModal.error }}</p>
        <div class="modal-actions">
          <button class="btn" @click="subjectModal.visible = false">取消</button>
          <button class="btn btn-primary" :disabled="subjectModal.saving" @click="onSaveSubject">
            {{ subjectModal.saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'
import { ref, computed, watch, onMounted } from 'vue'
import { useGroupContext } from '../../composables/useGroupContext'
import { useRole } from '../../composables/useRole'
import { useSession } from '../../composables/useSession'
import {
  listSubjects, createSubject, updateSubject, removeSubject,
  listSubjectMembers, addSubjectMember, removeSubjectMember,
  listMembers
} from '../../api'

const { currentGroupId, loadGroups } = useGroupContext()
const { isMentor } = useRole()
const { getSessionUser } = useSession()
const currentUser = getSessionUser()
const mentorSelfLabel = currentUser
  ? (currentUser.real_name ? currentUser.real_name + '（' + currentUser.username + '）' : currentUser.username)
  : ''

const subjects = ref([])
const members = ref([])
const memberMap = ref({})
const loading = ref(false)
const loadingMembers = ref(false)
const expandedId = ref(null)
const memberPick = ref({})

const TYPE_TEXT = { national: '国家级', provincial: '省部级', school: '校级', enterprise: '横向', self: '自选' }
const STATUS_TEXT = { applying: '申报中', ongoing: '进行中', completed: '已结题', suspended: '已中止' }

function typeText(t) { return TYPE_TEXT[t] || t || '—' }
function statusText(s) { return STATUS_TEXT[s] || s || '—' }
// 显示名：有真实姓名显示「姓名（账号）」，无姓名显示账号
function memberLabel(m) {
  return m.real_name ? m.real_name + '（' + m.username + '）' : m.username
}
// 负责人候选：仅导师
const leaderOptions = computed(() => members.value.filter((m) => m.role === 'mentor'))
// 课题成员候选：仅学生
const subjectMemberOptions = computed(() => members.value.filter((m) => m.role === 'student'))
function nameOf(id) {
  const m = members.value.find((x) => x.id === Number(id))
  return m ? memberLabel(m) : (id ? ('#' + id) : '—')
}
function membersOf(subjectId) {
  return memberMap.value[subjectId] || []
}

async function loadMembers() {
  try {
    const res = await listMembers({ group_id: currentGroupId.value })
    if (res && res.success) members.value = res.members || []
  } catch (e) { /* 忽略 */ }
}

async function loadSubjects() {
  if (!currentGroupId.value) { subjects.value = []; return }
  loading.value = true
  try {
    const res = await listSubjects(currentGroupId.value)
    if (res && res.success) {
      subjects.value = res.data || []
    } else {
      subjects.value = []
      if (res && res.message) dialogAlert(res.message)
    }
  } finally { loading.value = false }
}

async function toggleExpand(id) {
  if (expandedId.value === id) { expandedId.value = null; return }
  expandedId.value = id
  if (!memberPick.value[id]) memberPick.value[id] = ''
  await loadMemberList(id)
}

async function loadMemberList(subjectId) {
  loadingMembers.value = true
  try {
    const res = await listSubjectMembers(subjectId)
    if (res && res.success) {
      memberMap.value = { ...memberMap.value, [subjectId]: res.data || [] }
    }
  } finally { loadingMembers.value = false }
}

async function onAddMember(subject) {
  const uid = Number(memberPick.value[subject.id])
  if (!uid) { dialogAlert('请先选择成员'); return }
  const res = await addSubjectMember({ subject_id: subject.id, user_id: uid, role_in_subject: 'member' })
  if (res && res.success) {
    memberPick.value[subject.id] = ''
    loadMemberList(subject.id)
  } else {
    dialogAlert((res && res.message) || '添加失败')
  }
}

async function onRemoveMember(mb) {
  if (!await dialogConfirm('确认移除该课题成员？')) return
  const res = await removeSubjectMember(mb.id)
  if (res && res.success) loadMemberList(expandedId.value)
  else dialogAlert((res && res.message) || '移除失败')
}

// ===== 课题弹窗 =====
const emptyForm = () => ({
  id: null, name: '', code: '', subject_type: 'self', description: '',
  leader_id: 0, status: 'applying', start_date: '', end_date: '',
  funding: '', source: '', remark: ''
})
const subjectModal = ref({ visible: false, saving: false, error: '', form: emptyForm() })

function openSubjectModal(row) {
  if (row) {
    subjectModal.value.form = {
      id: row.id, name: row.name, code: row.code || '', subject_type: row.subject_type || 'self',
      description: row.description || '', leader_id: row.leader_id || 0, status: row.status || 'applying',
      start_date: row.start_date || '', end_date: row.end_date || '',
      funding: row.funding != null ? row.funding : '', source: row.source || '', remark: row.remark || ''
    }
  } else {
    subjectModal.value.form = emptyForm()
    if (isMentor && currentUser) subjectModal.value.form.leader_id = currentUser.id
  }
  subjectModal.value.error = ''
  subjectModal.value.visible = true
}

async function onSaveSubject() {
  const f = subjectModal.value.form
  if (!f.name.trim()) { subjectModal.value.error = '课题名称不能为空'; return }
  if (!f.leader_id) { subjectModal.value.error = '请选择负责人'; return }
  subjectModal.value.saving = true
  subjectModal.value.error = ''
  const payload = {
    group_id: currentGroupId.value,
    name: f.name.trim(), code: f.code, subject_type: f.subject_type,
    description: f.description, leader_id: Number(f.leader_id) || 0, status: f.status,
    start_date: f.start_date, end_date: f.end_date,
    funding: f.funding === '' ? undefined : f.funding, source: f.source, remark: f.remark
  }
  try {
    const res = f.id ? await updateSubject({ id: f.id, ...payload }) : await createSubject(payload)
    if (res && res.success) {
      subjectModal.value.visible = false
      loadSubjects()
    } else {
      subjectModal.value.error = (res && res.message) || '保存失败'
    }
  } catch (e) {
    subjectModal.value.error = '保存失败，请稍后重试'
  } finally {
    subjectModal.value.saving = false
  }
}

async function onRemoveSubject(row) {
  if (!await dialogConfirm(`确认删除课题「${row.name}」？`)) return
  const res = await removeSubject(row.id)
  if (res && res.success) loadSubjects()
  else dialogAlert((res && res.message) || '删除失败')
}

onMounted(() => {
  loadGroups()
  loadMembers()
  loadSubjects()
})
watch(currentGroupId, () => {
  loadSubjects()
  loadMembers()
})
</script>

<style scoped>
.header-card {
  display: flex; align-items: center; justify-content: space-between;
  background: #fff; border-radius: 12px; padding: 16px 20px; margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(15, 35, 80, 0.05);
}
.header-left { display: flex; align-items: center; gap: 16px; }
.page-title { margin: 0; font-size: 18px; color: #1f2329; }

.card {
  background: #fff; border-radius: 12px; padding: 8px;
  box-shadow: 0 2px 8px rgba(15, 35, 80, 0.05); overflow-x: auto;
}
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th {
  background: #f7f9fc; text-align: left; padding: 10px 12px; color: #4e5969;
  font-weight: 600; border-bottom: 1px solid #eceff3; white-space: nowrap;
}
.data-table td { padding: 10px 12px; border-bottom: 1px solid #eceff3; color: #1f2329; }
.data-table tbody tr:nth-child(even) { background: #fafbfc; }
.data-table tbody tr:hover { background: #eef6ff; }
.row-main { cursor: pointer; }
.cell-arrow { width: 28px; color: #8a9099; }
.cell-title { font-weight: 600; }
.cell-time { color: #8a9099; white-space: nowrap; }
.data-table.inner { margin-top: 4px; }
.data-table.inner td, .data-table.inner th { padding: 7px 12px; }
.member-cell { background: #fafbfc !important; }
.member-panel { padding: 6px 8px; }
.member-panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.member-title { font-size: 13px; font-weight: 600; color: #1f2329; }
.member-add { display: flex; gap: 8px; align-items: center; }
.member-add select {
  height: 30px; border: 1px solid #dfe3e8; border-radius: 8px; padding: 0 8px; font-size: 13px; outline: none;
}

.status-tag {
  display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px;
  background: #f0f2f5; color: #4e5969; white-space: nowrap;
}
.st-ongoing { background: #e8f7ee; color: #19a558; }
.st-applying { background: #fff5e6; color: #e8890c; }
.st-completed { background: #e8f0fb; color: #0d80e0; }
.st-suspended { background: #fdecea; color: #ea4335; }

.empty-tip { text-align: center; color: #8a9099; font-size: 13px; padding: 36px 0; }
.empty-tip.small { padding: 14px 0; font-size: 12px; }

.btn {
  padding: 7px 14px; border-radius: 8px; border: 1px solid #dfe3e8; background: #fff;
  font-size: 13px; color: #1f2329; cursor: pointer;
}
.btn:hover { border-color: #0d80e0; color: #0d80e0; }
.btn-primary {
  background: linear-gradient(135deg, #0d80e0, #19a558); color: #fff; border: none;
}
.btn-primary:hover { opacity: 0.9; color: #fff; }
.btn-danger { color: #ea4335; border-color: #f5c6c2; }
.btn-danger:hover { border-color: #ea4335; color: #ea4335; }
.btn-mini { padding: 4px 10px; font-size: 12px; margin-right: 6px; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }

.modal-mask {
  position: fixed; inset: 0; background: rgba(20, 30, 50, 0.45);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal-box {
  background: #fff; border-radius: 12px; padding: 22px 24px; width: 600px; max-width: 92vw;
  max-height: 86vh; overflow-y: auto; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}
.modal-title { margin: 0 0 16px; font-size: 16px; color: #1f2329; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 14px; }
.form-item { display: flex; flex-direction: column; gap: 5px; }
.form-item.full { grid-column: 1 / -1; }
.form-label { font-size: 12px; color: #4e5969; }
.form-item input, .form-item select, .form-item textarea {
  border: 1px solid #dfe3e8; border-radius: 8px; padding: 8px 10px; font-size: 13px;
  outline: none; background: #fff; color: #1f2329; font-family: inherit;
}
.form-item input:focus, .form-item select:focus, .form-item textarea:focus { border-color: #0d80e0; }
.form-error { color: #ea4335; font-size: 12px; margin: 10px 0 0; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
</style>
