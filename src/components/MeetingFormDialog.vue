<template>
  <div v-if="visible" class="modal-mask" @click.self="emit('update:visible', false)">
    <div class="modal lg">
      <div class="modal-head">
        <h3>{{ title }}</h3>
        <button type="button" class="modal-close" @click="emit('update:visible', false)">×</button>
      </div>
      <div class="modal-body">
        <!-- 所属课题组：组管固定本组不可改；超管新建时下拉选择 -->
        <div class="field" v-if="mode === 'create'">
          <label>所属课题组</label>
          <select v-if="!fixedGroupId" v-model="form.groupId" class="select" @change="onGroupChange">
            <option value="">请选择课题组</option>
            <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
          </select>
          <input v-else :value="form.groupName" class="input" readonly />
          <p class="hint" v-if="!fixedGroupId">会议仅归属一个课题组，创建后不可修改</p>
        </div>
        <div class="field" v-else>
          <label>所属课题组</label>
          <input :value="form.groupName" class="input" readonly />
        </div>

        <div class="field">
          <label>会议主题</label>
          <input v-model.trim="form.title" class="input" placeholder="请输入会议主题" maxlength="100" />
          <p class="hint">不超过 100 个字符</p>
        </div>

        <div class="field">
          <label>会议时间</label>
          <input v-model="form.meetingTime" type="datetime-local" class="input" style="width: 220px" />
          <p class="hint">必填</p>
        </div>

        <div class="field">
          <label>地点</label>
          <input v-model.trim="form.location" class="input" placeholder="会议地点（选填）" maxlength="100" />
        </div>

        <div class="field">
          <label>议题</label>
          <textarea v-model.trim="form.agenda" class="input" placeholder="本次会议议题（选填）" maxlength="2000" style="min-height: 72px"></textarea>
          <p class="hint">不超过 2000 个字符</p>
        </div>

        <div class="field">
          <label>会议纪要（支持 Markdown 排版，或直接输入纯文本）</label>
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
            <textarea ref="contentEl" v-model="form.content" placeholder="支持 Markdown 排版，或直接输入纯文本" maxlength="20000" style="min-height: 220px"></textarea>
            <div class="md-preview">
              <NoticeContent :content="form.content" />
              <p v-if="!form.content" class="hint">输入内容后此处实时预览</p>
            </div>
          </div>
          <p class="hint">不超过 20000 个字符；支持加粗、斜体、列表、链接、引用、代码块</p>
        </div>

        <div class="field">
          <label>参与人（本组启用状态的导师 / 学生）</label>
          <p class="hint" v-if="!memberOptions.length">加载参与人候选失败或本组暂无可用成员</p>
          <div class="member-picker" v-else>
            <label v-for="m in memberOptions" :key="m.id" class="member-item">
              <input type="checkbox" :value="m.id" v-model="form.participantIds" />
              <span class="ellipsis">{{ m.realName || m.username }}</span>
              <span class="tag" :class="m.role === 'mentor' ? 'tag-blue' : ''">{{ m.role === 'mentor' ? '导师' : '学生' }}</span>
            </label>
          </div>
          <p class="hint">参与人由发布者指定，不做参与确认；已发布会议至少需要一位参与人</p>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" @click="emit('update:visible', false)">取消</button>
        <template v-if="showDraftButton">
          <button class="btn" :disabled="saving" @click="save(1)">{{ saving ? '保存中…' : '保存草稿' }}</button>
        </template>
        <button class="btn btn-primary" :disabled="saving" @click="save(2)">{{ saving ? '保存中…' : submitText }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import NoticeContent from './NoticeContent.vue'
import { createMeeting, updateMeeting, publishMeeting, getMeetingMemberOptions } from '../api'
import { dialogAlert } from '../composables/useDialog'

// 组会新建 / 编辑弹窗（仅超管、组管可用）：
//   - 组管 fixedGroupId 固定本组；超管新建时在弹窗内下拉选择课题组；
//   - 参与人多选来自该组启用状态的导师/学生（组管、超管不作为候选）；
//   - 草稿可「保存草稿 / 发布」，已发布/已归档编辑后保持原状态（只能保存）；
//   - 公告发布走列表/详情的独立按钮，本弹窗不含「同时发布为公告」勾选项。
const props = defineProps({
  visible: { type: Boolean, default: false },
  mode: { type: String, default: 'create' }, // 'create' | 'edit'
  initial: { type: Object, default: null }, // edit 模式：会议详情（含 content、participants）
  fixedGroupId: { type: [Number, String], default: '' }, // 组管绑定组 id（超管传空）
  fixedGroupName: { type: String, default: '' },
  groups: { type: Array, default: () => [] } // 超管可选课题组
})
const emit = defineEmits(['update:visible', 'saved'])

const form = reactive({
  groupId: '',
  groupName: '',
  title: '',
  meetingTime: '',
  location: '',
  agenda: '',
  content: '',
  participantIds: []
})
const memberOptions = ref([])
const saving = ref(false)
const contentEl = ref(null)

const title = computed(() => (props.mode === 'edit' ? '编辑会议' : '新建会议'))
// 草稿可存草稿；编辑已发布/已归档会议时只显示「保存」
const showDraftButton = computed(() => props.mode === 'create' || props.initial?.status === 1)
const submitText = computed(() => {
  if (props.mode === 'edit' && props.initial?.status !== 1) return '保存'
  return '发布'
})

watch(
  () => props.visible,
  (v) => {
    if (!v) return
    if (props.mode === 'create') {
      Object.assign(form, {
        groupId: props.fixedGroupId || '',
        groupName: props.fixedGroupName || '',
        title: '',
        meetingTime: '',
        location: '',
        agenda: '',
        content: '',
        participantIds: []
      })
      memberOptions.value = []
      if (props.fixedGroupId) loadMemberOptions(props.fixedGroupId)
    } else if (props.initial) {
      const m = props.initial
      Object.assign(form, {
        groupId: m.groupId,
        groupName: m.groupName || '',
        title: m.title || '',
        meetingTime: toLocalInput(m.meetingTime),
        location: m.location || '',
        agenda: m.agenda || '',
        content: m.content || '',
        participantIds: (m.participants || []).map((p) => p.userId)
      })
      loadMemberOptions(m.groupId)
    }
  }
)

function onGroupChange() {
  form.participantIds = []
  memberOptions.value = []
  if (form.groupId) loadMemberOptions(form.groupId)
}

async function loadMemberOptions(groupId) {
  const res = await getMeetingMemberOptions(groupId)
  if (res && res.success) {
    memberOptions.value = (res.data && res.data) || []
  } else {
    memberOptions.value = []
    dialogAlert((res && res.message) || '加载参与人列表失败')
  }
}

// datetime-local 显示用：'YYYY-MM-DD HH:mm:ss' → 'YYYY-MM-DDTHH:mm'
function toLocalInput(v) {
  if (!v) return ''
  return String(v).replace(' ', 'T').slice(0, 16)
}
// 提交用：'YYYY-MM-DDTHH:mm' → 'YYYY-MM-DD HH:mm:ss'
function fmtDateTime(v) {
  if (!v) return ''
  return v.replace('T', ' ') + (v.length === 16 ? ':00' : '')
}

async function save(status) {
  if (!form.title) return dialogAlert('请输入会议主题')
  if (!form.meetingTime) return dialogAlert('请选择会议时间')
  if (form.content.length > 20000) return dialogAlert('会议纪要不能超过 20000 个字符')
  if (props.mode === 'create' && !props.fixedGroupId && !form.groupId) return dialogAlert('请选择所属课题组')
  if (status === 2 && form.participantIds.length === 0) return dialogAlert('已发布的会议至少需要一位参与人')

  const payload = {
    title: form.title,
    meetingTime: fmtDateTime(form.meetingTime),
    location: form.location,
    agenda: form.agenda,
    content: form.content,
    // slice() 复制为普通数组再传 IPC：reactive 数组是 Proxy，结构化克隆会失败
    participantIds: form.participantIds.slice()
  }

  saving.value = true
  try {
    let res
    if (props.mode === 'create') {
      payload.status = status
      if (!props.fixedGroupId) payload.groupId = form.groupId
      res = await createMeeting(payload)
    } else {
      // 编辑：先更新内容；草稿点「发布」时再调发布（发布后不可回退草稿）
      res = await updateMeeting(props.initial.id, payload)
      if (res && res.success && props.initial.status === 1 && status === 2) {
        res = await publishMeeting(props.initial.id)
      }
    }
    if (res && res.success) {
      emit('update:visible', false)
      emit('saved', status)
    } else {
      dialogAlert((res && res.message) || '保存失败')
    }
  } finally {
    saving.value = false
  }
}

// Markdown 工具栏：在光标处插入语法标记（有选区则包住选区，无选区插入示例文本）
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
  max-height: 300px;
  overflow: auto;
  background: var(--bg-hover-soft);
}
.member-picker {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 6px;
  max-height: 200px;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 10px 12px;
}
.member-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  min-width: 0;
}
@media (max-width: 900px) {
  .md-editor {
    grid-template-columns: 1fr;
  }
}
</style>
