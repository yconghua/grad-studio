# 课题组科研管理平台（grad-studio）

课题组协作，最怕信息散落、进度靠问。这套系统把组会、课题、周报、文献、成果放进同一个平台：导师随时批阅点评，学生按节点记录推进，进度一目了然；组管统筹全组，超管总览全局。数据存本地、默认不联网，部署简单、开箱即用。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 桌面壳 | Electron（contextIsolation，无 nodeIntegration） |
| 前端 | Vue 3 + Vue Router + Vite |
| 数据库 | MySQL（mysql2，主进程直连，自动建库建表） |
| 安全 | bcryptjs |

---

MIT © yconghua
