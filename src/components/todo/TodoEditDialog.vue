<template>
  <div v-if="open" class="modal-mask" @click.self="close">
    <div class="modal todo-edit-dialog">
      <div class="modal-head">
        <h3>{{ titleText }}</h3>
        <button type="button" class="modal-close" @click="close">×</button>
      </div>
      <div class="modal-body">
        <div v-if="converting" class="empty">正在预填来源信息…</div>
        <div v-else class="todo-form">
          <div class="field-row">
            <label class="field-label">待办名称 <em>*</em></label>
            <input v-model="draft.title" class="input" maxlength="200" placeholder="待办名称（必填）" />
          </div>
          <div class="field-row">
            <label class="field-label">紧急程度 <em>*</em></label>
            <div class="priority-group">
              <label v-for="p in PRIORITIES" :key="p.value" class="prio-item">
                <input v-model="draft.priority" type="radio" :value="p.value" />
                <span :class="['prio-tag', p.value]">{{ p.label }}</span>
              </label>
            </div>
          </div>
          <div class="field-row">
            <label class="field-label">结束时间 <em>*</em></label>
            <div class="due-group">
              <input v-model="draft.dueLocal" type="datetime-local" class="input" style="flex: 1" />
              <label class="all-day">
                <input v-model="draft.allDay" type="checkbox" />
                <span>全天</span>
              </label>
            </div>
          </div>
          <div class="field-row">
            <label class="field-label">标签</label>
            <input v-model="draft.tag" class="input" maxlength="50" placeholder="如：实验 / 写作 / 行政（选填）" />
          </div>
          <div class="field-row">
            <label class="field-label">提醒</label>
            <select v-model="draft.remind" class="select" style="width: 180px">
              <option value="none">不提醒</option>
              <option value="1h">提前 1 小时</option>
              <option value="1d">提前 1 天</option>
            </select>
          </div>
          <div class="field-row">
            <label class="field-label">备注</label>
            <textarea v-model="draft.note" class="input note-input" maxlength="5000" rows="4" placeholder="备注（选填，多行文本）"></textarea>
          </div>
          <div v-if="source" class="source-hint">
            来源：{{ sourceLabel }} #{{ sourceId }}（转换不会修改原记录）
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn" @click="close">取消</button>
        <button type="button" class="btn btn-primary" :disabled="saving" @click="saveNow">
          {{ saving ? '保存中…' : (source ? '转为待办' : (row ? '保存' : '创建')) }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { saveTodo, createTodoFromSource, checkTodoSource } from '../../api/todo'
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'

const props = defineProps({
  open: { type: Boolean, default: false },
  // 编辑模式：已有待办行（含 id）；新建/转换模式传 null
  row: { type: Object, default: null },
  // 转换模式：来源预填（sourceType/sourceId/title/dueTime/priority/note），传 null 为手动新建
  source: { type: Object, default: null },
  // 新建预填：日历点空白格新建时传 { dueLocal: 'YYYY-MM-DDTHH:mm' }，其余情况不传
  prefill: { type: Object, default: null }
})
const emit = defineEmits(['update:open', 'saved', 'goto'])

const PRIORITIES = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' }
]
const SOURCE_LABELS = { task: '任务', meeting: '组会', report: '周报', notice: '公告' }

const saving = ref(false)
const converting = ref(false)
const draft = ref({ title: '', priority: 'medium', dueLocal: '', allDay: false, tag: '', remind: 'none', note: '' })

const titleText = computed(() => {
  if (props.source) return '转为待办'
  return props.row ? '编辑待办' : '新建待办'
})
const sourceLabel = computed(() => (props.source ? (SOURCE_LABELS[props.source.sourceType] || props.source.sourceType) : ''))
const sourceId = computed(() => (props.source ? props.source.sourceId : ''))

// 服务端时间 'YYYY-MM-DD HH:mm:ss' → datetime-local 'YYYY-MM-DDTHH:mm'
function toLocal(v) {
  if (!v) return ''
  const m = String(v).match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/)
  return m ? `${m[1]}T${m[2]}` : String(v).slice(0, 16)
}
// 表单校验并转服务端时间 'YYYY-MM-DD HH:mm:ss'
function validate() {
  const title = String(draft.value.title || '').trim()
  if (!title) { dialogAlert('请输入待办名称'); return null }
  if (!draft.value.dueLocal) { dialogAlert('请选择结束时间'); return null }
  const dueTime = draft.value.dueLocal.replace('T', ' ') + ':00'
  return {
    title,
    priority: draft.value.priority,
    dueTime,
    allDay: draft.value.allDay,
    tag: draft.value.tag,
    remind: draft.value.remind,
    note: draft.value.note
  }
}

async function init() {
  saving.value = false
  converting.value = false
  draft.value = { title: '', priority: 'medium', dueLocal: '', allDay: false, tag: '', remind: 'none', note: '' }
  // 日历点空白格新建：预填结束时间
  if (!props.row && !props.source && props.prefill && props.prefill.dueLocal) {
    draft.value.dueLocal = props.prefill.dueLocal
  }
  if (props.row) {
    draft.value = {
      title: props.row.title || '',
      priority: props.row.priority || 'medium',
      dueLocal: toLocal(props.row.dueTime),
      allDay: !!props.row.allDay,
      tag: props.row.tag || '',
      remind: props.row.remind || 'none',
      note: props.row.note || ''
    }
    return
  }
  if (props.source) {
    converting.value = true
    try {
      // 后端判重：已转过则返回 { already, id, todo }，提示并跳转
      const res = await checkTodoSource(props.source.sourceType, props.source.sourceId)
      if (res && res.success && res.data && res.data.already) {
        dialogAlert('该来源已转为待办，正在跳转到已有待办…')
        emit('goto', res.data.id)
        emit('update:open', false)
        return
      }
    } catch (e) {
      // 判重接口异常时按未转过处理，创建时后端兜底
    } finally {
      converting.value = false
    }
    draft.value = {
      title: props.source.title || '',
      priority: props.source.priority || 'medium',
      dueLocal: toLocal(props.source.dueTime),
      allDay: !!props.source.allDay,
      tag: props.source.tag || '',
      remind: props.source.remind || 'none',
      note: props.source.note || ''
    }
  }
}

watch([() => props.open, () => props.row, () => props.source, () => props.prefill], () => { if (props.open) init() })

async function saveNow() {
  if (saving.value) return
  const payload = validate()
  if (!payload) return
  saving.value = true
  try {
    if (props.source) {
      const res = await createTodoFromSource({
        sourceType: props.source.sourceType,
        sourceId: props.source.sourceId,
        ...payload
      })
      if (res && res.success && res.data && res.data.already) {
        dialogAlert('该来源已转为待办，正在跳转到已有待办…')
        emit('goto', res.data.id)
        emit('update:open', false)
        return
      }
      if (res && res.success) {
        dialogAlert('已转为待办')
        emit('update:open', false)
        emit('saved')
        return
      }
      dialogAlert((res && res.message) || '转换失败')
      return
    }
    const res = await saveTodo({ id: props.row ? props.row.id : null, ...payload })
    if (res && res.success) {
      emit('update:open', false)
      emit('saved')
      return
    }
    dialogAlert((res && res.message) || '保存失败')
  } catch (e) {
    dialogAlert('保存失败：' + (e && e.message ? e.message : '请稍后重试'))
  } finally {
    saving.value = false
  }
}

async function close() {
  if (draft.value.title || draft.value.dueLocal || draft.value.note || draft.value.tag) {
    const ok = await dialogConfirm('待办尚未保存，确定放弃并关闭吗？', '未保存的待办')
    if (!ok) return
  }
  emit('update:open', false)
}
</script>

<style scoped>
.todo-edit-dialog { width: 560px; max-width: calc(92vw / var(--app-font-zoom, 1)); }
.todo-form { display: flex; flex-direction: column; gap: 14px; padding: 4px 0; }
.field-row { display: flex; align-items: flex-start; gap: 12px; }
.field-label { flex: 0 0 72px; padding-top: 8px; font-size: 13px; color: var(--text-2); }
.field-label em { color: var(--danger); font-style: normal; }
.field-row .input, .field-row .select { flex: 1; }
.note-input { min-height: 88px; resize: vertical; line-height: 1.6; }
.priority-group { display: flex; gap: 16px; padding-top: 8px; }
.prio-item { display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; }
.prio-tag { padding: 1px 10px; border-radius: 10px; font-size: 12px; }
.prio-tag.low { background: #ecfdf5; color: #16a34a; }
.prio-tag.medium { background: #fffbeb; color: #d97706; }
.prio-tag.high { background: #fef2f2; color: #dc2626; }
.due-group { display: flex; align-items: center; gap: 12px; flex: 1; }
.all-day { display: flex; align-items: center; gap: 4px; font-size: 13px; cursor: pointer; white-space: nowrap; }
.source-hint { padding: 8px 12px; border-radius: var(--radius-md); background: var(--primary-soft, #eff6ff); color: var(--text-2); font-size: 12px; }
</style>
