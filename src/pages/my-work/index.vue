<template>
  <div class="page">
    <div class="page-head card">
      <div>
        <h2 class="page-title">📋 我的任务</h2>
        <p class="page-desc">导师 / 组管下发给我的课题任务，可在此更新进展。</p>
      </div>
    </div>

    <div class="card">
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
          <span class="form-label">当前进度（0-100）</span>
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
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { listMyTasks, submitTaskProgress, listTaskProgress } from '../../api'

const route = useRoute()
const tasks = ref([])
const loading = ref(false)
const error = ref('')
const expandedId = ref(null)
const progressList = ref([])
const progLoading = ref(false)

const progModal = ref({
  show: false, saving: false, error: '', task: null,
  form: { task_id: null, content: '', progress_percent: 0 }
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await listMyTasks()
    if (res && res.success) {
      tasks.value = res.data || []
      // 携带 focus 参数进入时，自动定位并展开该任务（工作台点击跳转）
      const focus = Number(route.query.focus)
      if (focus) {
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
  return { todo: '待办', in_progress: '进行中', completed: '已完成', cancelled: '已取消' }[s] || s
}
function statusClass(s) {
  return { todo: 'b-gray', in_progress: 'b-blue', completed: 'b-green', cancelled: 'b-gray' }[s] || 'b-gray'
}
function priText(p) {
  return { high: '高', medium: '中', low: '低' }[p] || '中'
}
function fmtTime(t) {
  if (!t) return '—'
  return String(t).replace('T', ' ').slice(0, 16)
}

load()
</script>

<style scoped>
.page { display: flex; flex-direction: column; gap: 16px; }
.card {
  background: #fff; border-radius: 12px; padding: 18px 20px;
  border: 1px solid #eceff3; box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.page-title { margin: 0; font-size: 18px; color: #1f2329; }
.page-desc { margin: 4px 0 0; font-size: 13px; color: #8a9099; }
.state { padding: 40px 0; text-align: center; color: #8a9099; font-size: 13px; }
.state.error { color: #ea4335; }
.mini-state { padding: 16px 0; text-align: center; color: #8a9099; font-size: 12px; }

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
.form-item input, .form-item textarea {
  padding: 8px 10px; border: 1px solid #dfe3e8; border-radius: 8px;
  font-size: 13px; outline: none; font-family: inherit; resize: vertical;
}
.form-item input:focus, .form-item textarea:focus { border-color: #0d80e0; }
.form-error { color: #ea4335; font-size: 12px; margin: 0 0 10px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; }
</style>
