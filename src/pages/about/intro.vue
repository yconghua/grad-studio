<template>
  <div class="page">
    <h2 class="page-title">关于平台 · 系统介绍</h2>

    <!-- ===== 1. 平台概述 ===== -->
    <section class="card intro-card">
      <h3 class="sec-title">平台概述</h3>
      <p class="sec-desc">
        本系统是一套<strong class="hl">数据驱动的桌面管理平台</strong>。应用内置完整后端能力：
        Electron 主进程即后端，客户端开箱即用，<strong class="hl">无需单独部署服务器</strong>、
        无需额外安装运行环境，下载启动即可使用。
      </p>
      <p class="sec-desc">
        平台以 <code>MySQL</code> 作为数据存储底座，围绕「账号 → 连接 → 数据 → 模块」组织业务：
        既提供账号体系、多数据库连接管理、系统维护等通用能力，也提供标准化的业务模块扩展链路，
        适用于各类需要本地化数据管理的桌面应用场景。
      </p>
    </section>

    <!-- ===== 2. 技术架构 ===== -->
    <section class="card intro-card">
      <h3 class="sec-title">技术架构</h3>

      <h4 class="sub-title">技术栈</h4>
      <ul class="stack-list">
        <li><code>Vue3</code><span class="stack-desc">渲染层：页面与交互</span></li>
        <li><code>Electron</code><span class="stack-desc">桌面容器：主进程即后端</span></li>
        <li><code>Vite</code><span class="stack-desc">构建与开发工具链</span></li>
        <li><code>MySQL</code><span class="stack-desc">数据存储</span></li>
      </ul>

      <h4 class="sub-title">架构说明</h4>
      <p class="sec-desc">
        系统采用「主进程即后端」的架构：Electron 主进程内置<strong>数据层 → 服务层 → 路由层 → 入口</strong>，
        作为客户端内置的后端服务；渲染层的 <code>Vue3</code> 页面不直接访问数据库，
        而是通过 <code>preload</code> 桥接与 <code>IPC</code> 调用主进程提供的接口完成数据读写。
      </p>

      <h4 class="sub-title">分层示意</h4>
      <pre class="arch-diagram">
        ┌───────────────────────────────────────────────┐
        │  渲染层（Vue3 页面）                           
        │    src/pages ── src/api ── preload 桥接        
        ├───────────────────────────────────────────────┤
        │  主进程（内置后端）                            
        │    路由层  electron/ipc                       
        │    服务层  electron/services                  
        │    数据层  electron/db（schemas + repositories）
        ├───────────────────────────────────────────────┤
        │  存储层  MySQL（mysql2 驱动）                  
        └───────────────────────────────────────────────┘
      </pre>
    </section>

    <!-- ===== 3. 核心功能 ===== -->
    <section class="card intro-card">
      <h3 class="sec-title">核心功能</h3>
      <div class="feature-grid">
        <div class="feature-item">
          <h4 class="feature-title">账号体系与权限</h4>
          <ul class="feature-list">
            <li>登录 / 退出登录，会话状态全程管理</li>
            <li>登录会话有效期固定为 24 小时</li>
            <li>角色分管理员 / 普通用户，用户管理、系统管理等页面仅管理员可见</li>
          </ul>
        </div>
        <div class="feature-item">
          <h4 class="feature-title">多数据库连接管理</h4>
          <ul class="feature-list">
            <li>登录页即可添加数据库连接（主机、端口、库名、账号、密码）</li>
            <li>首个连接自动生效；新连接自动执行 <code>schemas</code> 脚本建库建表</li>
            <li>支持运行时切换连接；连接信息保存在本地 <code>userData/db-connections.json</code></li>
          </ul>
        </div>
        <div class="feature-item">
          <h4 class="feature-title">系统管理</h4>
          <p class="feature-pos">个人主页 → 系统管理页签</p>
          <ul class="feature-list">
            <li>运行状态：后端服务、数据库连接、应用运行时长等</li>
            <li>工具：打开用户数据目录、导出数据库备份 SQL</li>
            <li>关于：系统名称、版本号、手动检查更新、运行环境等信息</li>
          </ul>
        </div>
        <div class="feature-item">
          <h4 class="feature-title">数据驱动导航</h4>
          <ul class="feature-list">
            <li>左侧导航完全由 <code>src/config/navConfig.js</code> 单一数据源驱动（顶部项 + 分组 + 子项）</li>
            <li>路由根据导航配置自动生成；新增导航 / 新增模块无需修改路由文件（仅需注册组件映射）</li>
          </ul>
        </div>
      </div>

      <h4 class="sub-title">已有模块</h4>
      <p class="sec-desc">
        首页、个人主页（个人信息 / 用户管理 / 系统管理）、模块一 / 模块二 / 模块三（业务占位示例）、
        应急疏散仿真（后端仿真引擎接口对接文档）、
        关于平台（系统介绍 / 使用指南 / 意见反馈 / 联系我们）。
      </p>
    </section>

    <!-- ===== 4. 扩展机制 ===== -->
    <section class="card intro-card">
      <h3 class="sec-title">扩展机制</h3>
      <p class="sec-desc">
        本系统将「业务模块」抽象为一条标准扩展链路。新增一个业务模块，只需沿链路补齐
        <strong class="hl">8 处</strong>即可接入，全程无需改动框架的既有代码：
      </p>

      <div class="chain-flow">
        <span class="chain-chip"><code>schemas/*.sql</code></span><span class="chain-arrow">→</span>
        <span class="chain-chip"><code>repository</code></span><span class="chain-arrow">→</span>
        <span class="chain-chip"><code>service</code></span><span class="chain-arrow">→</span>
        <span class="chain-chip"><code>ipc</code></span><span class="chain-arrow">→</span>
        <span class="chain-chip"><code>preload</code></span><span class="chain-arrow">→</span>
        <span class="chain-chip"><code>api</code></span><span class="chain-arrow">→</span>
        <span class="chain-chip"><code>pages</code></span><span class="chain-arrow">→</span>
        <span class="chain-chip"><code>navConfig</code></span>
      </div>

      <div class="table-wrap">
        <table class="chain-table">
          <thead>
            <tr>
              <th>环节</th>
              <th>位置</th>
              <th>职责</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="num">1</td>
              <td><code>electron/db/schemas/NN_表名.sql</code></td>
              <td>声明表结构，新连接 / 初始化时自动建表</td>
            </tr>
            <tr>
              <td class="num">2</td>
              <td><code>electron/db/repositories/*.js</code></td>
              <td>封装数据访问，负责查询与写入</td>
            </tr>
            <tr>
              <td class="num">3</td>
              <td><code>electron/services/*.js</code></td>
              <td>业务逻辑层，处理业务规则</td>
            </tr>
            <tr>
              <td class="num">4</td>
              <td><code>electron/ipc/*.js</code></td>
              <td>路由层，注册主进程 IPC 处理器</td>
            </tr>
            <tr>
              <td class="num">5</td>
              <td><code>electron/preload.js</code></td>
              <td>桥接层，通过 contextBridge 暴露接口</td>
            </tr>
            <tr>
              <td class="num">6</td>
              <td><code>src/api/index.js</code></td>
              <td>渲染层 API 调用封装</td>
            </tr>
            <tr>
              <td class="num">7</td>
              <td><code>src/pages/...</code></td>
              <td>编写业务页面</td>
            </tr>
            <tr>
              <td class="num">8</td>
              <td><code>src/config/navConfig.js</code></td>
              <td>注册导航项，路由自动生成</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="sec-desc">
        按此链路接入后，新模块即可获得：<strong>自动建表、完整的数据读写接口、页面路由与左侧导航</strong>，
        无需单独部署服务，也无需改动框架其它部分。
      </p>
    </section>

    <!-- ===== 5. 平台定位 ===== -->
    <section class="card position-card">
      <div class="position-inner">
        <div class="position-icon">🛠️</div>
        <p class="position-text">
          开箱即用、随需扩展的本地化桌面数据管理平台——
          <strong>通用能力开箱即得，业务能力按标准链路随需扩展。</strong>
        </p>
      </div>
    </section>
  </div>
</template>

<script setup>
// 系统介绍页为纯展示页面，无需脚本逻辑。
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
.intro-card + .intro-card {
  margin-top: 0;
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
.sub-title {
  margin: 18px 0 10px;
  font-size: 14px;
  font-weight: 600;
  color: #0d80e0;
}
.sub-title:first-of-type {
  margin-top: 4px;
}

/* ===== 正文与强调 ===== */
.sec-desc {
  margin: 0 0 10px;
  font-size: 14px;
  line-height: 1.9;
  color: #4e5969;
}
.sec-desc:last-child {
  margin-bottom: 0;
}
.hl {
  color: #0d47a1;
  font-weight: 600;
}

/* ===== 代码标签 ===== */
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

/* ===== 技术栈 ===== */
.stack-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.stack-list li {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: #f8fafc;
  border: 1px solid #eef1f5;
  border-radius: 8px;
  padding: 10px 14px;
}
.stack-desc {
  font-size: 12.5px;
  color: #8a9099;
}

/* ===== 分层示意图 ===== */
.arch-diagram {
  margin: 4px 0 0;
  padding: 14px 18px;
  background: #f6f9fc;
  border: 1px solid #e3ecf5;
  border-radius: 8px;
  font-family: 'JetBrains Mono', Consolas, Menlo, 'Courier New', monospace;
  font-size: 12.5px;
  line-height: 1.75;
  color: #37474f;
  overflow-x: auto;
}

/* ===== 核心功能卡片 ===== */
.feature-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  margin-bottom: 6px;
}
.feature-item {
  border: 1px solid #e8eef5;
  border-radius: 10px;
  padding: 14px 18px;
  background: #fbfdff;
}
.feature-title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 700;
  color: #0d47a1;
}
.feature-pos {
  margin: 0 0 8px;
  font-size: 12px;
  color: #8a9099;
}
.feature-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.feature-list li {
  position: relative;
  padding-left: 14px;
  font-size: 13.5px;
  line-height: 1.8;
  color: #4e5969;
}
.feature-list li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 9px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #0d80e0;
}

/* ===== 扩展链路 ===== */
.chain-flow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 6px 0 18px;
}
.chain-chip {
  display: inline-block;
  background: #f0f7ff;
  border: 1px solid #d9ebff;
  border-radius: 6px;
  padding: 4px 10px;
  white-space: nowrap;
}
.chain-chip code {
  background: transparent;
  border: none;
  padding: 0;
}
.chain-arrow {
  color: #0d80e0;
  font-weight: 700;
}

/* ===== 链路表格 ===== */
.table-wrap {
  overflow-x: auto;
  margin-bottom: 14px;
}
.chain-table {
  width: 100%;
  min-width: 560px;
  border-collapse: collapse;
  font-size: 13px;
}
.chain-table th {
  background: #f0f7ff;
  color: #0d47a1;
  text-align: left;
  font-weight: 600;
  padding: 9px 14px;
  border-bottom: 2px solid #d9ebff;
  white-space: nowrap;
}
.chain-table td {
  padding: 9px 14px;
  border-bottom: 1px solid #eef1f5;
  color: #4e5969;
  line-height: 1.7;
}
.chain-table td.num {
  width: 36px;
  color: #8a9099;
  font-weight: 600;
}
.chain-table tbody tr:last-child td {
  border-bottom: none;
}
.chain-table tbody tr:hover {
  background: #f8fafc;
}

/* ===== 平台定位 ===== */
.position-card {
  background: linear-gradient(135deg, #0d80e0 0%, #0d47a1 100%);
  border: none;
  box-shadow: 0 8px 24px rgba(13, 71, 161, 0.22);
}
.position-inner {
  display: flex;
  align-items: center;
  gap: 16px;
}
.position-icon {
  font-size: 32px;
  line-height: 1;
  flex-shrink: 0;
}
.position-text {
  margin: 0;
  font-size: 15px;
  line-height: 1.8;
  color: rgba(255, 255, 255, 0.92);
}
.position-text strong {
  color: #fff;
  font-weight: 700;
}

/* ===== 响应式 ===== */
@media (max-width: 720px) {
  .card {
    padding: 18px 16px;
  }
  .feature-grid {
    grid-template-columns: 1fr;
  }
  .stack-list {
    grid-template-columns: 1fr;
  }
  .position-inner {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
}
</style>
