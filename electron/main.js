/**
 * Electron 主进程（兼后端）—— 瘦壳入口
 *
 * 本文件现在只负责三件事：
 *   1. 创建固定尺寸的登录 / 主窗口；
 *   2. 应用生命周期管理（ready / window-all-closed / activate）+ 单实例锁 + 系统托盘；
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
const { app, BrowserWindow, Menu, ipcMain, shell, nativeImage, protocol, net, Tray, screen } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { pathToFileURL } = require('node:url')
// 程序名称单一来源：package.json productName（与安装包产物名、system:info 的 programName 同源）
const appPkg = require('../package.json')
const PROGRAM_NAME = (appPkg.build && appPkg.build.productName) || appPkg.name
// 连接服务：启动时调用 init() 加载连接清单并注入连接池
const connectionService = require('./services/connectionService')
// 免密票据服务：启动时初始化密钥与票据（登录后切换账号用）
const ticketService = require('./services/ticketService')
// 任务定时扫描：到期/逾期/待验收超时提醒（应用 ready 后启动）
const taskScheduler = require('./services/taskScheduler')
const reportScheduler = require('./services/reportScheduler')
// 学业节点提醒：临近/逾期节点扫描（应用 ready 后启动，remind_at 去重）
const academicScheduler = require('./services/academicScheduler')
const loginLogScheduler = require('./services/loginLogScheduler')
// 待办提醒：到点提醒扫描（应用 ready 后启动，reminded_at 去重）
const todoScheduler = require('./services/todoScheduler')
// 全局数据版本轮询：业务表指纹变化时广播 db:changed（页面后台静默重拉）
const dataVersionService = require('./services/dataVersionService')
// 数据库连接状态：持续 SELECT 1 探测，未连接时登录页禁用登录表单（连接恢复自动解锁）
const dbStatusService = require('./services/dbStatusService')
// 登录会话 / 开机自启：托盘菜单动态展示账号与自启勾选
const authService = require('./services/authService')
const autoLaunchService = require('./services/autoLaunchService')
// scan-server 独立进程管理器：扫码登录时按需拉起，应用退出时停止
const scanServerManager = require('./services/scanServerManager')
// 文件日志：启动时 hook console 落盘 userData/logs/main.log（含轮转），排查问题用
const logService = require('./services/logService')
// 路由聚合：一行注册全部 auth:* / sys:* 等 IPC 接口
const { registerAll } = require('./ipc')

const isDev = !app.isPackaged
const DEV_URL = 'http://localhost:5173'

// Windows 任务栏 / 通知 / JumpList 按 AppUserModelID 识别应用：
// 不设置时系统回退到 exe 本身（开发模式为 electron.exe），右键菜单会显示默认 Electron 图标与名称。
// 必须在 app ready 之前调用，且与 package.json 的 build.appId 保持一致。
app.setAppUserModelId('com.grad.studio')

// 自定义协议：gradapp://uploads/<文件名> → 用户数据目录 uploads/ 下的文件，
// 供渲染层在 http / file 页面加载本地头像等附件，规避 file:// 跨协议拦截
protocol.registerSchemesAsPrivileged([
  { scheme: 'gradapp', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
])

// 解析窗口 / 程序 / 托盘图标：复用 build/icon.ico（缺失时回退到系统默认）
function resolveIcon() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.ico')
  return fs.existsSync(iconPath) ? iconPath : undefined
}

/** 创建主窗口：默认 1100×750，可缩放/最大化（最小尺寸兜底，页面不会比现状更挤） */
// 退出确认标志：托盘「退出」置位后放行 close；窗口销毁后重置，保证新窗口仍可正常关闭
let isQuitting = false
function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 1100,
    minHeight: 750,
    frame: false, // 无边框窗口：标题栏由渲染层 AppTitleBar 自绘（拖拽 + 最小化/最大化/关闭）
    resizable: true, // 允许缩放（含最大化），配合最小尺寸兜底
    maximizable: true,
    center: true, // 启动时居中
    show: false,
    icon: resolveIcon(),
    // 任务栏按钮显示的应用名；页面 <title> 更新被下方 page-title-updated 拦截，不会覆盖此值
    title: PROGRAM_NAME,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // 无边框窗口最大化默认铺满整屏（含任务栏）：收进主显示器工作区避免遮挡任务栏，
  // 并推送状态给渲染层（标题栏按钮切换还原图标）；还原时推送 false
  win.on('maximize', () => {
    const { workArea } = screen.getPrimaryDisplay()
    win.setBounds(workArea)
    win.webContents.send('win:maximized-changed', true)
  })
  win.on('unmaximize', () => {
    win.webContents.send('win:maximized-changed', false)
  })

  // 拦截标题栏 × / Alt+F4：登录页无会话直接关闭退出；登录后隐藏到系统托盘，应用后台驻留
  win.on('close', (e) => {
    if (isQuitting) return
    // 登录页无会话可退出，直接放行不提示（hash 路由：#/login）
    if (win.webContents.getURL().includes('#/login')) return
    e.preventDefault()
    win.hide()
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
    // 窗口销毁后重置退出标志，macOS 经 activate 重建的新窗口仍可正常关闭
    isQuitting = false
  })

  return win
}

// 系统托盘：按登录态 / 数据库状态 / 开机自启状态动态重建右键菜单
// 未登录：数据库状态 / 显示主窗口 / 开机启动 / 当前版本 / 退出
// 已登录：额外显示「当前账号：姓名（账户名）」
// 数据库未连接时点击该项 → 显示主窗口并通知登录页打开「基础配置」弹窗
let tray = null

function trayShowWindow(win) {
  if (!win || win.isDestroyed()) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

// 托盘菜单 label 宽度控制：按显示宽度截断（中文全角=2、ASCII=1），
// 动态文本（账号、数据库连接名）超长时截断加省略号，保证菜单宽度固定不撑宽
const MAX_TRAY_LABEL_WIDTH = 20 // 半角单位，约 10 个中文字符
function labelDisplayWidth(text) {
  let w = 0
  for (const ch of text) w += ch.charCodeAt(0) > 255 ? 2 : 1
  return w
}
function fitTrayLabel(text) {
  if (labelDisplayWidth(text) <= MAX_TRAY_LABEL_WIDTH) return text
  let s = text
  while (s.length && labelDisplayWidth(`${s}…`) > MAX_TRAY_LABEL_WIDTH) s = s.slice(0, -1)
  return `${s}…`
}

// 构建托盘右键菜单（每次调用都读最新状态：登录账号 / 数据库连接 / 开机自启 / 版本号）
// 数据库未连接时可点击 → 显示主窗口并通知登录页打开「基础配置」弹窗
function buildTrayMenu() {
  const win = BrowserWindow.getAllWindows()[0]
  const user = authService.getCachedUser()
  const db = dbStatusService.getStatus()
  const launch = autoLaunchService.getStatus()
  const template = []
  // 已登录：账号行（姓名（账户名）），仅展示；超长截断避免菜单过宽
  if (user) {
    template.push({ label: fitTrayLabel(`当前账号：${user.realName || user.username}（${user.username}）`), enabled: false })
  }
  template.push({ label: fitTrayLabel('显示主窗口'), click: () => trayShowWindow(win) })
  template.push({ type: 'separator' })
  // 数据库状态：未连接时可点击 → 显示主窗口并打开登录页基础配置弹窗
  if (db.connected) {
    const activeName = connectionService.getActiveName()
    // 连接名过长时截断展示（不显示全名），避免菜单被撑宽
    template.push({ label: fitTrayLabel(activeName ? `数据库：已连接（${activeName}）` : '数据库：已连接'), enabled: false })
  } else {
    template.push({
      label: fitTrayLabel('数据库：未连接（配置）'),
      click: () => {
        trayShowWindow(win)
        if (win && !win.isDestroyed()) win.webContents.send('tray:open-db-config')
      }
    })
  }
  template.push({ type: 'separator' })
  // 开机启动：用普通项 + 文字状态（不用 checkbox 类型，避免左侧复选框留白撑宽菜单）
  template.push({
    label: fitTrayLabel(`开机启动：${launch.enabled ? '已开启' : '已关闭'}`),
    click: () => {
      // setEnabled 为同步调用（返回状态对象），直接切换后重建菜单
      autoLaunchService.setEnabled(!launch.enabled)
      rebuildTrayMenu()
    }
  })
  template.push({ label: fitTrayLabel(`当前版本：v${app.getVersion()}`), enabled: false })
  template.push({ type: 'separator' })
  template.push({
    label: fitTrayLabel('退出'),
    click: () => {
      // 菜单点击即为明确退出意图，置位后放行 close，不再二次确认
      isQuitting = true
      app.quit()
    }
  })
  return Menu.buildFromTemplate(template)
}

// 同步刷新托盘已设置的菜单（登录/登出等事件时调用；右键时用 popUpContextMenu 手动弹出最新菜单，见 createTray）
function rebuildTrayMenu() {
  const iconPath = resolveIcon()
  if (!iconPath) return
  if (!tray) tray = new Tray(nativeImage.createFromPath(iconPath))
  tray.setToolTip(PROGRAM_NAME)
  tray.setContextMenu(buildTrayMenu())
}

function createTray() {
  rebuildTrayMenu()
  // 左键单击托盘：显示 / 恢复主窗口（已显示则聚焦）
  tray.on('click', () => trayShowWindow(BrowserWindow.getAllWindows()[0]))
  // 每次右键手动弹出刚构建的菜单（Windows 上 setContextMenu 的缓存菜单不会在右键时自动更新，
  // popUpContextMenu 保证弹出的菜单一定是最新状态——数据库连接状态实时反映）
  tray.on('right-click', () => tray.popUpContextMenu(buildTrayMenu()))
  // 数据库探测状态一变化即同步刷新缓存菜单：程序启动自检完成后（登录页药丸变绿的同时）、
  // 运行中连接断开/恢复，托盘菜单都会实时跟上，不依赖用户右键
  dbStatusService.onStatusChange(() => rebuildTrayMenu())
}

// 单实例锁：同一台电脑只允许运行一份程序；第二份启动时聚焦已有窗口后自动退出
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    } else {
      createWindow()
    }
  })

  app.whenReady().then(async () => {
    // 文件日志最先初始化：之后的全部 console 输出都会同时落盘
    logService.init()
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
    // 初始化连接服务（加载连接清单、建立连接池）；若检测到版本变化，
    // 会先同步等待升级迁移全部执行完再返回——之后的调度器与窗口首个查询
    // 一定发生在迁移完成之后，避免新表尚未建立时查询报错
    await connectionService.init()
    // 初始化免密票据服务（加载本机密钥与票据表）
    ticketService.init()
    // 注册全部 IPC 路由（auth: / sys: 等），渲染层即可通信；登录态变化时重建托盘菜单
    registerAll(require('electron').ipcMain, { rebuildTray: () => rebuildTrayMenu() })
    // 启动任务定时扫描（数据库未配置时内部自动跳过）
    taskScheduler.start()
    // 启动周报定时提醒（未交 / 批阅超时 / 打回未改）
    reportScheduler.start()
    // 启动学业节点提醒（临近 / 逾期未记录节点 → 通知学生与导师）
    academicScheduler.start()
    // 启动登录日志每日清理（按保留天数删除过期记录）
    loginLogScheduler.start()
    // 启动待办到点提醒（设了提醒且到点的待办 → 通知归属人）
    todoScheduler.start()
    // 启动全局数据版本轮询（业务表指纹变化 → 广播 db:changed，页面无感刷新）
    dataVersionService.start()
    // 启动数据库连接探测（先于窗口创建，登录页挂载即可读到真实连接状态）
    dbStatusService.start()
    // 创建窗口，并挂载系统托盘（初始为未登录菜单，登录后由 auth IPC 触发重建）
    const mainWin = createWindow()
    createTray()
  })

  // 应用退出前停止定时扫描与扫码服务子进程
  app.on('will-quit', () => {
    taskScheduler.stop()
    reportScheduler.stop()
    academicScheduler.stop()
    loginLogScheduler.stop()
    todoScheduler.stop()
    dataVersionService.stop()
    dbStatusService.stop()
    scanServerManager.stop()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}
