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
const { app, BrowserWindow, Menu, ipcMain, shell, dialog, nativeImage, protocol, net } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { pathToFileURL } = require('node:url')
// 连接服务：启动时调用 init() 加载连接清单并注入连接池
const connectionService = require('./services/connectionService')
// 免密票据服务：启动时初始化密钥与票据（登录后切换账号用）
const ticketService = require('./services/ticketService')
// 任务定时扫描：到期/逾期/待验收超时提醒（应用 ready 后启动）
const taskScheduler = require('./services/taskScheduler')
// 路由聚合：一行注册全部 auth:* / sys:* 等 IPC 接口
const { registerAll } = require('./ipc')

const isDev = !app.isPackaged
const DEV_URL = 'http://localhost:5173'

// 自定义协议：gradapp://uploads/<文件名> → 用户数据目录 uploads/ 下的文件，
// 供渲染层在 http / file 页面加载本地头像等附件，规避 file:// 跨协议拦截
protocol.registerSchemesAsPrivileged([
  { scheme: 'gradapp', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
])

// 解析窗口 / 程序图标：复用 build/icon.ico（缺失时回退到系统默认）
function resolveIcon() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.ico')
  return fs.existsSync(iconPath) ? iconPath : undefined
}

/** 创建主窗口：固定 1100×750，不可缩放、不可最大化、居中 */
// 关闭确认标志：用户已确认退出后放行 close，避免二次弹窗；窗口销毁后重置，保证新窗口仍提示
let isQuitting = false
function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    resizable: false, // 禁止拖拽缩放边框
    maximizable: false, // 禁止最大化
    center: true, // 启动时居中
    show: false,
    icon: resolveIcon(),
    title: '',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // 拦截标题栏 × / Alt+F4：登录页直接关闭；登录后的页面弹原生确认框，确认后再真正关闭
  win.on('close', async (e) => {
    if (isQuitting) return
    // 登录页无会话可退出，直接放行不提示（hash 路由：#/login）
    if (win.webContents.getURL().includes('#/login')) return
    e.preventDefault()
    // 自定义弹窗图标：复用应用图标（build/icon.ico），缺失时由系统默认展示
    const iconPath = resolveIcon()
    const { response } = await dialog.showMessageBox(win, {
      type: 'question',
      icon: iconPath ? nativeImage.createFromPath(iconPath) : undefined,
      title: '确认退出',
      message: '确定要退出 grad.studio 吗？',
      detail: '退出后需重新打开应用才能继续使用。',
      buttons: ['取消', '退出'],
      defaultId: 0,
      cancelId: 0
    })
    if (response === 1) {
      isQuitting = true
      win.destroy() // 直接销毁，不再次触发 close 事件，避免循环弹窗
    }
  })

  // 阻止页面 <title> 覆盖窗口标题，保持标题栏空白
  win.on('page-title-updated', (e) => e.preventDefault())

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

  // 渲染进程 console 转发到主进程终端（开发诊断用，无需 DevTools）：
  // 兼容 Electron 新旧两代事件签名（旧：level/message/line/sourceId 分参数；新：details 对象）
  const CONSOLE_LEVELS = ['verbose', 'info', 'warning', 'error', 'debug']
  win.webContents.on('console-message', (_evt, ...args) => {
    const d = args[0] && typeof args[0] === 'object' ? args[0] : null
    const rawLevel = d ? d.level : args[1]
    const message = d ? d.message : args[2]
    const line = d ? d.lineNumber : args[3]
    const source = d ? d.sourceId : args[4]
    const level = typeof rawLevel === 'number' ? CONSOLE_LEVELS[rawLevel] || rawLevel : rawLevel
    console.log(`[renderer:${level}] ${message} (${source}:${line})`)
  })

  // 渲染进程异常退出 / 无响应也输出到终端
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[renderer-gone]', details && details.reason)
  })
  win.webContents.on('unresponsive', () => {
    console.error('[renderer] 页面无响应')
  })

  win.on('closed', () => {
    // 仅单窗口应用，关闭即清空引用
    // 窗口销毁后重置关闭确认标志，macOS 经 activate 重建的新窗口仍会弹出确认
    isQuitting = false
  })
}

app.whenReady().then(() => {
  // 移除窗口自带的菜单栏（文件 / 编辑 / 视图等那一行）
  Menu.setApplicationMenu(null)
  // 注册 gradapp 协议：仅映射用户数据目录 uploads/ 内的文件，basename 防路径穿越
  const uploadsDir = path.join(app.getPath('userData'), 'uploads')
  protocol.handle('gradapp', (request) => {
    const name = decodeURIComponent(new URL(request.url).pathname.replace(/^\//, ''))
    const filePath = path.join(uploadsDir, path.basename(name))
    if (!fs.existsSync(filePath)) return new Response('Not Found', { status: 404 })
    return net.fetch(pathToFileURL(filePath).toString())
  })
  // 初始化连接服务（加载连接清单、建立连接池）——须在 app ready 之后
  connectionService.init()
  // 初始化免密票据服务（加载本机密钥与票据表）
  ticketService.init()
  // 注册全部 IPC 路由（auth: / sys: 等），渲染层即可通信
  registerAll(require('electron').ipcMain)
  // 启动任务定时扫描（数据库未配置时内部自动跳过）
  taskScheduler.start()
  // 创建窗口
  createWindow()
})

// 应用退出前停止任务定时扫描
app.on('will-quit', () => {
  taskScheduler.stop()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
