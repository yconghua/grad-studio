# grad-studio 扫码登录确认服务

桌面应用扫码登录的**确认服务**：签发二维码 ticket、托管手机确认页、中转账号密码凭据。
账号密码的校验由桌面端完成，本服务**不连接数据库**，凭据仅在内存短时保留、桌面端取走即清。

## 启动方式（两种，任选其一）

| 方式 | 适用场景 | 说明 |
|---|---|---|
| ① 桌面应用自动拉起（推荐） | 新电脑只安装桌面程序、零依赖 | 打包版应用在用户**进入扫码登录时**自动用 Electron 自带的 Node 运行时启动本服务（无需系统安装 Node），应用退出时自动停止；不是程序启动时默认常驻 |
| ② 独立手动启动 | 开发调试 / 服务器集中部署 | 在本目录执行 `node server.js`（或 `npm start`），默认监听 8787（`PORT` 环境变量可改） |

本目录可整体拷贝到任意机器独立运行（Node ≥ 18）。**若端口 8787 已被手动启动的实例占用，桌面端自动拉起时会直接复用该实例。**

## 支持的两种模式（手机与电脑必须在同一网络）

| 模式 | 使用场景 | 二维码内容 | 需要做的 |
|---|---|---|---|
| ① 局域网 | 电脑和手机连**同一个 WiFi** | `http://<电脑IP>:8787/scan/<ticket>` | 防火墙放行 8787 |
| ② 手机热点 | 电脑连手机热点，**另一台手机**扫码 | `http://<热点IP>:8787/scan/<ticket>` | 防火墙放行 8787 |

两种模式共用同一套逻辑：桌面端**自动探测电脑局域网 IPv4**，无需任何配置。
重连热点 / 换 WiFi 导致电脑 IP 变化时，重启应用即自动重新探测。

## 使用步骤

1. **打包版**：安装桌面程序 → 进入「扫码登录」→ 服务自动拉起，直接扫码即可；
2. **开发版**：`npm run dev` 启动应用 → 进入「扫码登录」→ 服务自动拉起；
3. **防火墙放行 8787**（手机才能访问电脑，管理员 PowerShell 执行一次即可）：
   ```
   netsh advfirewall firewall add rule name="grad-studio scan-server 8787" dir=in action=allow protocol=TCP localport=8787
   ```
4. 手机（同一 WiFi / 同一热点）扫码 → 确认页输账号密码 → 电脑端自动登录。

## 多网卡时的地址调整

电脑装有虚拟机（VMware/VirtualBox）或异地组网 VPN（ZeroTier/Tailscale）时，
自动探测可能选错网卡。查看应用终端 `[scan]` 日志的「本机局域网 IP 候选」列表，
若二维码地址不是目标网卡的 IP，可手动指定（Windows 用户需先设置用户环境变量）：

```powershell
setx SCAN_SERVER_BASE_URL "http://192.168.1.100:8787"
```

重启应用生效（环境变量优先级高于自动探测）。

## 验证链路

服务启动后，浏览器打开 `http://<电脑IP>:8787/health` 应返回 JSON：

```powershell
curl.exe http://127.0.0.1:8787/health
```

## 接口一览

| 接口 | 方法 | 说明 |
|---|---|---|
| `/api/scan/create` | POST | 签发 ticket，返回 `{ ticket }` |
| `/api/scan/status?ticket=` | GET | 状态查询（桌面端轮询 + 手机页共用） |
| `/api/scan/confirm` | POST | 手机端提交 `{ ticket, username, password }` |
| `/api/scan/credential?ticket=` | GET | 桌面端取凭据（一次性，取走即清） |
| `/api/scan/approve` | POST | 桌面端回填验证结果 `{ ticket, user? , error? }` |
| `/api/scan/deny` | POST | 手机端拒绝登录 |

## 安全说明

- 仅限**可信局域网**内使用（同一 WiFi / 个人热点），密码为局域网内明文传输；
- ticket 一次一码，TTL 120 秒；同一 ticket 最多提交 5 次凭据；
- 凭据取走即清、不落盘、不进日志。
