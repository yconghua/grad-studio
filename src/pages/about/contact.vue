<template>
  <div class="page">
    <h2 class="page-title">关于平台 · 联系我们</h2>

    <!-- ===== 1. 联系方式卡片 ===== -->
    <section class="card">
      <h3 class="sec-title">联系方式</h3>
      <p class="sec-desc">
        遇到问题或有合作意向？欢迎通过以下方式联系我们。点击「复制」即可将联系方式复制到剪贴板。
      </p>
      <div class="contact-grid">
        <div v-for="c in contacts" :key="c.name" class="contact-item">
          <span class="c-icon">{{ c.icon }}</span>
          <div class="c-body">
            <h4 class="c-name">{{ c.name }}</h4>
            <p class="c-value">{{ c.value }}</p>
          </div>
          <button type="button" class="c-copy" @click="copy(c.value)">
            {{ copied === c.value ? '已复制 ✓' : '复制' }}
          </button>
        </div>
      </div>
    </section>

    <!-- ===== 2. 工作时间与响应时效 ===== -->
    <section class="card">
      <h3 class="sec-title">工作时间与响应时效</h3>
      <div class="info-grid">
        <div class="info-item">
          <h4 class="info-title">🕘 工作时间</h4>
          <p class="info-desc">周一至周五 9:00 – 18:00</p>
          <p class="info-sub">法定节假日休息</p>
        </div>
        <div class="info-item">
          <h4 class="info-title">⏱ 响应时效</h4>
          <p class="info-desc">一般问题 1–2 个工作日回复</p>
          <p class="info-sub">紧急问题请通过邮件或电话直接联系</p>
        </div>
        <div class="info-item">
          <h4 class="info-title">📮 建议渠道</h4>
          <p class="info-desc">功能建议 / 体验反馈走「意见反馈」页</p>
          <p class="info-sub">Bug 报告建议附带复现步骤</p>
        </div>
      </div>
    </section>

  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

// ===== 联系方式 =====
const contacts = [
  { name: '邮箱', icon: '📧', value: '1509054114@qq.com' },
  { name: '电话', icon: '📞', value: '198-0809-6020' },
  { name: '微信', icon: '💬', value: '19808096020' },
  { name: '地址', icon: '📍', value: '湖南省长沙市' }
]

const router = useRouter()
function go(path) {
  router.push(path)
}

// ===== 复制到剪贴板 =====
const copied = ref('')
async function copy(text) {
  let ok = false
  try {
    await navigator.clipboard.writeText(text)
    ok = true
  } catch {
    // 剪贴板 API 不可用时降级为 execCommand
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      ok = document.execCommand('copy')
      document.body.removeChild(ta)
    } catch {
      ok = false
    }
  }
  if (ok) {
    copied.value = text
    setTimeout(() => {
      copied.value = ''
    }, 1600)
  }
}
</script>

<style scoped>
/* ===== 页面骨架 ===== */
.page {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.page-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 16px;
  color: #1d2129;
}
.card {
  background: #fff;
  border-radius: 12px;
  padding: 22px 26px;
  border: 1px solid #f0f2f5;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
}
.sec-title {
  position: relative;
  margin: 0 0 14px;
  padding-left: 12px;
  font-size: 16px;
  font-weight: 700;
  color: #1d2129;
}
.sec-title::before {
  content: '';
  position: absolute;
  left: 0;
  top: 2px;
  bottom: 2px;
  width: 4px;
  border-radius: 2px;
  background: #0d80e0;
}
.sec-desc {
  margin: 0 0 16px;
  font-size: 14px;
  line-height: 1.9;
  color: #4e5969;
}
code {
  font-family: 'JetBrains Mono', Consolas, Menlo, 'Courier New', monospace;
  font-size: 12.5px;
  color: #0d80e0;
  background: #f0f7ff;
  border: 1px solid #d9ebff;
  border-radius: 4px;
  padding: 1px 6px;
}

/* ===== 1. 联系方式卡片 ===== */
.contact-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 14px;
}
.contact-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  border: 1px solid #e8eef5;
  border-radius: 10px;
  padding: 16px;
  background: #fbfdff;
}
.c-icon {
  font-size: 26px;
  line-height: 1;
}
.c-name {
  margin: 0;
  font-size: 13.5px;
  font-weight: 700;
  color: #0d47a1;
}
.c-value {
  margin: 0;
  font-size: 13.5px;
  color: #1d2129;
  word-break: break-all;
  line-height: 1.5;
}
.c-copy {
  margin-top: auto;
  border: 1px solid #d9ebff;
  border-radius: 6px;
  background: #f0f7ff;
  color: #0d47a1;
  font-size: 12.5px;
  font-weight: 600;
  padding: 5px 14px;
  cursor: pointer;
  transition: all 0.2s;
}
.c-copy:hover {
  background: #0d80e0;
  border-color: #0d80e0;
  color: #fff;
}
.c-copy:active {
  transform: scale(0.96);
}

/* ===== 2. 工作时间与时效 ===== */
.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.info-item {
  border: 1px solid #e8eef5;
  border-radius: 10px;
  padding: 16px;
  background: #fbfdff;
}
.info-title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 700;
  color: #0d47a1;
}
.info-desc {
  margin: 0 0 4px;
  font-size: 13.5px;
  line-height: 1.7;
  color: #1d2129;
}
.info-sub {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.6;
  color: #8a9099;
}

/* ===== 响应式 ===== */
@media (max-width: 860px) {
  .contact-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 720px) {
  .card {
    padding: 18px 16px;
  }
  .contact-grid {
    grid-template-columns: 1fr;
  }
  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
