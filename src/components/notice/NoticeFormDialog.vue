<template>
  <!-- 发布 / 编辑公告弹窗（超管可发布到任意组，组管固定本组） -->
  <div v-if="visible" class="modal-mask" @click.self="close">
    <div class="modal lg">
      <div class="modal-head">
        <h3>{{ isEdit ? '编辑公告' : '发布公告' }}</h3>
        <button type="button" class="modal-close" @click="close">×</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label>所属课题组</label>
          <select v-if="!isEdit && !fixedGroupName" v-model="form.groupId" class="select">
            <option value="">请选择课题组</option>
            <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
          </select>
          <input v-else :value="form.groupName" class="input" readonly />
          <p class="hint" v-if="isEdit">公告归属课题组不可修改</p>
          <p class="hint" v-else-if="fixedGroupName">公告仅发布到当前绑定的课题组</p>
        </div>
        <div class="field">
          <label>公告标题</label>
          <input v-model.trim="form.title" class="input" placeholder="请输入公告标题" maxlength="100" />
          <p class="hint">不超过 100 个字符</p>
        </div>
        <div class="field">
          <label>公告内容（支持 Markdown 排版，或直接输入纯文本）</label>
          <div class="md-toolbar">
            <button type="button" class="btn btn-sm" @click="insertMd('**', '**', '加粗文本')">加粗</button>
            <button type="button" class="btn btn-sm" @click="insertMd('*', '*', '斜体文本')">斜体</button>
            <button type="button" class="btn btn-sm" @click="insertMd('\n- ', '', '列表项')">列表</button>
            <button type="button" class="btn btn-sm" @click="insertMd('\n1. ', '', '列表项')">有序列表</button>
            <button type="button" class="btn btn-sm" @click="insertMd('[', '](https://)', '链接文字')">链接</button>
            <button type="button" class="btn btn-sm" @click="insertMd('\n> ', '', '引用内容')">引用</button>
            <button type="button" class="btn btn-sm" @click="insertMd('`', '`', '代码')">代码</button>
            <button type="button" class="btn btn-sm" @click="insertMd('\n```\n', '\n```', '代码块')">代码块</button>
          </div>
          <div class="md-editor">
            <textarea ref="contentEl" v-model="form.content" placeholder="支持 Markdown 排版，或直接输入纯文本" maxlength="10000" style="min-height: 220px"></textarea>
            <div class="md-preview">
              <NoticeContent :content="form.content" />
              <p v-if="!form.content" class="hint">输入内容后此处实时预览</p>
            </div>
          </div>
          <p class="hint">不超过 10000 个字符；支持加粗、斜体、列表、链接、引用、代码块</p>
        </div>
        <div class="field" v-if="isEdit">
          <label>状态</label>
          <select v-model="form.status" class="select">
            <option :value="1">已发布</option>
            <option :value="2">下架</option>
          </select>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" @click="close">取消</button>
        <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import NoticeContent from './NoticeContent.vue'
import { createNotice, updateNotice } from '../../api'
import { dialogAlert } from '../../composables/useDialog'

const props = defineProps({
  visible: { type: Boolean, default: false },
  isEdit: { type: Boolean, default: false },
  editId: { type: [Number, String], default: null },
  initial: { type: Object, default: null },
  // 超管选组列表；fixedGroupName 非空时（组管固定本组）隐藏选组下拉
  groups: { type: Array, default: () => [] },
  fixedGroupName: { type: String, default: '' }
})
const emit = defineEmits(['update:visible', 'saved'])

const saving = ref(false)
const form = reactive({ groupId: '', groupName: '', title: '', content: '', status: 1 })

// 打开弹窗：用父级传入的 initial 初始化（编辑用行数据，新建重置）
watch(
  () => props.visible,
  (v) => {
    if (!v) return
    const d = props.initial || {}
    Object.assign(form, {
      groupId: d.groupId || '',
      groupName: d.groupName || props.fixedGroupName || '',
      title: d.title || '',
      content: d.content || '',
      status: d.status || 1
    })
  }
)

function close() {
  emit('update:visible', false)
}

async function save() {
  if (!form.title) return dialogAlert('请输入公告标题')
  if (!form.content) return dialogAlert('请输入公告内容')
  if (form.content.length > 10000) return dialogAlert('公告内容不能超过 10000 个字符')
  if (!props.isEdit && !props.fixedGroupName && !form.groupId) return dialogAlert('请选择要发布公告的课题组')
  saving.value = true
  try {
    const res = props.isEdit
      ? await updateNotice(props.editId, { title: form.title, content: form.content, status: form.status })
      : await createNotice({ groupId: form.groupId, title: form.title, content: form.content })
    if (res && res.success) {
      emit('saved')
      close()
    } else {
      dialogAlert((res && res.message) || '保存失败')
    }
  } finally {
    saving.value = false
  }
}

// Markdown 工具栏：在光标处插入语法标记（有选区则包住选区，无选区插入示例文本）
const contentEl = ref(null)
function insertMd(before, after, placeholder) {
  const ta = contentEl.value
  const cur = form.content || ''
  if (!ta) {
    form.content = cur + before + placeholder + after
    return
  }
  const start = ta.selectionStart
  const end = ta.selectionEnd
  const sel = cur.slice(start, end) || placeholder
  const prefix = start > 0 && cur[start - 1] !== '\n' && before.startsWith('\n') ? '\n' : ''
  form.content = cur.slice(0, start) + prefix + before + sel + after + cur.slice(end)
  ta.focus()
  const pos = start + prefix.length + before.length + sel.length + after.length
  ta.setSelectionRange(pos, pos)
}
</script>

<style scoped>
.md-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.md-editor {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.md-preview {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  min-height: 220px;
  max-height: 260px;
  overflow: auto;
  background: var(--bg-hover-soft);
}
@media (max-width: 900px) {
  .md-editor {
    grid-template-columns: 1fr;
  }
}
</style>
