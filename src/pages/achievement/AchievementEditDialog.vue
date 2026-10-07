<template>
  <div v-if="visible" class="modal-mask" @click.self="close">
    <div class="modal md">
      <div class="modal-head">
        <h3>{{ form.id ? '编辑成果' : '新增成果' }}</h3>
        <button class="modal-close" @click="close">×</button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="form-row">
            <label class="form-label">成果类型 <i style="color:#ef4444">*</i></label>
            <select v-model="form.type" class="input" style="width: 160px">
              <option v-for="(label, key) in TYPES" :key="key" :value="key">{{ label }}</option>
            </select>
          </div>
          <div class="form-row">
            <label class="form-label">成果名称 <i style="color:#ef4444">*</i></label>
            <input v-model="form.title" class="input" style="flex:1; min-width: 220px" placeholder="如：论文题目 / 专利名称" />
          </div>
          <div class="form-row">
            <label class="form-label">发表载体</label>
            <input v-model="form.venue" class="input" style="flex:1; min-width: 220px" placeholder="期刊 / 会议 / 授权机构名称" />
          </div>
          <div class="form-row">
            <label class="form-label">级别</label>
            <input v-model="form.level" class="input" style="width: 200px" placeholder="如：SCI二区 / 发明专利 / 国家级" />
          </div>
          <div class="form-row">
            <label class="form-label">作者</label>
            <input v-model="form.authors" class="input" style="flex:1; min-width: 220px" placeholder="如：张三(1)，李四(2)，1为本人" />
          </div>
          <div class="form-row">
            <label class="form-label">第一作者</label>
            <select v-model="form.isFirst" class="input" style="width: 120px">
              <option :value="true">是</option>
              <option :value="false">否</option>
            </select>
          </div>
          <div class="form-row">
            <label class="form-label">发表/授权日期</label>
            <input v-model="form.publishDate" type="date" class="input" style="width: 160px" />
          </div>
          <div class="form-row form-row--full">
            <label class="form-label">成果说明</label>
            <textarea v-model="form.description" class="textarea" rows="3" placeholder="成果说明 / 备注（可空）"></textarea>
          </div>
          <div class="form-row form-row--full">
            <label class="form-label">附件</label>
            <div class="attach-box">
              <template v-if="form.id">
                <div v-if="!attachments.length" class="attach-empty">暂无附件</div>
                <div v-for="a in attachments" :key="a.id" class="attach-item">
                  <span class="attach-icon">📎</span>
                  <span class="attach-name" :title="a.file_name">{{ a.file_name }}</span>
                  <span class="attach-size">{{ sizeText(a.file_size) }}</span>
                  <button type="button" class="btn btn-sm" :disabled="uploading" @click="onDownload(a)">下载</button>
                  <button type="button" class="btn btn-sm btn-danger" :disabled="uploading" @click="onDeleteAttach(a)">删除</button>
                </div>
                <div class="attach-actions">
                  <input ref="fileInput" type="file" class="attach-file" @change="onFileChange" />
                  <button type="button" class="btn btn-sm" :disabled="uploading" @click="fileInput.click()">
                    {{ uploading ? '上传中…' : '上传附件' }}
                  </button>
                  <span class="attach-tip">PDF / Word / 图片，单文件 ≤ 50MB，累计 ≤ 1GB</span>
                </div>
              </template>
              <div v-else class="attach-tip">先保存成果，再上传附件</div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" @click="close">取消</button>
        <button class="btn btn-primary" :disabled="!form.title.trim() || saving" @click="save">
          {{ saving ? '保存中…' : '保存' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { listAchievementAttachments, uploadAchievementAttachment, removeAchievementAttachment, downloadAchievementAttachment } from '../../api'
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'

const TYPES = { paper: '论文', patent: '专利', software: '软件著作权', award: '获奖', project: '项目', other: '其他' }

const props = defineProps({
  visible: { type: Boolean, default: false },
  row: { type: Object, default: null },      // 编辑时传入（含 id）
  userId: { type: [Number, String], default: null } // 代填时目标学生 id
})
const emit = defineEmits(['update:visible', 'save'])

const saving = ref(false)
const uploading = ref(false)
const fileInput = ref(null)
const attachments = ref([])
const form = ref(emptyForm())

function emptyForm() {
  return {
    id: null,
    type: 'paper',
    title: '',
    venue: '',
    level: '',
    authors: '',
    isFirst: false,
    publishDate: '',
    description: ''
  }
}

function sizeText(bytes) {
  const b = Number(bytes) || 0
  if (b >= 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + 'MB'
  if (b >= 1024) return (b / 1024).toFixed(1) + 'KB'
  return b + 'B'
}

watch(
  () => props.visible,
  (v) => {
    if (!v) return
    attachments.value = []
    if (props.row) {
      form.value = {
        id: props.row.id,
        type: props.row.type,
        title: props.row.title,
        venue: props.row.venue || '',
        level: props.row.level || '',
        authors: props.row.authors || '',
        isFirst: !!props.row.isFirst,
        publishDate: props.row.publishDate || '',
        description: props.row.description || ''
      }
      if (props.row.id) loadAttachments(props.row.id)
    } else {
      form.value = emptyForm()
    }
  }
)

async function loadAttachments(achievementId) {
  try {
    const res = await listAchievementAttachments(achievementId)
    if (res && res.success) {
      attachments.value = (res.data && res.data.list) || []
    }
  } catch (e) {
    // 附件加载失败不打断表单编辑
  }
}

async function onFileChange(e) {
  const file = e.target && e.target.files && e.target.files[0]
  e.target.value = ''
  if (!file) return
  if (file.size > 50 * 1024 * 1024) {
    dialogAlert('单文件不能超过 50MB')
    return
  }
  uploading.value = true
  try {
    const data = await file.arrayBuffer()
    const res = await uploadAchievementAttachment({
      achievementId: form.value.id,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      data
    })
    if (res && res.success) {
      loadAttachments(form.value.id)
    } else {
      dialogAlert((res && res.message) || '上传失败，请重试')
    }
  } catch (err) {
    dialogAlert('上传失败，请重试')
  } finally {
    uploading.value = false
  }
}

async function onDownload(a) {
  try {
    const res = await downloadAchievementAttachment(a.id)
    if (res && res.success) {
      dialogAlert(`附件已保存：${a.file_name}`)
    } else if (!(res && res.canceled)) {
      dialogAlert((res && res.message) || '下载失败，请重试')
    }
  } catch (e) {
    dialogAlert('下载失败，请重试')
  }
}

async function onDeleteAttach(a) {
  const ok = await dialogConfirm(`确定删除附件「${a.file_name}」吗？`)
  if (!ok) return
  const res = await removeAchievementAttachment(a.id)
  if (res && res.success) {
    loadAttachments(form.value.id)
  } else {
    dialogAlert((res && res.message) || '删除失败，请重试')
  }
}

async function save() {
  saving.value = true
  try {
    const payload = {
      id: form.value.id,
      userId: props.userId || undefined,
      type: form.value.type,
      title: form.value.title.trim(),
      venue: form.value.venue.trim(),
      level: form.value.level.trim(),
      authors: form.value.authors.trim(),
      isFirst: form.value.isFirst,
      publishDate: form.value.publishDate || null,
      description: form.value.description
    }
    emit('save', payload)
  } finally {
    saving.value = false
  }
}

function close() {
  emit('update:visible', false)
}
</script>

<style scoped>
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
}
.form-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  padding: 8px 0;
}
.form-row--full { grid-column: 1 / -1; }
.form-row--full .textarea { flex: 1 1 100%; }
.form-label {
  width: 96px;
  flex-shrink: 0;
  font-size: 14px;
  color: var(--text-2, #6b7280);
  line-height: 34px;
}
.textarea {
  flex: 1;
  min-width: 0;
  min-height: 96px;
  padding: 8px 10px;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: var(--radius-sm, 6px);
  font-size: 14px;
  font-family: inherit;
  color: var(--text, #111827);
  resize: vertical;
  outline: none;
  box-sizing: border-box;
}
.attach-box {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border: 1px dashed var(--border, #e5e7eb);
  border-radius: var(--radius-sm, 6px);
  background: var(--bg-2, #f9fafb);
}
.attach-empty { font-size: 12px; color: var(--text-3, #9aa0aa); }
.attach-item { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.attach-icon { color: var(--text-2, #6b7280); }
.attach-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text, #111827);
}
.attach-size { color: var(--text-3, #9aa0aa); }
.attach-actions { display: flex; align-items: center; gap: 10px; }
.attach-file { display: none; }
.attach-tip { font-size: 12px; color: var(--text-3, #9aa0aa); }
.btn-danger { color: #dc2626; border-color: #fecaca; }
</style>
