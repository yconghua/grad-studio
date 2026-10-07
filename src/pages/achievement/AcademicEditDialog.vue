<template>
  <div v-if="visible" class="modal-mask" @click.self="close">
    <div class="modal" style="width: 520px">
      <div class="modal-head">
        <h3>{{ title }}</h3>
        <button class="modal-close" @click="close">×</button>
      </div>
      <div class="modal-body">
        <div class="ac-node-info">
          <span v-if="props.node && props.node.planDate">计划时间：{{ props.node.planDate }}</span>
          <span v-if="props.node && props.node.required" class="ac-node-info__required">必填</span>
          <span v-else-if="props.node" class="ac-node-info__optional">选填</span>
        </div>
        <div class="form">
          <div class="form-row">
            <label class="form-label">发生时间</label>
            <input v-model="happenDate" type="date" class="input" />
          </div>
          <div class="form-row">
            <label class="form-label">结束时间</label>
            <input v-model="endDate" type="date" class="input" />
            <span class="form-tip">跨时段节点（如课程学习）填结束时间，可留空</span>
          </div>
          <div class="form-row">
            <label class="form-label">内容</label>
            <textarea v-model="content" class="textarea" rows="5" placeholder="开题内容 / 论文题目 / 完成情况等"></textarea>
          </div>
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
import { ref, watch, computed } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  node: { type: Object, default: null }
})
const emit = defineEmits(['update:visible', 'save'])

// 弹窗标题：已有记录为「修改」，否则「填写」
const title = computed(() => {
  const name = (props.node && props.node.nodeName) || ''
  return (props.node && props.node.record) ? `修改：${name}` : `填写：${name}`
})

const happenDate = ref('')
const endDate = ref('')
const content = ref('')
const saving = ref(false)

watch(
  () => props.visible,
  (v) => {
    if (v) {
      const rec = props.node && props.node.record
      happenDate.value = (rec && rec.happenDate) || ''
      endDate.value = (rec && rec.endDate) || ''
      content.value = (rec && rec.content) || ''
    }
  }
)

function close() {
  emit('update:visible', false)
}
async function save() {
  saving.value = true
  try {
    emit('save', {
      nodeKey: props.node && props.node.nodeKey,
      happenDate: happenDate.value || null,
      endDate: endDate.value || null,
      content: content.value
    })
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.form-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 6px 12px;
  padding: 8px 0;
}
.form-label {
  width: 80px;
  flex-shrink: 0;
  font-size: 14px;
  color: var(--text-2, #6b7280);
  line-height: 34px;
}
.textarea {
  flex: 1;
  min-width: 0;
  min-height: 120px;
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
.ac-node-info {
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 13px;
  color: var(--text-2, #6b7280);
  background: var(--bg-2, #f9fafb);
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 14px;
}
.ac-node-info__required { color: #ef4444; font-weight: 600; }
.ac-node-info__optional { color: var(--text-3, #9aa0aa); }
.form-tip {
  flex: 1 1 100%;
  padding-left: 92px;
  font-size: 12px;
  color: var(--text-3, #9aa0aa);
  line-height: 18px;
}
</style>
