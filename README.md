# gra studio · 使用手册

> **GradStudio（研究生工作室管理平台） 是一个面向高校研究生工作室与课题组的综合管理平台，帮助导师和管理员实现成员、项目、任务、组会、成果、文档与日常事务的一体化管理。**（Electron + Vue 3 + MySQL）。
> 不需要自己搭后端服务：Electron 主进程直连你的 MySQL，登录即用。
> 内置账号体系、数据库连接管理（**自动建库建表**）、系统管理，业务模块可自由扩展。

![Version](https://img.shields.io/badge/version-0.0.8-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![Electron](https://img.shields.io/badge/Electron-31-2b2e42)
![Vue](https://img.shields.io/badge/Vue-3.4-42b883)
![MySQL](https://img.shields.io/badge/MySQL-5.7%2B%20%7C%208.x-cb3837)

---
<a id="toc"></a>
## 📑 目录

- [这是什么](#这是什么)
- [环境要求](#环境要求)
- [快速开始：两条命令跑起来](#快速开始两条命令跑起来)
- [首次使用：添加数据库（自动建库建表）](#首次使用添加数据库自动建库建表)
- [打包成 exe / 安装包](#打包成-exe--安装包)
- [常用命令一览](#常用命令一览)
- [内置页面](#内置页面)
- [二次开发：加自己的业务模块](#二次开发加自己的业务模块)
- [常见问题 FAQ](#常见问题-faq)
- [许可证](#许可证)

---

## 这是什么
（[↑ 回到目录](#toc)）

gra studio 是一个本地运行的桌面应用框架：**下载源码 → 装依赖 → 启动 → 填一次数据库连接 → 登录使用**。数据全部落在你自己的 MySQL 里，没有云端、没有第三方服务。

**开箱即用的能力：**

| 能力 | 说明 |
| --- | --- |
| 账号体系 | 登录 / 会话/ 修改密码 / 用户管理（仅管理员） |
| 数据库连接管理 | 支持多套 MySQL 连接、运行时切换；**添加连接时自动建库 + 建表 + 写入默认管理员** |
| 系统管理 | 运行状态、清理本地缓存、查看数据表、关于（版本 / 检查更新 / 环境信息） |
| 数据驱动导航 | 左侧导航由配置文件驱动，加页面不改框架代码 |

---

## 环境要求
（[↑ 回到目录](#toc)）

| 依赖 | 要求 | 说明 |
| --- | --- | --- |
| **Node.js** | **18+**（推荐 22.x） | 用 `node -v` 检查 |
| **MySQL** | **5.7+ / 8.x** | 本地或远程均可；账号需有**建库权限**（自动建库需要） |
| 操作系统 | Windows（主要）/ macOS / Linux | Electron 跨平台 |

> 注意：`npm install` 时需要能访问 npm 源；若在国内网络较慢，可配置 npmmirror 镜像（见 [FAQ](#常见问题-faq)）。

---

## 快速开始：两条命令跑起来
（[↑ 回到目录](#toc)）

在项目根目录（含 `package.json` 的目录）打开终端：

```bash
# 第 1 步：安装依赖（首次需要，约 1~3 分钟）
npm install

# 第 2 步：启动开发模式（自动打开应用窗口）
npm run dev
```

启动后会出现 Electron 窗口并停在**登录页**——**此时还没有任何数据库连接，需要先完成下面的「添加数据库」才能登录。**

---

## 首次使用：添加数据库（自动建库建表）
（[↑ 回到目录](#toc)）

**系统不内置任何默认连接**，首次使用必须自己添加一个。整个过程不需要手写 SQL：

1. 在登录页点击「基础配置 → 添加数据库」；
2. 填写你的 MySQL 连接信息（主机 / 端口 / 用户名 / 密码 / 数据库名）；
3. 点击确认，主进程会自动完成：
   - **建库**：`CREATE DATABASE IF NOT EXISTS`（不存在才创建，字符集 utf8mb4）；
   - **建表**：按文件名顺序执行 `electron/db/schemas/` 下的全部 `.sql`（`01_users.sql` 建用户表）；
   - **写默认管理员**：账号 `admin` / 密码 `admin123`；
4. **添加的第一个连接会自动生效**，返回登录页用默认账号登录即可。

**几个关键约定：**

- 数据库的连接信息保存在应用所在电脑的**用户数据目录**（`db-connections.json`），**不会进入代码仓库**，换机器需重新添加；
- 添加第二个连接后，可在「基础配置」里随时切换，多套连接运行时切换、无需重启；
- 这条信息是给二次开发的开发者看的。⚠️ **新表不会在普通重启时自动建**。给「已存在」的数据库加表 / 加列，只有两种触发时机：① 再添加一个新的数据库连接；② 升级 `package.json` 的 `version`（如 3.10.3 → 3.10.4）后重启一次。升级迁移会**重跑全部 `.sql`**（新表用 `CREATE TABLE IF NOT EXISTS` 创建），并自动比对每个 `.sql` 声明的列与库中实际列，**缺失的列自动 `ALTER TABLE ... ADD COLUMN` 补齐**；全部库都成功后才写入新版本号，中途失败则下次启动自动重试（已完成的操作幂等跳过，不会重复执行）。想立即生效也可直接在 MySQL 客户端手动执行 SQL。

---

## 打包成 exe / 安装包
（[↑ 回到目录](#toc)）

```bash
npm run pack
```

该命令 = `npm run build`（Vite 构建前端到 `dist/`）+ `electron-builder`（打包安装包）。

**输出目录**：`release/`（已被 `.gitignore` 忽略，不会提交到仓库）。Windows 下产出 NSIS 安装包（`.exe`）。

**注意事项：**

1. **建议用管理员终端执行**（右键终端 → "以管理员身份运行"）。electron-builder 在 Windows 上创建安装程序时需要写系统目录 / 符号链接的权限，普通终端偶发 `EPERM` / 权限错误；
2. 首次打包会下载 electron 二进制与 NSIS 工具，**耗时较长**，请耐心等待；国内网络慢可先配置镜像（见 [FAQ](#常见问题-faq)）；
3. 若被杀毒软件拦截生成的 exe，属于误报，添加信任或白名单即可；
4. 产物在 `release/` 下，把 `*.exe` 分发给别人即可，对方无需安装 Node / MySQL 客户端（但**运行仍需一个 MySQL 实例**，首次打开在应用里添加连接）。

**推送 main 分支自动发布（GitHub Actions）：**

仓库已内置 `.github/workflows/release.yml`：推送 `main` 分支到 GitHub 后，CI 会读取 `package.json` 的版本号（如 `3.10.3`）——若该版本对应的 `v3.10.3` tag 尚不存在，则自动打 tag 并打包发布；版本号未变化则自动跳过。CI 在 Windows 环境执行 `npm ci` → `npm run build` → `electron-builder`，并把安装包上传为 **GitHub Release**。

**发版步骤：** 改 `package.json` 里的 `version` → 提交并推送：

```bash
git add package.json
git commit -m "chore: release v3.10.3"
git push origin main
```

tag 和 Release 全部自动完成，无需手动打 tag。也可以在 GitHub Actions 页面手动触发（`workflow_dispatch`，同样会检查 tag 是否已存在）。CI 使用 `npm ci`，请确保 `package-lock.json` 已提交。

**应用内检查更新：** 「系统管理 → 关于 → 版本号」可手动检查更新：应用请求更新源仓库的 GitHub Releases 最新版本，与本地版本（`package.json`）做语义化对比，发现新版本时展示更新说明并引导前往下载页。

> **前提：更新源仓库必须设为公开**（检查更新走 GitHub 匿名只读 API，私有仓库会返回 404），且已通过上面的流程发布过 Release。二次分发时，把 `electron/ipc/sys.js` 顶部的 `UPDATE_REPO` 常量改成你自己的 `owner/repo` 即可（仓库公开 + 已发布 Release 时开箱即用）。

---

## 常用命令一览
（[↑ 回到目录](#toc)）

| 命令 | 说明 |
| --- | --- |
| `npm install` | 安装依赖（首次必做） |
| `npm run dev` | 开发模式：Vite + Electron 同时启动 |
| `npm run vite` | 仅启动 Vite 开发服务器（不弹窗口） |
| `npm run build` | 前端构建到 `dist/` |
| `npm run start` | 仅启动 Electron（需先 `npm run build`） |
| `npm run pack` | 构建 + 打包安装包，输出到 `release/` |

---

## 内置页面
（[↑ 回到目录](#toc)）

启动登录后进入主界面，左侧导航结构（数据驱动，来自 `src/config/navConfig.js`）：

- **首页**：欢迎横幅 + 平台公告 + 开发进度提示；
- **模块一 / 模块二 / 模块三**：示例分组，页面均为「正在开发中」占位，供二次开发填充；
- **应急疏散 → 仿真模拟**：后端仿真引擎接口对接文档页（服务健康检查 / 仿真提交等接口说明）；
- **关于平台**：系统介绍 / 使用指南 / 意见反馈 / 联系我们；
- **个人中心**：个人信息（修改密码）+ 用户管理（管理员）+ 系统管理（运行状态 / 清理缓存 / 查看数据表 / 关于 / 检查更新）。

---

## 二次开发：加自己的业务模块
（[↑ 回到目录](#toc)）

> 你是开发者，想往框架里加自己的表 + 页面？

一个业务模块涉及 8 处文件，数据流向：**页面 → api → preload → IPC → Service → Repository → MySQL**：

| # | 文件 | 作用 |
| --- | --- | --- |
| 1 | `electron/db/schemas/NN_表名.sql` | 建表 + 种子数据（升级版本号后自动执行，见上文「首次使用」） |
| 2 | `electron/db/repositories/xxxRepository.js` | 数据访问层（参考 `userRepository.js` / `BaseRepository.js`） |
| 3 | `electron/services/xxxService.js` | 业务服务层（参考 `authService.js`） |
| 4 | `electron/ipc/xxx.js` | IPC 通道（在 `electron/ipc/index.js` 注册） |
| 5 | `electron/preload.js` | 用 `createInvoke` 把通道暴露到 `window.api` |
| 6 | `src/api/index.js` | 前端 API 封装（调用 `window.api.xxx`） |
| 7 | `src/pages/xxx/` | 页面组件 |
| 8 | `src/config/navConfig.js` | 左侧导航注册（单一数据源，路由自动生成） |

技术栈：Vue 3（`<script setup>`）+ Vue Router 4 + Vite 5 + Electron 31 + MySQL（mysql2）+ bcryptjs（密码哈希）。

---

## 常见问题 FAQ
（[↑ 回到目录](#toc)）

**Q1：`npm install` 很慢 / 卡住？**
国内网络建议使用 npmmirror 镜像。在用户目录（`~/.npmrc`）写入：
```bash
registry=https://registry.npmmirror.com
electron_mirror=https://cdn.npmmirror.com/binaries/electron/
electron_builder_binaries_mirror=https://cdn.npmmirror.com/binaries/electron-builder-binaries/
```

**Q2：启动后白屏？**
开发模式请确认 5173 端口未被占用（`npm run dev` 输出里 Vite 正常起来）；打包版使用 hash 路由，一般不会白屏。可先清缓存（个人中心 → 系统管理 → 清理缓存 → 全部）再试。

**Q3：添加数据库提示连接失败？**
- 确认 MySQL 服务已启动、端口正确；
- 确认账号密码正确且**有建库权限**（程序要执行 `CREATE DATABASE`）；
- 远程 MySQL 需确认账号允许从当前 IP 访问（`%` 或指定主机授权）。

**Q4：`npm run pack` 报权限错误？**
改用**管理员终端**重试（见「打包成 exe」注意事项第 1 条）。

**Q5：打包下载 electron 二进制超时？**
同样配置上面的镜像后重试；或把 `node_modules` 删掉重新 `npm install` 一次。

**Q6：默认管理员密码忘了？**
连接数据库后直接改 `user` 表里 `admin` 行的 `password` 字段（值需为 bcrypt 哈希），或重开一个数据库连接重新初始化。

---

## 许可证
（[↑ 回到目录](#toc)）

[MIT](https://opensource.org/licenses/MIT) © conghua

⭐ 如果这个项目对你有帮助，欢迎 Star 支持：

![Star History Chart](https://api.star-history.com/svg?repos=yconghua/grad-studio&type=Date)

---
到此结束，over！---2026年夏
---