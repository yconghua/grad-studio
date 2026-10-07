<template>
  <div class="ac-timeline">
    <div v-for="(n, idx) in nodes" :key="n.nodeKey" class="ac-node" :class="{ 'ac-node--done': n.record && n.record.happenDate }">
      <div class="ac-node__rail">
        <span class="ac-node__dot" :class="dotClass(n)">{{ idx + 1 }}</span>
        <span v-if="idx < nodes.length - 1" class="ac-node__line" :class="{ 'ac-node__line--done': n.record && n.record.happenDate }"></span>
      </div>
      <div class="ac-node__body">
        <div class="ac-node__head">
          <span class="ac-node__name">
            {{ n.nodeName }}
            <i v-if="n.required" class="ac-node__required" title="必填">*</i>
          </span>
          <span v-if="n.planDate" class="ac-node__plan">计划：{{ n.planDate }}</span>
          <span class="ac-node__tag" :class="tagClass(n)">{{ tagText(n) }}</span>
          <div class="ac-node__actions">
            <slot name="actions" :node="n" :idx="idx"></slot>
          </div>
        </div>
        <div v-if="n.record && n.record.happenDate" class="ac-node__detail">
          <div class="ac-node__meta">
            <span v-if="n.record.happenDate">发生：{{ n.record.happenDate }}</span>
            <span v-if="n.record.endDate">结束：{{ n.record.endDate }}</span>
            <span v-if="n.record.createdBy">记录人：{{ n.record.createdByName || '本人' }}</span>
          </div>
          <div v-if="n.record.content" class="ac-node__content">{{ n.record.content }}</div>
          <div v-if="n.record.rejectReason" class="ac-node__reject">退回意见：{{ n.record.rejectReason }}</div>
        </div>
        <div v-else class="ac-node__empty">尚未记录{{ n.required ? '（必填）' : '（选填）' }}</div>
      </div>
    </div>
    <div v-if="!nodes || nodes.length === 0" class="ac-empty">该培养类型暂无阶段节点</div>
  </div>
</template>

<script setup>
// 学业档案时间线（只读渲染组件）：节点状态标签 + 已填内容展示
// 操作按钮由父页面通过 #actions slot 提供（学生=编辑/提交，导师=确认/退回，管理端=只读）
import { computed } from 'vue'

const props = defineProps({
  nodes: { type: Array, default: () => [] }
})

const STATUS_TEXT = { pending: '待填写', submitted: '待确认', confirmed: '已确认' }
const STATUS_CLASS = { pending: 'tag-pending', submitted: 'tag-submitted', confirmed: 'tag-confirmed' }

function dotClass(n) {
  if (n.record && n.record.status === 'confirmed') return 'dot-confirmed'
  if (n.record && n.record.status === 'submitted') return 'dot-submitted'
  if (n.record && n.record.happenDate) return 'dot-done'
  return 'dot-pending'
}
function tagText(n) {
  if (!n.record) return '待填写'
  return STATUS_TEXT[n.record.status] || '待填写'
}
function tagClass(n) {
  if (!n.record) return 'tag-pending'
  return STATUS_CLASS[n.record.status] || 'tag-pending'
}
</script>

<style scoped>
.ac-timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.ac-node {
  display: flex;
  gap: 12px;
}
.ac-node__rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 24px;
  flex-shrink: 0;
}
.ac-node__dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #fff;
  background: var(--text-3, #9aa0aa);
  flex-shrink: 0;
  z-index: 1;
}
.ac-node__dot.dot-confirmed { background: #16a34a; }
.ac-node__dot.dot-submitted { background: #2563eb; }
.ac-node__dot.dot-done { background: #0891b2; }
.ac-node__dot.dot-pending { background: var(--text-3, #9aa0aa); }
.ac-node__line {
  width: 2px;
  flex: 1;
  min-height: 16px;
  background: var(--line, #e5e7eb);
}
.ac-node__line--done { background: #16a34a; }
.ac-node__body {
  flex: 1;
  padding-bottom: 16px;
  min-width: 0;
}
.ac-node__head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  min-height: 30px;
}
.ac-node__name {
  font-size: 15px;
  font-weight: 600;
}
.ac-node__required { color: #ef4444; font-style: normal; }
.ac-node__plan { font-size: 12px; color: var(--text-2, #6b7280); }
.ac-node__tag {
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 10px;
}
.tag-pending { background: #f3f4f6; color: #6b7280; }
.tag-submitted { background: #eff6ff; color: #2563eb; }
.tag-confirmed { background: #ecfdf5; color: #16a34a; }
.ac-node__actions { margin-left: auto; display: flex; gap: 6px; flex-wrap: wrap; }
.ac-node__detail {
  margin-top: 6px;
  background: var(--bg-2, #f9fafb);
  border: 1px solid var(--line, #e5e7eb);
  border-radius: 8px;
  padding: 10px 12px;
}
.ac-node__meta {
  display: flex;
  gap: 14px;
  font-size: 12px;
  color: var(--text-2, #6b7280);
  flex-wrap: wrap;
}
.ac-node__content {
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-1, #111827);
  white-space: pre-wrap;
  word-break: break-word;
}
.ac-node__reject {
  margin-top: 6px;
  font-size: 12px;
  color: #dc2626;
  background: #fef2f2;
  border-radius: 6px;
  padding: 4px 8px;
}
.ac-node__empty {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-3, #9aa0aa);
}
.ac-empty {
  text-align: center;
  color: var(--text-3, #9aa0aa);
  padding: 30px 0;
}
</style>
