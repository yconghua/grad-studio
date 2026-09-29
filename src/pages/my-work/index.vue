<template>
  <div class="page">
    <div class="page-head card">
      <div class="header-left">
        <h2 class="page-title">📋 课题与任务</h2>
        <p class="page-desc">我的课题、导师下发给我的任务，可在此更新进展。</p>
      </div>
    </div>

    <!-- Tab 切换 -->
    <div class="tabs">
      <button class="tab" :class="{ active: tab === 'subject' }" @click="tab = 'subject'">📚 我的课题</button>
      <button class="tab" :class="{ active: tab === 'task' }" @click="tab = 'task'">✅ 我的任务</button>
    </div>

    <!-- 我的课题（学生只读） -->
    <div v-show="tab === 'subject'" class="card">
      <div class="sub-title">📚 我的课题</div>
      <div v-if="subjLoading" class="state">加载中…</div>
      <div v-else-if="!subjects.length" class="state">暂无本组的课题</div>
      <div v-else class="subject-list">
        <div v-for="s in subjects" :key="s.id" class="subject-item clickable" @click="openSubjectDetail(s)">
          <div class="subject-main">
            <span class="subject-name">{{ s.name }}</span>
            <span class="badge" :class="subjectStatusClass(s.status)">{{ subjectStatusText(s.status) }}</span>
            <span v-if="s.joined" class="joined-tag">我参与</span>
          </div>
          <div class="subject-meta">
            <span>编号：{{ s.code || '—' }}</span>
            <span>类型：{{ subjectTypeText(s.subject_type) }}</span>
            <span>成员：{{ s.memberCount || 0 }} 人</span>
            <span>起止：{{ fmtDate(s.start_date) }} ~ {{ fmtDate(s.end_date) }}</span>
          </div>
          <p class="subject-desc">{{ s.description || '（无说明）' }}</p>
        </div>
      </div>
    </div>

    <div v-show="tab === 'task'" class="card">
      <div class="sub-title">✅ 我的任务</div>
      <div v-if="loading" class="state">加载中…</div>
      <div v-else-if="error" class="state error">{{ error }}</div>
      <div v-else-if="!tasks.length" class="state">暂无指派给我的任务。</div>

      <div v-else class="task-list">
        <div v-for="t in tasks" :key="t.id" class="task-item">
          <div class="task-main" @click="toggle(t)">
            <div class="task-left">
              <span class="pri" :class="'pri-' + (t.priority || 'medium')">{{ priText(t.priority) }}</span>
              <span class="task-title">{{ t.title }}</span>
              <span class="badge" :class="statusClass(t.status)">{{ statusText(t.status) }}</span>
            </div>
            <div class="task-right">
              <span class="muted">截止：{{ t.deadline ? fmtTime(t.deadline) : '未设置' }}</span>
              <div class="progress">
                <div class="bar"><div class="bar-inner" :style="{ width: (t.progress_percent || 0) + '%' }"></div></div>
                <span class="pct">{{ t.progress_percent || 0 }}%</span>
              </div>
              <span class="caret" :class="{ open: expandedId === t.id }">▾</span>
            </div>
          </div>

          <div v-if="expandedId === t.id" class="task-detail">
            <p class="desc"><b>任务说明：</b>{{ t.description || '无' }}</p>
            <div class="progress-panel">
              <div class="panel-head">
                <span class="panel-title">进展记录</span>
                <button v-if="t.status !== 'completed' && t.status !== 'cancelled'"
                  class="btn primary sm" @click="openProgress(t)">＋ 提交进展</button>
              </div>
              <div v-if="progLoading" class="mini-state">加载进展…</div>
              <div v-else-if="!progressList.length" class="mini-state">暂无进展记录</div>
              <div v-else class="timeline">
                <div v-for="p in progressList" :key="p.id" class="tl-item">
                  <div class="tl-dot"></div>
                  <div class="tl-body">
                    <div class="tl-meta">
                      <span class="tl-time">{{ fmtTime(p.created_at) }}</span>
                      <span class="tl-pct">进度 {{ p.progress_percent }}%</span>
                    </div>
                    <div class="tl-content">{{ p.content || '（无文字说明）' }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 课题详情弹窗（只读，点击课题卡片弹出） -->
    <div v-if="subjectDetail.visible" class="modal-mask" @click.self="subjectDetail.visible = false">
      <div class="modal-box detail-box">
        <h3 class="modal-title">课题详情</h3>
        <div v-if="subjectDetail.row" class="detail-grid">
          <div class="detail-item full"><span class="detail-label">课题名称</span><span class="detail-value">{{ subjectDetail.row.name }}</span></div>
          <div class="detail-item"><span class="detail-label">编号</span><span class="detail-value">{{ subjectDetail.row.code || '—' }}</span></div>
          <div class="detail-item"><span class="detail-label">类型</span><span class="detail-value">{{ subjectTypeText(subjectDetail.row.subject_type) }}</span></div>
          <div class="detail-item"><span class="detail-label">状态</span><span class="detail-value"><span class="badge" :class="subjectStatusClass(subjectDetail.row.status)">{{ subjectStatusText(subjectDetail.row.status) }}</span></span></div>
          <div class="detail-item"><span class="detail-label">负责人</span><span class="detail-value">{{ memberLabelOf(subjectDetail.row.leader_id) }}</span></div>
          <div class="detail-item"><span class="detail-label">起止日期</span><span class="detail-value">{{ fmtDate(subjectDetail.row.start_date) }} ~ {{ fmtDate(subjectDetail.row.end_date) }}</span></div>
          <div class="detail-item"><span class="detail-label">经费</span><span class="detail-value">{{ subjectDetail.row.funding || '—' }}</span></div>
          <div class="detail-item"><span class="detail-label">来源</span><span class="detail-value">{{ subjectDetail.row.source || '—' }}</span></div>
          <div class="detail-item"><span class="detail-label">成员数</span><span class="detail-value">{{ subjectDetail.row.memberCount || 0 }} 人</span></div>
          <div class="detail-item full"><span class="detail-label">课题说明</span><span class="detail-value detail-text">{{ subjectDetail.row.description || '—' }}</span></div>
          <div class="detail-item full"><span class="detail-label">备注</span><span class="detail-value detail-text">{{ subjectDetail.row.remark || '—' }}</span></div>
          <div class="detail-item full"><span class="detail-label">创建时间</span><span class="detail-value">{{ fmtTime(subjectDetail.row.created_at) }}</span></div>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="subjectDetail.visible = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 提交进展弹窗 -->
    <div v-if="progModal.show" class="modal-mask" @click.self="progModal.show = false">
      <div class="modal-box">
        <h3 class="modal-title">提交任务进展</h3>
        <p class="modal-sub">任务：{{ progModal.task?.title }}</p>
        <label class="form-item">
          <span class="form-label">进展内容</span>
          <textarea rows="5" v-model="progModal.form.content" placeholder="本次完成了什么、遇到什么问题"></textarea>
        </label>
        <label class="form-item">
          <span class="form-label">当前进度（0-100）<em class="form-hint">{{ progHint }}</em></span>
          <input type="number" min="0" max="100" v-model.number="progModal.form.progress_percent" />
        </label>
        <p v-if="progModal.error" class="form-error">{{ progModal.error }}</p>
        <div class="modal-actions">
          <button class="btn" @click="progModal.show = false">取消</button>
          <button class="btn primary" :disabled="progModal.saving" @click="onSubmitProgress">
            {{ progModal.saving ? '提交中…' : '提交进展' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { listMyTasks, submitTaskProgress, listTaskProgress, listSubjects, listSubjectMembers, listMembers } from '../../api'
import { useGroupContext } from '../../composables/useGroupContext'
import { useSession } from '../../composables/useSession'

const route = useRoute()
const { currentGroupId } = useGroupContext()
const { getSessionUser } = useSession()
const currentUser = getSessionUser()
const currentUserId = currentUser && currentUser.id ? Number(currentUser.id) : 0

const tasks = ref([])
const loading = ref(false)
const error = ref('')
const expandedId = ref(null)
const progressList = ref([])
const progLoading = ref(false)

// 页签：subject=我的课题，task=我的任务（支持 ?tab=task 参数直达任务页签）
const tab = ref(route.query.tab === 'task' ? 'task' : 'subject')

// ===== 我的课题（只读） =====
const subjects = ref([])
const subjLoading = ref(false)
const members = ref([])
const SUBJECT_STATUS_TEXT = { ongoing: '进行中', finished: '已结题', cancelled: '已取消' }
function subjectStatusText(s) { return SUBJECT_STATUS_TEXT[s] || s || '—' }
function subjectStatusClass(s) {
  return { ongoing: 'b-blue', finished: 'b-gray', cancelled: 'b-gray' }[s] || 'b-gray'
}
const SUBJECT_TYPE_TEXT = { national: '国家级', provincial: '省部级', school: '校级', enterprise: '横向', self: '自选' }
function subjectTypeText(t) { return SUBJECT_TYPE_TEXT[t] || t || '—' }
function fmtDate(v) {
  if (!v) return '—'
  return String(v).slice(0, 10)
}

// 组内成员显示名：有真实姓名显示「姓名（账号）」，无姓名仅显示账号
function memberLabelOf(id) {
  if (!id) return '—'
  const m = members.value.find((x) => Number(x.id) === Number(id))
  if (!m) return '#' + id
  return m.real_name ? `${m.real_name}（${m.username}）` : m.username
}

async function loadMembers() {
  const gid = currentGroupId.value
  if (!gid) { members.value = []; return }
  try {
    const res = await listMembers({ group_id: gid })
    if (res && res.success) members.value = res.members || []
  } catch (e) {
    members.value = []
  }
}

// 课题详情弹窗（点击课题卡片弹出，只读展示完整信息）
const subjectDetail = ref({ visible: false, row: null })
function openSubjectDetail(s) {
  subjectDetail.value = { visible: true, row: s }
}

async function loadSubjects() {
  const gid = currentGroupId.value
  if (!gid) { subjects.value = []; return }
  subjLoading.value = true
  try {
    const res = await listSubjects(gid)
    const list = (res && res.success ? res.data : []) || []
    // 并行取每个课题的成员，标注「我参与」与成员数（课题数量有限，可接受）
    const enriched = await Promise.all(list.map(async (s) => {
      try {
        const mr = await listSubjectMembers(s.id)
        const mems = (mr && mr.success ? mr.data : []) || []
        return { ...s, memberCount: mems.length, joined: currentUserId > 0 && mems.some((x) => Number(x.user_id) === currentUserId) }
      } catch (e) {
        return { ...s, memberCount: 0, joined: false }
      }
    }))
    subjects.value = enriched
  } catch (e) {
    subjects.value = []
  } finally {
    subjLoading.value = false
  }
}

const progModal = ref({
  show: false, saving: false, error: '', task: null,
  form: { task_id: null, content: '', progress_percent: 0 }
})

// 进度输入提示：进行中不可低于当前进度；待验收提交未满进度将回到进行中
const progHint = computed(() => {
  const t = progModal.value.task
  if (!t) return ''
  const cur = Number(t.progress_percent) || 0
  if (t.status === 'pending_review') return `当前 ${cur}%，提交未满进度将回到进行中`
  return `当前 ${cur}%，不能低于当前进度`
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await listMyTasks()
    if (res && res.success) {
      tasks.value = res.data || []
      // 携带 focus 参数进入时，自动定位到任务页签并展开该任务（工作台点击跳转）
      const focus = Number(route.query.focus)
      if (focus) {
        tab.value = 'task'
        const t = tasks.value.find((x) => x.id === focus)
        if (t) {
          expandedId.value = t.id
          await loadProgress(t.id)
        }
      }
    } else error.value = (res && res.message) || '加载失败'
  } catch (e) {
    error.value = '网络异常，请重试'
  } finally {
    loading.value = false
  }
}

async function toggle(t) {
  if (expandedId.value === t.id) {
    expandedId.value = null
    progressList.value = []
    return
  }
  expandedId.value = t.id
  await loadProgress(t.id)
}

async function loadProgress(taskId) {
  progLoading.value = true
  progressList.value = []
  try {
    const res = await listTaskProgress(taskId)
    if (res && res.success) progressList.value = res.data || []
  } catch (e) {
    progressList.value = []
  } finally {
    progLoading.value = false
  }
}

function openProgress(t) {
  progModal.value.error = ''
  progModal.value.task = t
  progModal.value.form = { task_id: t.id, content: '', progress_percent: t.progress_percent || 0 }
  progModal.value.show = true
}

async function onSubmitProgress() {
  const f = progModal.value.form
  if (f.progress_percent == null || Number.isNaN(f.progress_percent)) {
    progModal.value.error = '请填写进度百分比'; return
  }
  // 进行中任务不允许把进度改低（与服务端校验一致，先拦截给出明确提示）
  const task = progModal.value.task
  const cur = Number(task && task.progress_percent) || 0
  if (task && task.status !== 'pending_review' && f.progress_percent < cur) {
    progModal.value.error = `进度不能低于当前进度（${cur}%）`; return
  }
  progModal.value.saving = true
  progModal.value.error = ''
  try {
    const res = await submitTaskProgress({ ...f })
    if (res && res.success) {
      progModal.value.show = false
      await load()
      if (expandedId.value === f.task_id) await loadProgress(f.task_id)
    } else {
      progModal.value.error = (res && res.message) || '提交失败'
    }
  } catch (e) {
    progModal.value.error = (e && e.message) ? ('网络异常：' + e.message) : '网络异常，请重试'
  } finally {
    progModal.value.saving = false
  }
}

function statusText(s) {
  return { todo: '待办', in_progress: '进行中', pending_review: '待验收', completed: '已完成', cancelled: '已取消' }[s] || s
}
function statusClass(s) {
  return { todo: 'b-gray', in_progress: 'b-blue', pending_review: 'b-orange', completed: 'b-green', cancelled: 'b-gray' }[s] || 'b-gray'
}
function priText(p) {
  return { high: '高', medium: '中', low: '低' }[p] || '中'
}
function fmtTime(t) {
  if (!t) return '—'
  return String(t).replace('T', ' ').slice(0, 16)
}

load()
// 课题组切换时刷新课题列表与成员列表（成员列表用于详情弹窗显示负责人姓名）
watch(currentGroupId, () => {
  loadSubjects()
  loadMembers()
}, { immediate: true })
</script>

<style scoped>
.page { display: flex; flex-direction: column; gap: 16px; }
.card {
  background: #fff; border-radius: 12px; padding: 18px 20px;
  border: 1px solid #eceff3; box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.header-left { display: flex; align-items: flex-end; gap: 14px; }
.page-title { margin: 0; font-size: 18px; color: #1f2329; }
.page-desc { margin: 0 0 3px; font-size: 13px; color: #8a9099; }
.state { padding: 40px 0; text-align: center; color: #8a9099; font-size: 13px; }
.state.error { color: #ea4335; }
.mini-state { padding: 16px 0; text-align: center; color: #8a9099; font-size: 12px; }

.tabs { display: flex; gap: 8px; }
.tab {
  padding: 9px 20px; border-radius: 8px; cursor: pointer; font-size: 14px;
  border: 1px solid #eceff3; background: #fff; color: #4e5969;
}
.tab.active {
  background: linear-gradient(135deg, #0d80e0, #19a558);
  border-color: transparent; color: #fff; font-weight: 600;
}

.task-list { display: flex; flex-direction: column; }
.task-item { border: 1px solid #eceff3; border-radius: 10px; margin-bottom: 10px; overflow: hidden; }
.task-item:last-child { margin-bottom: 0; }
.task-main {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 16px; cursor: pointer;
}
.task-main:hover { background: #fafbfc; }
.task-left { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.task-title { font-size: 14px; color: #1f2329; font-weight: 500; }
.task-right { display: flex; align-items: center; gap: 14px; }
.muted { color: #8a9099; font-size: 12px; white-space: nowrap; }

.pri { font-size: 12px; padding: 2px 8px; border-radius: 4px; }
.pri-high { background: #fff1f0; color: #ea4335; }
.pri-medium { background: #fff7e6; color: #d46b08; }
.pri-low { background: #f2f3f5; color: #4e5969; }

.badge { padding: 2px 10px; border-radius: 999px; font-size: 12px; }
.b-gray { background: #f2f3f5; color: #4e5969; }
.b-blue { background: #e6f4ff; color: #0d80e0; }
.b-green { background: #e8f7ef; color: #19a558; }
.b-orange { background: #fff5e6; color: #e8890c; }

.sub-title { margin: 0 0 12px; font-size: 15px; font-weight: 600; color: #1f2329; }
.subject-list { display: flex; flex-direction: column; gap: 10px; }
.subject-item { border: 1px solid #eceff3; border-radius: 10px; padding: 12px 16px; }
.subject-item.clickable {
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.subject-item.clickable:hover {
  border-color: #cfe4f7;
  box-shadow: 0 2px 8px rgba(13, 128, 224, 0.08);
}
.subject-main { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.subject-name { font-size: 14px; font-weight: 600; color: #1f2329; }
.joined-tag { background: #e8f7ef; color: #19a558; font-size: 12px; padding: 2px 10px; border-radius: 999px; }
.subject-meta { display: flex; flex-wrap: wrap; gap: 14px; font-size: 12px; color: #8a9099; }
.subject-desc { margin: 6px 0 0; font-size: 13px; color: #4e5969; line-height: 1.6; }

.progress { display: flex; align-items: center; gap: 6px; }
.bar { width: 90px; height: 6px; background: #eceff3; border-radius: 3px; overflow: hidden; }
.bar-inner { height: 100%; background: linear-gradient(135deg, #0d80e0, #19a558); }
.pct { font-size: 12px; color: #4e5969; }
.caret { color: #8a9099; transition: transform 0.2s; }
.caret.open { transform: rotate(180deg); }

.task-detail { border-top: 1px solid #eceff3; padding: 14px 16px; background: #fafbfc; }
.desc { margin: 0 0 12px; font-size: 13px; color: #4e5969; line-height: 1.6; }
.progress-panel { background: #fff; border: 1px solid #eceff3; border-radius: 10px; padding: 14px; }
.panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.panel-title { font-size: 13px; font-weight: 600; color: #1f2329; }

.btn {
  height: 32px; padding: 0 14px; border-radius: 8px; font-size: 13px;
  border: 1px solid #dfe3e8; background: #fff; color: #4e5969; cursor: pointer;
}
.btn.sm { height: 28px; padding: 0 10px; font-size: 12px; }
.btn.primary { background: linear-gradient(135deg, #0d80e0, #19a558); border: none; color: #fff; }
.btn:disabled { opacity: 0.5; }

.timeline { padding-left: 4px; }
.tl-item { display: flex; gap: 10px; padding-bottom: 14px; position: relative; }
.tl-item:last-child { padding-bottom: 0; }
.tl-dot { flex: 0 0 8px; width: 8px; height: 8px; border-radius: 50%; background: #0d80e0; margin-top: 5px; }
.tl-body { flex: 1; }
.tl-meta { display: flex; gap: 12px; font-size: 12px; color: #8a9099; margin-bottom: 3px; }
.tl-pct { color: #0d80e0; }
.tl-content { font-size: 13px; color: #1f2329; line-height: 1.6; }

.modal-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal-box { background: #fff; border-radius: 12px; padding: 24px; width: 460px; box-shadow: 0 12px 40px rgba(0,0,0,0.18); }
.modal-title { margin: 0 0 6px; font-size: 16px; color: #1f2329; }
.modal-sub { margin: 0 0 16px; font-size: 13px; color: #8a9099; }
.form-item { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.form-label { font-size: 13px; color: #4e5969; }
.form-hint { font-style: normal; color: #8a9099; font-size: 12px; margin-left: 8px; }
.form-item input, .form-item textarea {
  padding: 8px 10px; border: 1px solid #dfe3e8; border-radius: 8px;
  font-size: 13px; outline: none; font-family: inherit; resize: vertical;
}
.form-item input:focus, .form-item textarea:focus { border-color: #0d80e0; }
.form-error { color: #ea4335; font-size: 12px; margin: 0 0 10px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; }

/* ===== 详情弹窗美化（仅 .detail-box 容器内生效，与组会管理/科研成果风格一致） ===== */
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
.detail-item { display: flex; flex-direction: column; gap: 4px; }
.detail-item.full { grid-column: 1 / -1; }
.detail-box {
  padding: 0;
  overflow: hidden;
  border: 1px solid #eef1f5;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(15, 35, 80, 0.22);
  width: 560px;
  max-width: 92vw;
  max-height: 86vh;
  display: flex;
  flex-direction: column;
}
.detail-box .modal-title {
  margin: 0;
  padding: 16px 24px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  color: #1f2329;
  background: linear-gradient(135deg, #f2f8ff 0%, #f2faf6 100%);
  border-bottom: 1px solid #eef1f5;
  flex: 0 0 auto;
}
.detail-box .modal-title::before {
  content: '';
  flex: 0 0 auto;
  width: 4px;
  height: 16px;
  border-radius: 999px;
  background: linear-gradient(180deg, #0d80e0, #19a558);
}
.detail-box .detail-grid {
  padding: 20px 24px;
  flex: 1 1 auto;
  overflow-y: auto;
  min-height: 0;
}
.detail-box .detail-item {
  background: #f8fafc;
  border: 1px solid #eef1f5;
  border-radius: 10px;
  padding: 10px 12px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.detail-box .detail-item:hover {
  border-color: #cfe4f7;
  box-shadow: 0 2px 8px rgba(13, 128, 224, 0.06);
}
.detail-box .detail-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #8a9099;
}
.detail-box .detail-label::before {
  content: '';
  flex: 0 0 auto;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0d80e0, #19a558);
  opacity: 0.75;
}
.detail-box .detail-value {
  font-size: 13px;
  color: #1f2329;
  line-height: 1.6;
}
.detail-box .detail-value.detail-text {
  background: #fff;
  border: 1px solid #eceff3;
  border-radius: 8px;
  padding: 10px 12px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.7;
  color: #4e5969;
  max-height: 40vh;
  overflow-y: auto;
}
.detail-box .modal-actions {
  margin: 0;
  padding: 14px 24px;
  background: #fafbfc;
  border-top: 1px solid #eef1f5;
  flex: 0 0 auto;
}
/* 首个按钮（关闭）升级为主按钮 */
.detail-box .modal-actions .btn:first-child {
  background: linear-gradient(135deg, #0d80e0, #19a558);
  border: none;
  color: #fff;
  font-weight: 600;
  min-width: 80px;
}
.detail-box .modal-actions .btn:first-child:hover {
  opacity: 0.92;
  color: #fff;
  border-color: transparent;
}
</style>
