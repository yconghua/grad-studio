/**
 * Electron 主进程（兼后端）—— 瘦壳入口
 *
 * 本文件现在只负责三件事：
 *   1. 创建固定尺寸的登录 / 主窗口；
 *   2. 应用生命周期管理（ready / window-all-closed / activate）；
 *   3. 启动时初始化连接服务 + 注册全部 IPC 路由。
 *
 * 所有业务逻辑（连接配置 CRUD、会话、用户管理、系统信息）已下沉到：
 *   - services/connectionService.js  （连接配置业务）
 *   - services/authService.js        （会话与用户业务）
 * 所有路由注册（按 auth: / sys: 前缀）已下沉到：
 *   - ipc/auth.js / ipc/sys.js → 由 ipc/index.js 的 registerAll 聚合。
 *
 * 渲染层（Vue3）仍通过 preload 暴露的 window.api 与本进程通信，
 * 页面脚本拿不到 Node 能力（nodeIntegration:false + contextIsolation:true）。
 */
const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
// 连接服务：启动时调用 init() 加载连接清单并注入连接池
const connectionService = require('./services/connectionService')
// 路由聚合：一行注册全部 auth:* / sys:* 等 IPC 接口
const { registerAll } = require('./ipc')

const isDev = !app.isPackaged
const DEV_URL = 'http://localhost:5173'

// 解析窗口 / 程序图标：复用 build/icon.ico（缺失时回退到系统默认）
function resolveIcon() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.ico')
  return fs.existsSync(iconPath) ? iconPath : undefined
}

/** 创建主窗口：固定 1100×750，不可缩放、不可最大化、居中 */
function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    resizable: false, // 禁止拖拽缩放边框
    maximizable: false, // 禁止最大化
    center: true, // 启动时居中
    show: false,
    icon: resolveIcon(),
    title: '研究生工作室管理平台',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (isDev) {
    win.loadURL(`${DEV_URL}/#/login`)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/login' })
  }

  win.once('ready-to-show', () => win.show())

  // 外部链接（mailto / https 等）一律交给系统浏览器 / 邮件客户端打开，不弹新 Electron 窗口
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?:|mailto:)/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  win.on('closed', () => {
    // 仅单窗口应用，关闭即清空引用
  })
}

app.whenReady().then(() => {
  // 移除窗口自带的菜单栏（文件 / 编辑 / 视图等那一行）
  Menu.setApplicationMenu(null)
  // 初始化连接服务（加载连接清单、建立连接池）——须在 app ready 之后
  connectionService.init()
  // 注册全部 IPC 路由（auth: / sys: 等），渲染层即可通信
  registerAll(require('electron').ipcMain)
  // 创建窗口
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
