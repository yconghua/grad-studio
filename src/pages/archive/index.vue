<template>
  <div class="page">
    <div class="page-head card">
      <div>
        <h2 class="page-title">📂 科研档案</h2>
        <p class="page-desc">归档个人科研里程碑（获奖、会议报告、重要节点等），并可导出聚合数据。</p>
      </div>
      <div class="head-actions">
        <button class="btn" @click="onExport" :disabled="exporting">
          {{ exporting ? '导出中…' : '📦 导出档案' }}
        </button>
        <button class="btn primary" @click="openModal()">＋ 新增档案</button>
      </div>
    </div>

    <div class="card">
      <div v-if="loading" class="state">加载中…</div>
      <div v-else-if="error" class="state error">{{ error }}</div>
      <div v-else-if="!records.length" class="state">暂无档案记录，点击右上角「新增档案」。</div>
      <table v-else class="tbl">
        <thead>
          <tr><th>日期</th><th>类型</th><th>标题</th><th>说明</th><th>附件</th><th>上传时间</th><th style="width:120px">操作</th></tr>
        </thead>
        <tbody>
          <tr v-for="r in records" :key="r.id">
            <td class="nowrap">{{ r.record_date || '—' }}</td>
            <td><span class="tag">{{ typeText(r.record_type) }}</span></td>
            <td>{{ r.title || '—' }}</td>
            <td class="content-cell">{{ r.content || '—' }}</td>
            <td>
              <button v-if="r.attachment" class="link" @click="onOpenFile(r.attachment)">打开附件</button>
              <span v-else class="muted">—</span>
            </td>
            <td class="nowrap muted">{{ fmtTime(r.created_at) }}</td>
            <td><button class="link danger" @click="onRemove(r)">删除</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 新增弹窗 -->
    <div v-if="modal.show" class="modal-mask" @click.self="modal.show = false">
      <div class="modal-box">
        <h3 class="modal-title">新增档案</h3>
        <label class="form-item">
          <span class="form-label">类型</span>
          <select v-model="modal.form.record_type">
            <option value="custom">自定义</option>
            <option value="log">科研日志</option>
            <option value="weekly">周报</option>
            <option value="achievement">成果</option>
            <option value="task">任务</option>
            <option value="meeting">组会</option>
          </select>
        </label>
        <label class="form-item">
          <span class="form-label">标题</span>
          <input type="text" v-model="modal.form.title" placeholder="如：获校级奖学金 / 参加学术会议" />
        </label>
        <label class="form-item">
          <span class="form-label">发生日期 <i>*</i></span>
          <input type="date" v-model="modal.form.record_date" />
        </label>
        <label class="form-item">
          <span class="form-label">说明</span>
          <textarea rows="3" v-model="modal.form.content"></textarea>
        </label>
        <label class="form-item">
          <span class="form-label">附件</span>
          <div class="attach-row">
            <input type="text" :value="modal.form.attachmentName || ''" placeholder="未选择文件" readonly />
            <button class="btn sm" @click="onPickFile">选择文件</button>
          </div>
        </label>
        <p v-if="modal.error" class="form-error">{{ modal.error }}</p>
        <div class="modal-actions">
          <button class="btn" @click="modal.show = false">取消</button>
          <button class="btn primary" :disabled="modal.saving" @click="onSave">
            {{ modal.saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 导出结果弹窗 -->
    <div v-if="exportResult.show" class="modal-mask" @click.self="exportResult.show = false">
      <div class="modal-box">
        <h3 class="modal-title">📦 档案导出结果</h3>
        <p class="export-tip">导出为当前会话内聚合数据（后端未生成文件），统计如下：</p>
        <div class="export-grid">
          <div class="export-item"><span class="num">{{ exportResult.counts.logs }}</span><span>科研日志</span></div>
          <div class="export-item"><span class="num">{{ exportResult.counts.weeklyReports }}</span><span>周报</span></div>
          <div class="export-item"><span class="num">{{ exportResult.counts.achievements }}</span><span>科研成果</span></div>
          <div class="export-item"><span class="num">{{ exportResult.counts.tasks }}</span><span>任务</span></div>
          <div class="export-item"><span class="num">{{ exportResult.counts.archiveRecords }}</span><span>档案条目</span></div>
        </div>
        <div class="modal-actions">
          <button class="btn primary" @click="exportResult.show = false">知道了</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'
import { ref } from 'vue'
import {
  listArchiveRecords, createArchiveRecord, removeArchiveRecord,
  exportArchive, pickAttachment, openAttachment
} from '../../api'

const records = ref([])
const loading = ref(false)
const error = ref('')
const exporting = ref(false)

const modal = ref({
  show: false, saving: false, error: '',
  form: { record_type: 'custom', title: '', record_date: '', content: '', attachment: '', attachmentName: '' }
})

const exportResult = ref({ show: false, counts: {} })

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await listArchiveRecords()
    if (res && res.success) records.value = res.data || []
    else error.value = (res && res.message) || '加载失败'
  } catch (e) {
    error.value = '网络异常，请重试'
  } finally {
    loading.value = false
  }
}

function openModal() {
  modal.value.error = ''
  modal.value.form = { record_type: 'custom', title: '', record_date: '', content: '', attachment: '', attachmentName: '' }
  modal.value.show = true
}

async function onPickFile() {
  const res = await pickAttachment()
  if (res && res.success) {
    modal.value.form.attachment = res.path
    modal.value.form.attachmentName = res.name
  } else if (res && res.message) {
    modal.value.error = res.message
  }
}

async function onSave() {
  const f = modal.value.form
  if (!f.record_date) { modal.value.error = '请选择记录日期'; return }
  modal.value.saving = true
  modal.value.error = ''
  try {
    const payload = { record_type: f.record_type, title: f.title, record_date: f.record_date, content: f.content }
    if (f.attachment) payload.attachment = f.attachment
    const res = await createArchiveRecord(payload)
    if (res && res.success) {
      modal.value.show = false
      await load()
    } else {
      modal.value.error = (res && res.message) || '保存失败'
    }
  } catch (e) {
    modal.value.error = '网络异常，请重试'
  } finally {
    modal.value.saving = false
  }
}

async function onRemove(r) {
  if (!await dialogConfirm('确定删除该档案条目吗？')) return
  const res = await removeArchiveRecord(r.id)
  if (res && res.success) await load()
  else dialogAlert((res && res.message) || '删除失败')
}

async function onOpenFile(path) {
  const res = await openAttachment(path)
  if (!res || !res.success) dialogAlert((res && res.message) || '打开失败')
}

async function onExport() {
  exporting.value = true
  try {
    const res = await exportArchive()
    if (res && res.success && res.data) {
      const d = res.data
      exportResult.value.counts = {
        logs: (d.logs || []).length,
        weeklyReports: (d.weeklyReports || []).length,
        achievements: (d.achievements || []).length,
        tasks: (d.tasks || []).length,
        archiveRecords: (d.archiveRecords || []).length
      }
      exportResult.value.show = true
    } else {
      dialogAlert((res && res.message) || '导出失败')
    }
  } catch (e) {
    dialogAlert('导出失败，请重试')
  } finally {
    exporting.value = false
  }
}

function typeText(t) {
  return { log: '科研日志', weekly: '周报', achievement: '成果', task: '任务', meeting: '组会', custom: '自定义' }[t] || t
}
function fmtTime(t) {
  return t ? String(t).replace('T', ' ').slice(0, 16) : ''
}

load()
</script>

<style scoped>
.page { display: flex; flex-direction: column; gap: 16px; }
.card {
  background: #fff; border-radius: 12px; padding: 18px 20px;
  border: 1px solid #eceff3; box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.page-head { display: flex; justify-content: space-between; align-items: center; }
.page-title { margin: 0; font-size: 18px; color: #1f2329; }
.page-desc { margin: 4px 0 0; font-size: 13px; color: #8a9099; }
.head-actions { display: flex; gap: 10px; }

.btn {
  height: 34px; padding: 0 16px; border-radius: 8px; font-size: 13px;
  border: 1px solid #dfe3e8; background: #fff; color: #4e5969; cursor: pointer;
}
.btn.sm { height: 30px; padding: 0 10px; font-size: 12px; }
.btn.primary { background: linear-gradient(135deg, #0d80e0, #19a558); border: none; color: #fff; font-weight: 600; }
.btn:disabled { opacity: 0.5; }

.state { padding: 40px 0; text-align: center; color: #8a9099; font-size: 13px; }
.state.error { color: #ea4335; }

.tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.tbl th {
  background: #f7f9fc; text-align: left; padding: 10px 12px;
  border-bottom: 1px solid #eceff3; color: #4e5969; font-weight: 600;
}
.tbl td { padding: 10px 12px; border-bottom: 1px solid #eceff3; color: #1f2329; }
.tbl tbody tr:nth-child(even) { background: #fafbfc; }
.tbl tbody tr:hover { background: #eef6ff; }
.nowrap { white-space: nowrap; }
.muted { color: #8a9099; }
.content-cell { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tag { display: inline-block; padding: 2px 10px; border-radius: 999px; background: #eef6ff; color: #0d80e0; font-size: 12px; }
.link { background: none; border: none; color: #0d80e0; cursor: pointer; font-size: 13px; padding: 0 4px; }
.link:hover { text-decoration: underline; }
.link.danger { color: #ea4335; }

.modal-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal-box { background: #fff; border-radius: 12px; padding: 24px; width: 460px; box-shadow: 0 12px 40px rgba(0,0,0,0.18); }
.modal-title { margin: 0 0 18px; font-size: 16px; color: #1f2329; }
.form-item { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.form-label { font-size: 13px; color: #4e5969; }
.form-label i { color: #ea4335; font-style: normal; }
.form-item input, .form-item textarea, .form-item select {
  padding: 8px 10px; border: 1px solid #dfe3e8; border-radius: 8px;
  font-size: 13px; outline: none; font-family: inherit; resize: vertical; background: #fff;
}
.form-item input:focus, .form-item textarea:focus, .form-item select:focus { border-color: #0d80e0; }
.attach-row { display: flex; gap: 8px; }
.attach-row input { flex: 1; background: #f7f9fc; }
.form-error { color: #ea4335; font-size: 12px; margin: 0 0 10px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }

.export-tip { font-size: 13px; color: #4e5969; margin: 0 0 16px; }
.export-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 18px; }
.export-item {
  background: #f7f9fc; border-radius: 10px; padding: 14px; text-align: center;
  display: flex; flex-direction: column; gap: 4px;
}
.export-item .num { font-size: 22px; font-weight: 700; color: #0d80e0; }
.export-item span:last-child { font-size: 12px; color: #8a9099; }
</style>
