<template>
  <div class="nf">
    <div class="nf-card">
      <div class="nf-code">404</div>
      <h1 class="nf-title">页面不存在</h1>
      <p class="nf-desc">您访问的页面不存在或已被移除，请检查地址后重试。</p>
      <button class="nf-btn" @click="goHome">返回首页</button>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()
// 返回首页：/ 会自动重定向到默认首页（/home）
function goHome() {
  router.push('/')
}
</script>

<style scoped>
/* 独立 404 页：整体铺满视口居中，不依赖主布局（浅色主题） */
.nf {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  padding: 24px;
  box-sizing: border-box;
}
.nf-card {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
  padding: 48px 56px;
  text-align: center;
  max-width: 480px;
  width: 100%;
}
.nf-code {
  font-size: 72px;
  font-weight: 700;
  line-height: 1;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  margin-bottom: 16px;
}
.nf-title {
  margin: 0 0 10px;
  font-size: 20px;
  font-weight: 700;
  color: #1d2129;
}
.nf-desc {
  margin: 0 0 28px;
  font-size: 14px;
  color: #8a9099;
  line-height: 1.7;
}
.nf-btn {
  height: 42px;
  padding: 0 32px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 2px;
  cursor: pointer;
  transition: opacity 0.2s;
}
.nf-btn:hover {
  opacity: 0.92;
}
</style>
