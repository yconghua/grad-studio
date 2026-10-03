# grad-studio 课题组科研管理平台

课题组协作管理桌面应用（Vue 3 + Electron + MySQL）。把组会、课题组公告、任务、周报、笔记、一对一聊天、通知中心放进同一个平台：导师随时批阅点评，学生按节点记录推进，组管统筹全组，超管总览全局。数据存本地 MySQL、默认不联网，部署简单、开箱即用。

MIT License

## 功能概览

| 模块 | 说明 | 主要角色 |
| --- | --- | --- |
| 用户管理 | 用户 CRUD、批量创建（CSV 导入）、批量启停/删除、重置密码、候选人查询 | 超级管理员 |
| 课题组管理 | 课题组 CRUD、成员管理（增删、批量移除、批量指派导师）、成员统计 | 超级管理员 / 课题组管理员 |
| 课题组公告 | 发布 / 编辑 / 置顶 / 删除、已读统计、未读数 | 组管发布，全员查看 |
| 组会管理 | 草稿 → 发布（可转公告）、归档、参会人管理、会议统计 | 组管维护，全员查看 |
| 任务管理 | 创建 / 分配参与人 / 提交进展 / 完成 / 验收 / 驳回 / 取消 / 重新打开 / 软删除恢复、任务动态留痕、分角色统计看板 | 组管、导师创建；学生参与 |
| 周报管理 | 草稿 / 提交 / 撤回 / 批阅 / 打回重交、附件、模板、免交假期、补交窗口、催交提醒 | 学生提交，导师批阅，组管/超管统计 |
| 学生笔记 | 分类笔记（实验记录 / 文献笔记 / 组会笔记 / 研究想法 / 失败记录 / 周报素材 / 项目笔记 / 其他）、回收站恢复/彻底删除、导出 | 学生 |
| 一对一聊天 | 会话管理、历史 / 增量消息、撤回、未读计数、主进程实时推送 | 全员 |
| 通知中心 | 多类型通知、已读 / 全部已读 / 清理、实时推送 | 全员 |
| 系统配置 | 系统参数、系统简介、默认主题、数据库连接管理（多连接切换 / 批量导入 / 备份导出） | 超级管理员 |
| 应用更新 | 检查 / 下载 / 安装新版本（GitHub Release 源） | 全员（客户端侧） |
| 外观 | 亮色 / 暗色 / 跟随系统三态主题，角色差异化界面 | 全员 |

## 角色体系

| 角色 | 定位 | 主要权限 |
| --- | --- | --- |
| super_admin 超级管理员 | 平台运维 | 用户管理、课题组设置、全组公告/组会/任务/周报总览、系统配置、数据库连接管理 |
| group_admin 课题组管理员 | 课题组最高管理角色 | 本组设置、成员管理、本组公告/组会/任务/周报管理、成员任务统计 |
| mentor 导师 | 管理名下学生 | 我的学生、周报批阅、创建任务（参与人限名下学生）、本组公告/组会只读 |
| student 学生 | 参与科研工作 | 我的周报、我的任务、私人笔记、本组公告/组会只读 |

账号状态：1 启用 / 0 禁用。权限校验唯一可信来源是主进程会话（`authService.getCurrentUser`），前端一律不可信，所有写操作在后端做角色与归属校验。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 桌面壳 | Electron 31（contextIsolation，无 nodeIntegration） |
| 前端 | Vue 3 + Vue Router（hash 模式）+ Vite 5 |
| 数据库 | MySQL（mysql2，主进程直连，自动建库建表） |
| 密码 | bcryptjs（哈希比对，成本 10） |
| 更新 | electron-updater + GitHub Release |
| 打包 | electron-builder（NSIS 安装包） |
| CI/CD | GitHub Actions（.github/workflows/release.yml） |

## 环境要求

- Node.js 22+（CI 使用 Node 22）
- npm（依赖锁定在 package-lock.json，建议 `npm ci` 安装）
- MySQL 5.7+ / 8.x 服务，且用于初始化的账号具备建库、建表权限

## 快速开始

```bash
# 1. 安装依赖
npm ci

# 2. 开发模式（同时启动 Vite 与 Electron，Vite 端口 5173）
npm run dev

# 3. 仅构建前端产物（输出到 dist/）
npm run build

# 4. 以打包产物方式启动（需先 npm run build）
npm start

# 5. 打包安装程序（vite build + electron-builder，输出到 release/）
npm run pack
```

## 首次使用

1. 启动应用后进入登录页，若无已配置的数据库连接，需先进入「添加数据库」填写连接信息（名称、主机、端口、账号、密码、数据库名）。数据库名仅支持字母、数字、下划线。
2. 应用会自动连接并初始化：库不存在则自动建库，按 `electron/db/schemas/` 下 01~19 号 SQL 文件顺序建表并写入种子数据。
3. 使用默认账号登录（首次登录强制修改密码）：

| 角色 | 默认用户名 | 默认密码 |
| --- | --- | --- |
| 超级管理员 | superadmin | SuperAdmin123 |
| 课题组管理员 | 由超管创建 | GroupAdmin123 |
| 导师 | 由超管创建 | Mentor123 |
| 学生 | 由超管创建 | Student123 |

> 默认密码定义在 `shared/constants.js` 的 `DEFAULT_PASSWORD_BY_ROLE`（单一事实来源），所有新增用户 / 管理员重置密码统一使用；密码最短 6 位，首次登录强制改密（`must_change_password=1`）。

## 数据库

- 连接清单持久化在用户数据目录 `db-connections.json`（Electron 未就绪时回退到项目目录），支持多连接保存与运行时切换；切换连接会销毁旧连接池并按新配置重建。
- 连接池上限 10，单次获取连接超时 10 秒（避免连接占满时应用假死）；新连接统一设置 `innodb_lock_wait_timeout=5`，配合服务层死锁重试避免长锁等待。
- 数据表（22 张，见 `electron/db/schemas/`）：

| 编号 | 文件 | 表 |
| --- | --- | --- |
| 01 | users.sql | users 用户 |
| 02 | groups.sql | groups 课题组 |
| 03 | system_configs.sql | system_configs 系统参数 |
| 04–05 | group_notice*.sql | group_notice 公告、group_notice_read 已读 |
| 06–07 | group_meeting*.sql | group_meeting 组会、group_meeting_participant 参会人 |
| 08–10 | chat_*.sql | chat_session 会话、chat_session_member 会话成员、chat_message 消息 |
| 11–12 | notification*.sql | notification 通知、notification_type 通知类型 |
| 13–17 | task*.sql | task 任务、task_participant 参与人、task_dynamic 动态、task_reminder 提醒记录、task_notification_type 任务通知类型种子 |
| 18 | note.sql | note 学生笔记 |
| 19 | report.sql | report 周报、report_attachment 附件、report_template 模板、report_holiday 假期、report_remind_log 提醒记录 |

- 升级迁移：应用版本号变化时，对所有已配置库重跑 schemas SQL（幂等），并解析各 SQL 声明的列与库中实际列做差集，缺失列自动 `ALTER TABLE ADD COLUMN` 补齐；全部库成功才写回版本号，失败下次启动自动重试。
- 备份导出：系统管理提供整库导出为 SQL 备份文件（表结构 + 全量数据，InnoDB 一致性快照读 + 分批 500 行流式写入，先写临时文件再原子改名）。

## 核心业务规则

### 任务

- 状态机：`1 待办 → 2 进行中 → 3 待验收 → 4 已完成`；待验收可驳回回进行中；待办/进行中可取消（5）；已完成可重新打开回进行中。
- 优先级：1 低 / 2 中 / 3 高 / 4 紧急。
- 创建者即负责人和验收人，创建者不参与任务；参与人提交进展（待办状态下自动进入进行中）、提交完成一律进入待验收。
- 所有主表写操作走乐观锁（version 条件更新），冲突提示「任务已被他人更新，请刷新」。
- 定时提醒（主进程每 15 分钟扫描，按 task_reminder 唯一键当日去重）：即将到期（默认提前 24h，可配 `task.due_soon_hours`）、已逾期、待验收超时（默认 24h，可配 `task.pending_review_hours`）。

### 周报

- 状态机：`draft → submitted → reviewed / returned`；打回（returned）可改后重交回 submitted；reviewed 为终态只读。
- 学生提交后 1 小时内可撤回；导师批阅后 24 小时内可撤回（清空批阅字段）。
- 补交窗口：仅最近 4 个自然周内可提交 / 可批阅。
- 附件规则：仅草稿 / 打回状态可增删；允许 PDF、Word、图片（pdf/doc/docx/png/jpg/jpeg/gif/webp）；单文件 ≤ 50MB；每名学生累计 ≤ 1GB。
- 定时提醒（每 15 分钟扫描）：未交提醒仅每周四、周日各一次；批阅超时 48 小时提醒导师、72 小时提醒组管；打回后 7 天未重交每周催一次。

### 聊天 / 通知

- 一对一聊天与通知中心由主进程轮询数据库增量后推送给渲染层：聊天每 2 秒、通知每 10 秒，均支持撤回 / 已读等实时联动。

## 架构

### 进程结构

```
┌─────────────────────────────── Electron 主进程（兼后端）──────────────────────────────┐
│ main.js：窗口 / 生命周期 / 单实例锁 / 系统托盘 / gradapp:// 自定义协议 / 启动各服务    │
│ services/    业务逻辑（认证、用户、课题组、公告、组会、聊天、通知、任务、笔记、周报、   │
│              连接管理、系统配置、升级、更新、任务/周报定时调度器、聊天/通知轮询器）      │
│ ipc/         路由层（auth/user/group/notice/meeting/chat/notification/task/.../sys）    │
│ db/          连接池 + 事务上下文（AsyncLocalStorage）+ 自动建库建表 + repositories      │
├─────────────────────────────── preload.js（contextBridge）─────────────────────────────┤
│ 把全部业务模块暴露为 window.api（auth / user / group / chat / report / sys / ...）      │
├─────────────────────────────── 渲染层 Vue 3（src/）─────────────────────────────────────┤
│ router（hash，登录守卫 + 强制改密 + 角色越权 + 引导页判定）/ layouts（四角色布局）      │
│ pages（按角色分目录）/ components / composables / api（window.api 薄封装）/ styles       │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

- 渲染层拿不到 Node 能力（`contextIsolation: true`、`nodeIntegration: false`），只能通过 `window.api` 调用主进程；IPC 调用与返回带全量日志，密码类字段打印前脱敏为 `***`。
- 登录态以主进程内存当前用户为准，渲染层配合 localStorage 会话做路由守卫。
- 主窗口固定 1100×750、无边框（标题栏自绘）、禁止缩放/最大化；关闭行为：登录页直接退出，登录后最小化到系统托盘驻留。
- 单实例锁：同一台电脑只允许运行一份，第二份启动自动聚焦已有窗口。
- 自定义协议 `gradapp://uploads/<文件名>`：仅映射用户数据目录 uploads/ 内文件（basename 防路径穿越），供页面加载本地头像等附件。

### 目录结构

```
grad-studio/
├── electron/                  # 主进程（CommonJS）
│   ├── main.js                # 入口：窗口 / 生命周期 / 托盘 / 服务启动
│   ├── preload.js             # contextBridge 暴露 window.api
│   ├── db/
│   │   ├── connection.js      # 连接池 + 事务上下文
│   │   ├── create_new_database.js  # 自动建库建表 + 升级补列
│   │   ├── schemas/           # 01~19 号 SQL（建表 + 种子数据）
│   │   └── repositories/      # 各表 CRUD 仓库
│   ├── ipc/                   # IPC 路由（按模块拆分，index.js 聚合注册）
│   └── services/              # 业务逻辑 / 调度器 / 轮询器
├── shared/
│   └── constants.js           # 前后端共享常量（角色 / 状态 / 规则，单一事实来源）
├── src/                       # 渲染层 Vue 3（ESM）
│   ├── main.js / App.vue      # 入口
│   ├── router/index.js        # hash 路由 + 登录守卫
│   ├── api/                   # window.api 调用封装
│   ├── layouts/               # 四角色布局 + 引导页布局
│   ├── pages/                 # 页面（admin / group-admin / mentor / student / chat / task / ...）
│   ├── components/            # 通用组件（对话框 / 聊天 / 通知 / 任务 / 布局）
│   ├── composables/           # 会话 / 角色 / 主题 / 弹窗等组合式函数
│   ├── config/                # 常量再导出 + 各角色导航配置
│   └── styles/                # tokens.css + dark.css + role-ui.css
├── build/                     # 打包资源（icon.ico）
├── .github/workflows/release.yml  # 自动构建发布
├── vite.config.mjs            # Vite 配置（含 shared/ CJS→ESM 转换）
├── package.json
└── index.html                 # 入口 HTML（首帧主题防闪烁）
```

## 自动更新与发布

- 应用内更新：检查 / 下载 / 安装（electron-updater，下载由用户触发，不静默自动下载）；更新源为 GitHub Release（`yconghua/grad-studio`）。开发模式读取 `dev-app-update.yml`，打包后自动读取内置 `app-update.yml`。
- CI/CD（`.github/workflows/release.yml`）：推送 main 分支或手动触发时，读取 package.json 版本号；若该版本 tag 不存在则自动打 tag，在 Windows 上构建 NSIS 安装包并上传 GitHub Release（变更说明自动生成）。版本号未变化时自动跳过。

## 安全设计

- 渲染层隔离：contextIsolation + 无 nodeIntegration，仅暴露白名单 API。
- 密码安全：bcrypt 哈希存储与比对，日志对 password 类字段脱敏；默认密码首次登录强制修改。
- 权限校验：所有业务操作以主进程会话为准做角色与归属校验（如学生只能操作本人周报、导师只能批阅名下学生、组管只能管理本组）。
- 注入防护：SQL 表名 / 列名统一反引号转义，数据走参数化查询；自定义协议按 basename 限制文件访问。
- 连接管理：密码不出现在前端列表与导出结果中（仅 hasPassword 标记）。

## 许可证

MIT © yconghua
