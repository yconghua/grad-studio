<template>
  <div class="page">
    <h2 class="page-title">关于平台</h2>
    <p class="page-desc">平台介绍、使用帮助与技术支持，欢迎浏览了解。</p>

    <!-- ===== 1. 平台定位横幅 ===== -->
    <section class="hero">
      <div class="hero-glow" aria-hidden="true">🌿</div>
      <div class="hero-inner">
        <div class="hero-tag">GRA STUDIO</div>
        <h3 class="hero-title">开箱即用的本地化桌面数据管理平台</h3>
        <p class="hero-desc">
          主进程即后端，无需单独部署服务器；数据驱动导航，业务模块按标准链路随需扩展。
          一套通用能力 + 一条扩展链路，即可快速搭建属于你自己的管理平台。
        </p>
        <div class="hero-meta">
          <span class="version-badge" v-if="sysInfo">v{{ sysInfo.version }}</span>
          <span class="version-badge" v-else>开发环境</span>
          <span class="env-chip" v-for="tag in heroTags" :key="tag">{{ tag }}</span>
        </div>
      </div>
    </section>

    <!-- ===== 2. 平台概览统计 ===== -->
    <section class="stats-grid">
      <div class="stat-item" v-for="s in stats" :key="s.label">
        <span class="stat-icon">{{ s.icon }}</span>
        <div class="stat-body">
          <span class="stat-num">{{ s.value }}</span>
          <span class="stat-label">{{ s.label }}</span>
        </div>
      </div>
    </section>

    <!-- ===== 3. 快捷入口 ===== -->
    <section class="card">
      <div class="sec-head">
        <h3 class="sec-title">快捷入口</h3>
        <span class="sec-sub">关于平台的四个功能页，点击直达</span>
      </div>
      <div class="card-grid">
        <RouterLink
          v-for="child in aboutChildren"
          :key="child.key"
          class="nav-card"
          :to="`/${child.key}`"
        >
          <span class="nav-card-icon">{{ getIcon(child.key) }}</span>
          <span class="nav-card-title">{{ child.title }}</span>
          <span class="nav-card-desc">{{ getDescription(child.key) }}</span>
          <span class="nav-card-arrow" aria-hidden="true">→</span>
        </RouterLink>
      </div>
    </section>

    <!-- ===== 4. 平台亮点 ===== -->
    <section class="card">
      <div class="sec-head">
        <h3 class="sec-title">平台亮点</h3>
        <span class="sec-sub">框架级通用能力，开箱即得</span>
      </div>
      <div class="feature-grid">
        <div class="feature-item" v-for="f in features" :key="f.title">
          <span class="feature-icon">{{ f.icon }}</span>
          <h4 class="feature-title">{{ f.title }}</h4>
          <p class="feature-desc">{{ f.desc }}</p>
        </div>
      </div>
    </section>

    <!-- ===== 5. 快速上手 ===== -->
    <section class="card">
      <div class="sec-head">
        <h3 class="sec-title">快速上手</h3>
        <span class="sec-sub">从源码到跑起第一个页面，只需四步</span>
      </div>
      <div class="steps">
        <div class="step" v-for="(s, i) in steps" :key="i">
          <div class="step-num">{{ i + 1 }}</div>
          <div class="step-body">
            <h4 class="step-title">{{ s.title }}</h4>
            <p class="step-desc">{{ s.desc }}</p>
          </div>
        </div>
      </div>
      <p class="more-hint">
        更完整的操作说明见「使用指南」→
        <RouterLink class="more-link" to="/about-guide">查看快速开始与常见问题</RouterLink>
      </p>
    </section>

    <!-- ===== 6. 业务模块导航 ===== -->
    <section class="card">
      <div class="sec-head">
        <h3 class="sec-title">业务模块</h3>  <!-- 按 navConfig 自动生成，新增模块无需改本页，点击后自动跳转到大导航栏 -->
      </div>
      <div class="module-grid">
        <RouterLink
          v-for="group in otherGroups"
          :key="group.key"
          class="module-card"
          :to="`/${group.key}`"
        >
          <div class="module-head">
            <span class="module-title">{{ group.title }}</span>
            <span class="module-count">{{ group.children.length }} 页</span>
          </div>
          <div class="module-chips">
            <span class="module-chip" v-for="child in group.children" :key="child.key">
              {{ child.title }}
            </span>
          </div>
          <span class="module-arrow" aria-hidden="true">→</span>
        </RouterLink>
      </div>
    </section>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { navTopItems, navGroups } from '../../config/navConfig'
import { getSysInfo } from '../../api'

// 分组标识：与 navConfig「关于平台」分组 key 保持一致
const ABOUT_GROUP_KEY = 'about'

// 子导航 key → 一句话简介；新增小导航未配置简介时使用默认文案兜底
const childDescriptions = {
  'about-intro': '了解平台的整体架构、功能模块与技术特性',
  'about-guide': '快速上手平台，掌握各功能模块的操作方法',
  'about-feedback': '提交使用过程中遇到的问题与改进建议',
  'about-contact': '获取技术支持与平台相关的联系方式'
}

// 子导航 key → 图标
const childIcons = {
  'about-intro': '🧭',
  'about-guide': '📖',
  'about-feedback': '💬',
  'about-contact': '📮'
}

const DEFAULT_DESCRIPTION = '点击进入该功能页面'

// 从导航配置中动态取「关于平台」分组，新增小导航时卡片自动出现
const aboutGroup = computed(() =>
  navGroups.find((group) => group.key === ABOUT_GROUP_KEY)
)
const aboutChildren = computed(() => (aboutGroup.value ? aboutGroup.value.children : []))

// 除「关于平台」外的其它业务分组（供「业务模块」区块展示，点击跳转分组落地页）
const otherGroups = computed(() =>
  navGroups.filter((group) => group.key !== ABOUT_GROUP_KEY)
)

function getDescription(key) {
  return childDescriptions[key] || DEFAULT_DESCRIPTION
}
function getIcon(key) {
  return childIcons[key] || '📌'
}

// ===== 平台概览统计（全部由导航配置动态计算）=====
const stats = computed(() => [
  { icon: '🗂', label: '功能分组', value: navGroups.length },
  { icon: '📄', label: '已接入页面', value: navGroups.reduce((n, g) => n + g.children.length, 0) },
  { icon: '⚡', label: '顶部快捷项', value: navTopItems.length },
  { icon: '🧭', label: '服务入口', value: aboutChildren.value.length }
])

// ===== 平台亮点 =====
const features = [
  {
    icon: '🖥',
    title: '主进程即后端',
    desc: 'Electron 主进程内置数据层 → 服务层 → 路由层，客户端开箱即用，无需单独部署服务器与运行环境。'
  },
  {
    icon: '🗺',
    title: '数据驱动导航',
    desc: '左侧导航由 navConfig.js 单一数据源驱动，路由自动生成；新增导航、新增模块无需改路由文件。'
  },
  {
    icon: '🛢',
    title: '多数据库连接',
    desc: '支持运行时切换多个 MySQL 连接；新连接自动执行 schemas 脚本完成建库建表，零手工初始化。'
  },
  {
    icon: '🧩',
    title: '标准扩展链路',
    desc: '新增业务模块只需沿 8 处扩展链路补齐：schemas → repository → service → ipc → preload → api → pages → navConfig。'
  }
]

// ===== 快速上手 =====
const steps = [
  { title: '安装依赖', desc: '项目根目录执行 npm install，安装运行所需的全部依赖包。' },
  { title: '启动开发环境', desc: '执行 npm run dev，Vite 自动拉起 Electron 窗口，进入登录页。' },
  { title: '添加数据库连接', desc: '登录页点击「添加数据库」，填写主机、端口、库名、账号与密码，首个连接自动生效。' },
  { title: '打包发布', desc: '执行 npm run pack 产出可执行安装包，产物位于 release/ 目录。' }
]

// ===== 系统信息（版本 / 运行环境；取不到时静默降级）=====
const sysInfo = ref(null)
const appName = ref('grad-studio')
const year = new Date().getFullYear()
const heroTags = ['开箱即用', '无需部署服务', '多数据库支持', '随需扩展']

onMounted(async () => {
  try {
    const info = await getSysInfo()
    if (info && info.success === false) return
    if (info && info.version) {
      sysInfo.value = info
      if (info.name) appName.value = info.name
    }
  } catch {
    // IPC 不可用（如纯前端预览）时保持默认值，不影响页面展示
  }
})
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
  margin: 0 0 8px;
  color: #1d2129;
}
.page-desc {
  margin: 0 0 16px;
  font-size: 13px;
  color: #8a9099;
}
.card {
  background: #fff;
  border-radius: 12px;
  padding: 22px 26px;
  border: 1px solid #f0f2f5;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
}

/* ===== 区块标题 ===== */
.sec-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.sec-title {
  position: relative;
  margin: 0;
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
.sec-sub {
  font-size: 12.5px;
  color: #8a9099;
  white-space: nowrap;
}

/* ===== 1. 平台定位横幅 ===== */
.hero {
  position: relative;
  border-radius: 16px;
  background: linear-gradient(135deg, #1a237e 0%, #0d47a1 100%);
  padding: 32px 36px;
  box-shadow: 0 8px 28px rgba(13, 71, 161, 0.25);
  overflow: hidden;
}
.hero-glow {
  position: absolute;
  right: -16px;
  bottom: -46px;
  font-size: 210px;
  opacity: 0.07;
  transform: rotate(10deg);
  line-height: 1;
  pointer-events: none;
}
.hero-inner {
  position: relative;
  z-index: 1;
}
.hero-tag {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #cfe4ff;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 20px;
  padding: 4px 14px;
  margin-bottom: 14px;
}
.hero-title {
  margin: 0 0 10px;
  font-size: 24px;
  font-weight: 700;
  color: #fff;
}
.hero-desc {
  margin: 0 0 20px;
  max-width: 680px;
  font-size: 14px;
  line-height: 1.9;
  color: rgba(255, 255, 255, 0.88);
}
.hero-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.version-badge {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  background: #0d80e0;
  border-radius: 20px;
  padding: 4px 14px;
}
.env-chip {
  font-size: 12.5px;
  color: #e3f2ff;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 20px;
  padding: 4px 14px;
}

/* ===== 2. 平台概览统计 ===== */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.stat-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  border: 1px solid #f0f2f5;
  border-radius: 12px;
  padding: 16px 18px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
}
.stat-icon {
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: #f0f7ff;
  border: 1px solid #d9ebff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}
.stat-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.stat-num {
  font-size: 20px;
  font-weight: 700;
  color: #0d47a1;
  line-height: 1.2;
}
.stat-label {
  font-size: 12.5px;
  color: #8a9099;
  white-space: nowrap;
}

/* ===== 3. 快捷入口 ===== */
.card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.nav-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 20px 24px;
  background: #fbfdff;
  border: 1px solid #e8eef5;
  border-radius: 10px;
  text-decoration: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}
.nav-card:hover {
  border-color: #0d80e0;
  box-shadow: 0 4px 12px rgba(13, 128, 224, 0.12);
  transform: translateY(-2px);
}
.nav-card-icon {
  font-size: 26px;
  line-height: 1;
}
.nav-card-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2329;
}
.nav-card-desc {
  font-size: 13px;
  line-height: 1.5;
  color: #8a9099;
}
.nav-card:hover .nav-card-title {
  color: #0d80e0;
}
.nav-card-arrow {
  position: absolute;
  right: 18px;
  top: 20px;
  font-size: 14px;
  color: #c3c8cf;
  transition: color 0.2s ease;
}
.nav-card:hover .nav-card-arrow {
  color: #0d80e0;
}

/* ===== 4. 平台亮点 ===== */
.feature-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.feature-item {
  border: 1px solid #e8eef5;
  border-radius: 10px;
  padding: 16px 18px;
  background: #fbfdff;
}
.feature-icon {
  font-size: 24px;
  line-height: 1;
  display: inline-block;
  margin-bottom: 10px;
}
.feature-title {
  margin: 0 0 6px;
  font-size: 14.5px;
  font-weight: 700;
  color: #0d47a1;
}
.feature-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.8;
  color: #4e5969;
}

/* ===== 5. 快速上手 ===== */
.steps {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.step {
  border: 1px solid #e8eef5;
  border-radius: 10px;
  padding: 16px 18px;
  background: #fbfdff;
}
.step-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #0d80e0;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}
.step-title {
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 700;
  color: #1d2129;
}
.step-desc {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.8;
  color: #4e5969;
}
.more-hint {
  margin: 14px 0 0;
  font-size: 13px;
  color: #8a9099;
}
.more-link {
  color: #0d80e0;
  text-decoration: none;
  font-weight: 600;
}
.more-link:hover {
  text-decoration: underline;
}

/* ===== 6. 业务模块导航 ===== */
.module-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.module-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border: 1px solid #e8eef5;
  border-radius: 10px;
  padding: 16px 18px;
  background: #fbfdff;
  text-decoration: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}
.module-card:hover {
  border-color: #0d80e0;
  box-shadow: 0 4px 12px rgba(13, 128, 224, 0.12);
  transform: translateY(-2px);
}
.module-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.module-title {
  font-size: 14.5px;
  font-weight: 700;
  color: #0d47a1;
}
.module-count {
  font-size: 11.5px;
  color: #8a9099;
  background: #f0f7ff;
  border: 1px solid #d9ebff;
  border-radius: 20px;
  padding: 2px 10px;
}
.module-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.module-chip {
  font-size: 12px;
  color: #4e5969;
  background: #f8fafc;
  border: 1px solid #eef1f5;
  border-radius: 6px;
  padding: 3px 10px;
}
.module-arrow {
  position: absolute;
  right: 16px;
  bottom: 16px;
  font-size: 14px;
  color: #c3c8cf;
  transition: color 0.2s ease;
}
.module-card:hover .module-arrow {
  color: #0d80e0;
}

/* ===== 响应式 ===== */
@media (max-width: 860px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .steps {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 720px) {
  .card {
    padding: 18px 16px;
  }
  .hero {
    padding: 24px 20px;
  }
  .hero-title {
    font-size: 20px;
  }
  .sec-head {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
  .card-grid,
  .feature-grid,
  .module-grid {
    grid-template-columns: 1fr;
  }
  .steps {
    grid-template-columns: 1fr;
  }
}
</style>
