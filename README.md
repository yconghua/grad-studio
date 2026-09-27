# 课题组科研管理平台（grad-studio）

> 面向高校课题组的多角色科研协作管理平台（Electron + Vue 3 + MySQL）。
> 四类角色（超级管理员 / 课题组管理员 / 导师 / 学生）+ 动态权限渲染菜单 + 前后端双重鉴权。

![Status](https://img.shields.io/badge/status-重构中-orange)

---

## ⚠️ 当前状态：破坏性重构第一阶段（2026-09）

本项目正处于**破坏性重构**过程中：原「研究生工作室管理平台」（三级角色）已清理旧业务代码，
前端骨架已按新角色体系重建。**业务功能、数据库字段与前后端业务接口尚未实现。**

**已交付（第一阶段）：**
- ✅ 四类角色体系（`shared/constants.js` 单一事实来源）
- ✅ 21 项菜单 + 角色权限数组 + 动态过滤渲染（`src/config/navConfig.js`）
- ✅ 菜单驱动路由 + 角色守卫（`src/router/index.js`）
- ✅ 顶部全局导航 + 侧边动态菜单布局（`src/layouts/HomeLayout.vue`）
- ✅ 全部业务页面目录与占位骨架（`src/pages/**/index.vue`）
- ✅ 数据库精简：仅保留一张用户表（`electron/db/schemas/01_users.sql`，6 个登录必需字段）
- ✅ 旧业务代码与平台三表（消息 / 参数 / 日志）的前后端代码全部删除（前端旧页面、后端业务与平台 IPC/Service/Repository、37 张旧表 Schema）

---

## 快速开始

```bash
# 安装依赖（首次）
npm install

# 开发模式（Vite + Electron）
npm run dev

# 仅构建前端
npm run build
```

首次使用在登录页「添加数据库」填写 MySQL 连接信息，主进程自动建库建表并写入默认管理员。
默认账号 `admin` / `admin123456`（首次登录强制改密）。

---

## 技术栈

| 层 | 技术 |
| --- | --- |
| 桌面壳 | Electron 31 |
| 前端 | Vue 3（`<script setup>`）+ Vue Router 4（hash 模式）+ Vite 5 |
| 数据库 | MySQL 5.7+ / 8.x（mysql2，Electron 主进程直连，自动建库建表） |
| 安全 | bcryptjs（密码哈希）、contextIsolation + 无 nodeIntegration |

## 目录速览

```
electron/            主进程（后端）：ipc / services / db(repositories + schemas)
src/                 渲染层（前端）：pages / layouts / components / config / router / api
shared/constants.js  前后端共享常量（角色 / 密码 / 枚举，单一事实来源）
```

## 常见问题

- **忘记密码**：联系超级管理员 / 课题组管理员在用户管理或成员管理中重置。
- **新表不会自动建**：升级 `package.json` 的 `version` 后重启，或重新添加数据库连接。
- 历史版本可回溯：`git log` 可查看 v1.0.10 及更早版本。

---

MIT © yconghua
