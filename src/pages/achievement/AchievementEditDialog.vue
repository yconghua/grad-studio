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
          <div class="form-row">
            <label class="form-label">附件路径</label>
            <input v-model="form.attachmentPath" class="input" style="flex:1; min-width: 220px" placeholder="附件文件路径（可空）" />
          </div>
          <div class="form-row form-row--full">
            <label class="form-label">成果说明</label>
            <textarea v-model="form.description" class="textarea" rows="3" placeholder="成果说明 / 备注（可空）"></textarea>
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

const TYPES = { paper: '论文', patent: '专利', software: '软件著作权', award: '获奖', project: '项目', other: '其他' }

const props = defineProps({
  visible: { type: Boolean, default: false },
  row: { type: Object, default: null },      // 编辑时传入（含 id）
  userId: { type: [Number, String], default: null } // 代填时目标学生 id
})
const emit = defineEmits(['update:visible', 'save'])

const saving = ref(false)
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
    attachmentPath: '',
    description: ''
  }
}

watch(
  () => props.visible,
  (v) => {
    if (!v) return
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
        attachmentPath: props.row.attachmentPath || '',
        description: props.row.description || ''
      }
    } else {
      form.value = emptyForm()
    }
  }
)

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
      attachmentPath: form.value.attachmentPath.trim() || null,
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
</style>
