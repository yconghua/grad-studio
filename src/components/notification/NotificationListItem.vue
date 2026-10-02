<template>
  <div
    class="notification-item"
    :class="{ unread: !item.isRead }"
    @click="$emit('open', item)"
  >
    <span class="item-icon">{{ iconText }}</span>
    <div class="item-body">
      <div class="item-title-row">
        <span class="item-title">{{ item.title }}</span>
        <span v-if="!item.isRead" class="item-dot" title="未读"></span>
      </div>
      <div class="item-summary">{{ item.summary }}</div>
      <div class="item-meta">
        <span class="item-type">{{ typeName }}</span>
        <span class="item-time">{{ item.createdAt }}</span>
      </div>
    </div>
    <button
      class="item-delete"
      type="button"
      title="删除"
      @click.stop="$emit('remove', item)"
    >删除</button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// 单条通知：未读高亮 + 类型图标/名称（来自类型注册表）+ 点击跳转 + 删除
const props = defineProps({
  item: { type: Object, required: true },
  typeInfo: { type: Object, default: null }
})

defineEmits(['open', 'remove'])

// 类型图标/中文名：注册表 icon_key/type_key 均为英文标识，渲染时映射为中文图标与名称，
// 避免把英文标识直接显示到界面；未知类型回退默认图标/「通知」
const TYPE_ICON = { notice: '📢', meeting: '📅' }
const TYPE_LABEL = { notice: '公告', meeting: '组会' }
const iconText = computed(() => {
  const key = (props.typeInfo && props.typeInfo.iconKey) || props.item.typeKey
  return TYPE_ICON[key] || '🔔'
})
const typeName = computed(() => {
  if (props.typeInfo && props.typeInfo.displayName) return props.typeInfo.displayName
  return TYPE_LABEL[props.item.typeKey] || props.item.typeKey || '通知'
})
</script>

<style scoped>
.notification-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: box-shadow 0.15s, background 0.15s;
}
.notification-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.notification-item.unread {
  background: #f5f8ff;
  border-color: #c7d4ff;
}
.item-icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: #eef2ff;
  color: #4f6ef7;
  font-size: 18px;
  line-height: 36px;
  text-align: center;
}
.item-body {
  flex: 1;
  min-width: 0;
}
.item-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.item-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}
.item-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
}
.item-summary {
  margin-top: 4px;
  font-size: 13px;
  color: #6b7280;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.item-meta {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: #9ca3af;
}
.item-type {
  padding: 1px 8px;
  border-radius: 4px;
  background: #f3f4f6;
  color: #6b7280;
}
.item-delete {
  flex-shrink: 0;
  padding: 4px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
  color: #9ca3af;
  font-size: 12px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.item-delete:hover {
  color: #ef4444;
  border-color: #ef4444;
}
</style>
