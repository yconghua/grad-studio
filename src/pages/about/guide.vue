<template>
  <div class="page">
    <h2 class="page-title">关于平台 · 使用指南</h2>

    <!-- ===== 1. 快速上手横幅 ===== -->
    <section class="hero">
      <div class="hero-inner">
        <h3 class="hero-title">快速上手</h3>
        <p class="hero-desc">
          本平台是<strong>开箱即用的本地化桌面数据管理平台</strong>：无需单独部署服务器，
          下载源码、安装依赖、连接数据库即可开始使用。以下是运行本平台所需的环境与前置条件。
        </p>
        <ul class="env-chips">
          <li class="env-chip">Node.js 18 及以上</li>
          <li class="env-chip">MySQL 5.7 / 8.0</li>
          <li class="env-chip">Windows / macOS / Linux</li>
          <li class="env-chip">npm 国内镜像加速</li>
        </ul>
      </div>
    </section>

    <!-- ===== 2. 快速开始四步 ===== -->
    <section class="card">
      <h3 class="sec-title">快速开始</h3>
      <p class="sec-desc">从拿到源码到跑起第一个页面，只需四步：</p>
      <div class="steps">
        <div class="step">
          <div class="step-num">1</div>
          <div class="step-body">
            <h4 class="step-title">安装依赖</h4>
            <p class="step-desc">在项目根目录执行 <code>npm install</code>，安装运行所需的全部依赖包。</p>
            <p class="step-tip">国内网络可在用户级 <code>.npmrc</code> 配置 npmmirror 镜像，显著加快下载速度。</p>
          </div>
        </div>
        <div class="step">
          <div class="step-num">2</div>
          <div class="step-body">
            <h4 class="step-title">启动开发环境</h4>
            <p class="step-desc">执行 <code>npm run dev</code>，Vite 会自动拉起 Electron 窗口，进入登录页面。</p>
            <p class="step-tip">首次启动请保持终端开启；修改前端代码会热更新，修改主进程代码需重启。</p>
          </div>
        </div>
        <div class="step">
          <div class="step-num">3</div>
          <div class="step-body">
            <h4 class="step-title">添加数据库连接</h4>
            <p class="step-desc">在登录页点击「添加数据库」，填写主机、端口、库名、账号与密码后保存。</p>
            <p class="step-tip">首个连接会自动生效，并自动执行 <code>schemas</code> 脚本完成建库建表，无需手动初始化。</p>
          </div>
        </div>
        <div class="step">
          <div class="step-num">4</div>
          <div class="step-body">
            <h4 class="step-title">打包发布</h4>
            <p class="step-desc">执行 <code>npm run pack</code> 即可产出可执行安装包，产物位于 <code>release/</code> 目录。</p>
            <p class="step-tip">Windows 下建议使用管理员权限的终端打包；推送到 main 分支的版本更新会自动触发 CI 发版。</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ===== 3. 每日使用要点 ===== -->
    <section class="card">
      <h3 class="sec-title">每日使用要点</h3>
      <div class="tips-grid">
        <div class="tip-item">
          <h4 class="tip-title">登录与会话</h4>
          <p class="tip-desc">使用账号密码登录，会话有效期固定为 24 小时，到期后需重新登录。</p>
        </div>
        <div class="tip-item">
          <h4 class="tip-title">导航与页面</h4>
          <p class="tip-desc">左侧导航由 <code>navConfig.js</code> 单一数据源驱动，顶部项、分组与子项均可自由增减。</p>
        </div>
        <div class="tip-item">
          <h4 class="tip-title">连接切换</h4>
          <p class="tip-desc">配置多个数据库连接后，支持在运行时切换，无需重启应用。</p>
        </div>
        <div class="tip-item">
          <h4 class="tip-title">系统管理</h4>
          <p class="tip-desc">个人主页 → 系统管理页签：查看运行状态、清理缓存、导出数据库备份 SQL。</p>
        </div>
      </div>
    </section>

    <!-- ===== 4. 常见问题 FAQ ===== -->
    <section class="card">
      <h3 class="sec-title">常见问题</h3>
      <div class="faq-list">
        <div class="faq-item" v-for="(item, i) in faqs" :key="i">
          <button
            class="faq-q"
            :class="{ active: activeFaq === i }"
            @click="toggleFaq(i)"
          >
            <span class="faq-q-icon">{{ activeFaq === i ? '−' : '+' }}</span>
            <span class="faq-q-text">{{ item.q }}</span>
          </button>
          <div class="faq-a" v-show="activeFaq === i">
            <p v-for="(line, j) in item.a" :key="j">{{ line }}</p>
          </div>
        </div>
      </div>
    </section>

  </div>
</template>

<script setup>
import { ref } from 'vue'

// FAQ 数据：q 为问题，a 为答案段落数组
const faqs = [
  {
    q: '忘记密码怎么办？',
    a: [
      '当前版本未内置自助找回密码通道。请联系管理员，在「个人主页 → 用户管理」中为该账号重置密码。'
    ]
  },
  {
    q: '如何添加或切换数据库连接？',
    a: [
      '在登录页点击「添加数据库」，填写主机、端口、库名、账号与密码即可新增连接，首个连接自动生效。',
      '配置多个连接后，可在运行时切换当前使用的连接，无需重启应用。'
    ]
  },
  {
    q: '新增一个业务模块需要改哪里？',
    a: [
      '沿「8 处扩展链路」补齐即可：schemas/*.sql → repository → service → ipc → preload → api → pages → navConfig。',
      '详见「系统介绍」页的扩展机制说明。'
    ]
  },
  {
    q: '如何打包成可执行文件？',
    a: [
      '在项目根目录执行 npm run pack，打包产物位于 release/ 目录。',
      'Windows 下建议使用管理员权限的终端执行；推送 main 分支的新版本号会自动触发 CI 打包并发布 Release。'
    ]
  },
  {
    q: '业务数据保存在哪里？',
    a: [
      '业务数据存储在 MySQL 数据库中；数据库连接信息保存在用户数据目录下的配置文件中。',
      '注意：连接信息文件包含明文凭据，请勿将其随源码一起分发给他人。'
    ]
  }
]

const activeFaq = ref(-1)
function toggleFaq(i) {
  activeFaq.value = activeFaq.value === i ? -1 : i
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

/* ===== 标题层级 ===== */
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
  word-break: break-all;
}

/* ===== 1. 快速上手横幅 ===== */
.hero {
  border-radius: 16px;
  background: linear-gradient(135deg, #1a237e 0%, #0d47a1 100%);
  padding: 28px 32px;
  box-shadow: 0 8px 28px rgba(13, 71, 161, 0.22);
  position: relative;
  overflow: hidden;
}
.hero::after {
  content: '🚀';
  position: absolute;
  right: -6px;
  bottom: -44px;
  font-size: 190px;
  opacity: 0.07;
  transform: rotate(-8deg);
}
.hero-inner {
  position: relative;
  z-index: 1;
}
.hero-title {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 700;
  color: #fff;
}
.hero-desc {
  margin: 0 0 18px;
  font-size: 14px;
  line-height: 1.9;
  color: rgba(255, 255, 255, 0.88);
  max-width: 640px;
}
.hero-desc strong {
  color: #fff;
}
.env-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.env-chip {
  font-size: 13px;
  color: #e3f2ff;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 20px;
  padding: 5px 14px;
}

/* ===== 2. 快速开始四步 ===== */
.steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.step {
  display: flex;
  gap: 14px;
  border: 1px solid #e8eef5;
  border-radius: 10px;
  padding: 14px 16px;
  background: #fbfdff;
}
.step-num {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #0d80e0;
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.step-body {
  flex: 1;
  min-width: 0;
}
.step-title {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 700;
  color: #0d47a1;
}
.step-desc {
  margin: 0 0 4px;
  font-size: 13.5px;
  line-height: 1.8;
  color: #4e5969;
}
.step-tip {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.7;
  color: #8a9099;
}

/* ===== 3. 每日使用要点 ===== */
.tips-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.tip-item {
  border: 1px solid #e8eef5;
  border-radius: 10px;
  padding: 14px 16px;
  background: #fbfdff;
}
.tip-title {
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 700;
  color: #0d47a1;
}
.tip-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.8;
  color: #4e5969;
}

/* ===== 4. 常见问题 FAQ ===== */
.faq-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.faq-item {
  border: 1px solid #eef1f5;
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
}
.faq-q {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 16px;
  border: none;
  background: none;
  cursor: pointer;
  text-align: left;
  font-size: 14px;
  color: #1d2129;
  font-weight: 600;
}
.faq-q:hover {
  background: #f8fafc;
}
.faq-q.active {
  background: #f0f7ff;
}
.faq-q-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #0d80e0;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  line-height: 20px;
  text-align: center;
}
.faq-a {
  padding: 0 16px 14px 46px;
}
.faq-a p {
  margin: 0 0 8px;
  font-size: 13.5px;
  line-height: 1.8;
  color: #4e5969;
}
.faq-a p:last-child {
  margin-bottom: 0;
}

/* ===== 响应式 ===== */
@media (max-width: 720px) {
  .card {
    padding: 18px 16px;
  }
  .hero {
    padding: 22px 20px;
  }
  .hero-title {
    font-size: 19px;
  }
  .tips-grid {
    grid-template-columns: 1fr;
  }
  .faq-a {
    padding-left: 20px;
  }
}
</style>
