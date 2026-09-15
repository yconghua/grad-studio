<template>
  <div class="hp">
    <!-- ===== 1. 顶部欢迎横幅 ===== -->
    <section class="hp-hero">
      <div class="hp-hero-inner">
        <h1 class="hp-greeting">{{ greeting }} 👋</h1>
        <p class="hp-date">{{ todayText }}</p>
      </div>
    </section>

    <!-- ===== 2. 系统简介 ===== -->
    <section class="hp-intro">
      <div class="hp-intro-icon">🧬</div>
      <div class="hp-intro-body">
        <h3 class="hp-intro-title">科研计算平台 · 系统</h3>
        <p class="hp-intro-desc">
          本平台专为科研工作者设计，。。。。。。。。。。。。。。。还在开发中
        </p>
      </div>
    </section>

    <!-- ===== 3. 公告栏 ===== -->
    <section class="hp-card">
      <div class="hp-card-header">
        <span class="hp-card-title">📢 平台公告</span>
        <a class="hp-card-more">更多</a>
      </div>
      <div class="hp-notice">
          <div class="hp-notice-item">
            <span class="hp-notice-tag warning">⚠️ 维护</span>
            <span class="hp-notice-text">测试公告。。。。。本周日凌晨 2:00 进行系统环境升级</span>
            <span class="hp-notice-time">2小时前</span>
          </div>
      </div>
    </section>

    <!-- ===== 4. 开发中提示 ===== -->
    <section class="hp-dev">
      <div class="hp-dev-icon">🔬</div>
      <h2 class="hp-dev-title">更多业务功能正在开发中</h2>
      <p class="hp-dev-desc">数据看板、可视化分析、模型对比工具等模块即将上线，敬请期待。</p>
      <div class="hp-dev-progress">
        <div class="hp-dev-bar">
          <div class="hp-dev-fill" style="width: 48%"></div>
        </div>
        <span class="hp-dev-percent">48%</span>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const greeting = ref('')  // 按小时段变化的问候语（如「早上好」「下午好」）
const todayText = ref('') // 今天日期 + 星期文案（如「2026年9月1日 星期二」）
// 星期中文名：new Date().getDay() 的索引（0=星期日 … 6=星期六）
const WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
// 构建顶部欢迎横幅：根据当前时间生成问候语与日期文案
function buildHero() {
  const d = new Date()
  const h = d.getHours()
  greeting.value = h < 6 ? '夜深了' : h < 9 ? '早上好' : h < 12 ? '上午好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好'
  todayText.value = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${WEEK[d.getDay()]}`
}

onMounted(() => {
  buildHero()
})
</script>

<style scoped>
.hp {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 4px 0 12px;
}

/* ===== 1. 顶部欢迎横幅 ===== */
.hp-hero {
  border-radius: 16px;
  background: linear-gradient(135deg, #1a237e 0%, #0d47a1 100%);
  padding: 32px 36px;
  box-shadow: 0 8px 28px rgba(13, 71, 161, 0.25);
  position: relative;
  overflow: hidden;
}
.hp-hero::after {
  content: '⚛️';
  position: absolute;
  right: -10px;
  bottom: -40px;
  font-size: 200px;
  opacity: 0.06;
  transform: rotate(10deg);
}
.hp-hero-inner {
  position: relative;
  z-index: 1;
}
.hp-greeting {
  margin: 0;
  font-size: 30px;
  font-weight: 700;
  color: #fff;
}
.hp-date {
  margin: 8px 0 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
}

/* ===== 2. 系统简介 ===== */
.hp-intro {
  display: flex;
  gap: 16px;
  background: #f0f7ff;
  border: 1px solid #d6e8ff;
  border-radius: 12px;
  padding: 18px 24px;
  align-items: flex-start;
}
.hp-intro-icon {
  font-size: 34px;
  line-height: 1;
  flex-shrink: 0;
  margin-top: 2px;
}
.hp-intro-body {
  flex: 1;
}
.hp-intro-title {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 700;
  color: #0d47a1;
}
.hp-intro-desc {
  margin: 0;
  font-size: 14px;
  color: #37474f;
  line-height: 1.8;
}

/* ===== 3. 公告栏 ===== */
.hp-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  border: 1px solid #f0f2f5;
}
.hp-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}
.hp-card-title {
  font-size: 16px;
  font-weight: 600;
  color: #1d2129;
}
.hp-card-more {
  font-size: 13px;
  color: #8a9099;
  text-decoration: none;
}
.hp-card-more:hover {
  color: #0d47a1;
}
.hp-notice {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hp-notice-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #f5f6f8;
}
.hp-notice-item:last-child {
  border-bottom: none;
}
.hp-notice-tag {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 12px;
  border-radius: 20px;
  flex-shrink: 0;
  color: #fff;
}
.hp-notice-tag.warning {
  background: #ffa726;
}
.hp-notice-tag.info {
  background: #42a5f5;
}
.hp-notice-tag.success {
  background: #66bb6a;
}
.hp-notice-text {
  flex: 1;
  font-size: 14px;
  color: #1d2129;
}
.hp-notice-time {
  font-size: 12px;
  color: #b0b8c0;
  flex-shrink: 0;
}

/* ===== 4. 开发中提示 ===== */
.hp-dev {
  background: #fafbfc;
  border: 2px dashed #d0d5dd;
  border-radius: 16px;
  padding: 48px 32px;
  text-align: center;
}
.hp-dev-icon {
  font-size: 48px;
  margin-bottom: 12px;
}
.hp-dev-title {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 700;
  color: #1d2129;
}
.hp-dev-desc {
  margin: 0 0 20px;
  font-size: 14px;
  color: #8a9099;
}
.hp-dev-progress {
  display: flex;
  align-items: center;
  gap: 14px;
  max-width: 360px;
  margin: 0 auto;
}
.hp-dev-bar {
  flex: 1;
  height: 6px;
  background: #e8eaed;
  border-radius: 4px;
  overflow: hidden;
}
.hp-dev-fill {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, #0d47a1, #42a5f5);
  transition: width 0.6s ease;
}
.hp-dev-percent {
  font-size: 14px;
  font-weight: 600;
  color: #0d47a1;
  flex-shrink: 0;
}

/* ===== 响应式 ===== */
@media (max-width: 640px) {
  .hp-hero {
    padding: 24px 20px;
  }
  .hp-greeting {
    font-size: 24px;
  }
  .hp-intro {
    flex-direction: column;
    gap: 8px;
    padding: 16px 18px;
  }
  .hp-intro-icon {
    font-size: 28px;
  }
  .hp-card {
    padding: 16px 18px;
  }
  .hp-notice-item {
    flex-wrap: wrap;
    gap: 6px 10px;
  }
  .hp-notice-time {
    margin-left: auto;
  }
  .hp-dev {
    padding: 32px 20px;
  }
  .hp-dev-title {
    font-size: 18px;
  }
}
</style>