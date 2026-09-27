<template>
  <div class="page-placeholder">
    <div class="ph-card">
      <div class="ph-icon">{{ icon }}</div>
      <h2 class="ph-title">{{ title }}</h2>
      <p class="ph-desc">{{ desc }}</p>
      <span class="ph-tag">功能建设中 · 骨架已就绪</span>
    </div>
  </div>
</template>

<script setup>
// 通用页面占位组件：业务页面骨架阶段统一引用，
// 后续接入真实页面时逐个替换为具体实现。
defineProps({
  title: { type: String, default: '页面' },
  desc: { type: String, default: '该模块将在数据库字段与前后端接口设计完成后实现。' },
  icon: { type: String, default: '📄' }
})
</script>

<style scoped>
.page-placeholder {
  height: 100%;
  min-height: 420px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ph-card {
  text-align: center;
  padding: 48px 72px;
  background: #fff;
  border: 1px dashed #d5dbe3;
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
}
.ph-icon { font-size: 44px; line-height: 1; }
.ph-title { margin: 16px 0 8px; font-size: 20px; color: #1f2329; }
.ph-desc { margin: 0 0 16px; font-size: 13px; color: #8a9099; max-width: 420px; line-height: 1.7; }
.ph-tag {
  display: inline-block;
  padding: 4px 14px;
  border-radius: 999px;
  font-size: 12px;
  color: #0d80e0;
  background: #eef6ff;
}
</style>
