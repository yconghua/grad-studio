<template>
  <!-- 公告内容 Markdown 渲染：marked 转 HTML → DOMPurify 白名单过滤 → v-html -->
  <!-- 仅渲染排版白名单内的标签，链接强制新窗口打开；解析失败降级纯文本展示 -->
  <div class="notice-content" v-html="html"></div>
</template>

<script setup>
import { computed } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const props = defineProps({
  content: { type: String, default: '' }
})

// 链接安全：一律新窗口打开 + rel 加固（防 target=_blank 反向钓鱼）
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

const html = computed(() => {
  const raw = (props && props.content) || ''
  if (!raw) return ''
  try {
    const md = marked.parse(raw, { async: false, gfm: true, breaks: true })
    return DOMPurify.sanitize(md, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'h1', 'h2', 'h3', 'h4', 'hr'],
      ALLOWED_ATTR: ['href', 'title']
    })
  } catch (e) {
    // Markdown 解析失败：按纯文本安全展示，不白屏
    return DOMPurify.sanitize(raw)
  }
})
</script>

<style scoped>
.notice-content {
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-2-strong);
  word-break: break-word;
}
.notice-content :deep(p) {
  margin: 6px 0;
}
.notice-content :deep(h1),
.notice-content :deep(h2),
.notice-content :deep(h3),
.notice-content :deep(h4) {
  margin: 12px 0 6px;
  color: var(--text);
}
.notice-content :deep(ul),
.notice-content :deep(ol) {
  margin: 6px 0;
  padding-left: 22px;
}
.notice-content :deep(blockquote) {
  margin: 8px 0;
  padding: 2px 12px;
  border-left: 3px solid var(--border-strong);
  color: var(--text-3);
}
.notice-content :deep(code) {
  background: var(--bg-hover);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 13px;
}
.notice-content :deep(pre) {
  background: var(--bg-hover);
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  overflow: auto;
  font-size: 13px;
}
.notice-content :deep(pre code) {
  background: none;
  padding: 0;
}
.notice-content :deep(a) {
  color: var(--primary);
}
</style>
