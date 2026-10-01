<template>
  <div v-if="visible" class="modal-mask" @click.self="close">
    <div class="modal sm">
      <div class="modal-head">
        <h3>{{ title }}</h3>
        <button type="button" class="modal-close" @click="close">×</button>
      </div>
      <div class="modal-body">
        <div v-for="f in fields" :key="f.key" class="d-row">
          <div class="d-label">{{ f.label }}</div>
          <div class="d-value">{{ displayValue(f) }}</div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" @click="close">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// 通用行详情弹窗：由页面传入一行数据 + 字段映射配置，纯只读展示，不含任何操作按钮。
// fields: [{ key, label, render? }]，render(value, row) 返回格式化后的展示文本；
// 空值统一显示 '-'；详情区 pre-wrap 展示，长文本（如公告全文）完整换行可见，
// 弹窗复用 .modal 的 max-height + 滚动容器，内容超长不会撑出屏幕。
const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '' },
  row: { type: Object, default: null },
  fields: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:visible'])

const displayValue = computed(() => (f) => {
  const v = props.row ? props.row[f.key] : undefined
  const text = f.render ? f.render(v, props.row) : v
  return text === undefined || text === null || text === '' ? '-' : String(text)
})

function close() {
  emit('update:visible', false)
}
</script>

<style scoped>
.d-row {
  display: flex;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #f0f1f3;
  font-size: 13px;
}
.d-row:last-child {
  border-bottom: none;
}
.d-label {
  flex-shrink: 0;
  width: 110px;
  color: #9aa1ac;
}
.d-value {
  flex: 1;
  min-width: 0;
  color: #1f2329;
  word-break: break-word;
  white-space: pre-wrap;
}
</style>
