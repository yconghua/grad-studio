/**
 * 路由层（IPC Layer）—— 系统管理相关路由（sys:* 前缀）
 *
 * 本模块负责「系统设置 / 数据库管理」两类前端能力：
 *   - 系统信息与运行环境：sys:info / sys:clear-cache / sys:user-data-path / sys:open-user-data-dir / sys:app-path / sys:open-app-dir / sys:open-devtools / sys:check-update / sys:update-install / sys:uninstall
 *   - 数据库管理：sys:db-info / sys:tables-info / sys:db-connections / sys:switch-db / sys:add-db / sys:delete-db / sys:export-db
 * 路由只做转发与必要的登录态判定（sys:info 等需登录，sys:db-info 不要求登录供登录页展示），真正的业务落到 connectionService；
 * 系统名称 / 版本号来自 package.json（写活不硬编码）。不在此处写 SQL。
 */
const path = require('node:path')
const os = require('node:os')
const fs = require('node:fs')
const { spawn } = require('node:child_process')
const { app, session, shell, dialog, BrowserWindow } = require('electron')
// 读取 package.json，供「系统管理」展示系统名称 / 版本号 / 发布日期
const appPkg = require('../../package.json')
const connectionService = require('../services/connectionService')
const authService = require('../services/authService')
const systemParamRepository = require('../db/repositories/systemParamRepository')
const updateService = require('../services/updateService')

const DEFAULT_APP_NAME = '课题组科研管理平台'

// 应用启动时间戳：模块加载时机≈主进程启动，供「运行时长」计算
const STARTED_AT = Date.now()

// ===== 自动更新 =====
// 更新源（GitHub Releases）配置在 package.json 的 build.publish（owner/repo），
// 由 electron-updater 统一驱动检查、下载、安装，路由见 sys:check-update / sys:update-install。

// 注册所有 sys:* 路由。ipcMain 由 main.js 传入。
function register(ipcMain) {
  // 系统信息（系统名称 / 版本号 / 发布日期 / 启动时间 / 运行环境；需登录）
  ipcMain.handle('sys:info', async () => {
    if (!authService.getCurrentUser()) {
      return { success: false, message: '未登录，请重新登录' }
    }
    return {
      success: true,
      name: (appPkg.build && appPkg.build.productName) || appPkg.name,
      version: appPkg.version,
      releaseDate: appPkg.releaseDate || '',
      startedAt: STARTED_AT,
      platform: `${os.type()} ${os.release()}`,
      nodeVersion: process.versions.node,
      electronVersion: process.versions.electron
    }
  })

  // 清理本地缓存：HTTP 会话缓存 + 磁盘缓存目录（Cache / GPUCache / Code Cache 等）。
  // 不清理 localStorage（属渲染层数据），由前端按需处理。需登录。
  ipcMain.handle('sys:clear-cache', async () => {
    if (!authService.getCurrentUser()) {
      return { success: false, message: '未登录，请重新登录' }
    }
    try {
      await session.defaultSession.clearCache()
      const userData = app.getPath('userData')
      const cacheDirs = [
        'Cache',
        'GPUCache',
        'Code Cache',
        'DawnCache',
        'DawnGraphiteCache',
        'DawnWebGPUCache',
        'GraphiteDawnCache',
        'ShaderCache'
      ]
      for (const dir of cacheDirs) {
        try {
          fs.rmSync(path.join(userData, dir), { recursive: true, force: true })
        } catch (e) {
          // 单个缓存目录可能被占用（如 Windows 上 Code Cache），跳过不阻塞整体
        }
      }
      return { success: true, message: '缓存已清理' }
    } catch (err) {
      console.error('[sys:clear-cache] 未预期异常:', err)
      return { success: false, message: '清理失败，请稍后重试' }
    }
  })

  // 用户数据目录（userData）路径；需登录，供「系统管理」展示
  ipcMain.handle('sys:user-data-path', async () => {
    if (!authService.getCurrentUser()) {
      return { success: false, message: '未登录，请重新登录' }
    }
    return { success: true, path: app.getPath('userData') }
  })

  // 用系统文件管理器打开用户数据目录；需登录
  ipcMain.handle('sys:open-user-data-dir', async () => {
    if (!authService.getCurrentUser()) {
      return { success: false, message: '未登录，请重新登录' }
    }
    try {
      const dir = app.getPath('userData')
      const errorMessage = await shell.openPath(dir)
      if (errorMessage) {
        return { success: false, message: `打开失败：${errorMessage}` }
      }
      return { success: true, message: '已打开目录', path: dir }
    } catch (err) {
      console.error('[sys:open-user-data-dir] 未预期异常:', err)
      return { success: false, message: '打开失败，请稍后重试' }
    }
  })

  // 程序文件所在目录（安装后的 exe 所在目录）路径；需登录，供「系统管理」展示。
  // 注意用 path.dirname(app.getPath('exe')) 而非 app.getAppPath()：后者打包后指向 app.asar，不是安装目录。
  ipcMain.handle('sys:app-path', async () => {
    if (!authService.getCurrentUser()) {
      return { success: false, message: '未登录，请重新登录' }
    }
    return { success: true, path: path.dirname(app.getPath('exe')) }
  })

  // 用系统文件管理器打开程序文件所在目录；需登录
  ipcMain.handle('sys:open-app-dir', async () => {
    if (!authService.getCurrentUser()) {
      return { success: false, message: '未登录，请重新登录' }
    }
    try {
      const dir = path.dirname(app.getPath('exe'))
      const errorMessage = await shell.openPath(dir)
      if (errorMessage) {
        return { success: false, message: `打开失败：${errorMessage}` }
      }
      return { success: true, message: '已打开目录', path: dir }
    } catch (err) {
      console.error('[sys:open-app-dir] 未预期异常:', err)
      return { success: false, message: '打开失败，请稍后重试' }
    }
  })

  // 打开开发者控制台（DevTools）：detach 独立窗口弹出，方便查看日志 / 网络请求与调试；需登录。
  // 通过 event.sender 反查窗口，不依赖全局窗口引用（与 sys:export-db 同款做法）。
  ipcMain.handle('sys:open-devtools', (event) => {
    if (!authService.getCurrentUser()) {
      return { success: false, message: '未登录，请重新登录' }
    }
    const win = event && event.sender ? BrowserWindow.fromWebContents(event.sender) : null
    if (!win) {
      return { success: false, message: '未找到当前窗口，请重试' }
    }
    win.webContents.openDevTools({ mode: 'detach' })
    return { success: true, message: '控制台已打开' }
  })

  // 检查更新并自动下载：由 electron-updater 驱动，更新源为 package.json build.publish 的 GitHub 仓库。
  // 发现新版本时后台自动下载；下载进度 / 完成 / 出错通过 update:state 事件推送给渲染层。
  ipcMain.handle('sys:check-update', async () => {
    if (!authService.getCurrentUser()) {
      return { success: false, message: '未登录，请重新登录' }
    }
    return await updateService.checkForUpdates()
  })

  // 下载完成后安装并重启：静默安装到首次安装目录（NSIS 安装器从注册表恢复原安装位置），装完自动拉起新版本。
  ipcMain.handle('sys:update-install', async () => {
    if (!authService.getCurrentUser()) {
      return { success: false, message: '未登录，请重新登录' }
    }
    return updateService.quitAndInstall()
  })

  // 打开外部链接（仅允许 GitHub 域名与已配置更新镜像域名）：供用户需要时手动前往 Release 下载页兜底；需登录。
  // 白名单校验由 updateService.isAllowedExternalUrl 统一提供（与更新通道配置同源），避免被用于任意外链跳转。
  ipcMain.handle('sys:open-external', async (_evt, payload) => {
    if (!authService.getCurrentUser()) {
      return { success: false, message: '未登录，请重新登录' }
    }
    const url = payload && payload.url
    if (!updateService.isAllowedExternalUrl(url)) {
      return { success: false, message: '链接不合法' }
    }
    try {
      await shell.openExternal(url)
      return { success: true, message: '已打开' }
    } catch (err) {
      console.error('[sys:open-external] 未预期异常:', err)
      return { success: false, message: '打开链接失败，请重试' }
    }
  })

  // 导出数据库备份：先弹「保存」对话框让用户选位置，再导出当前库为 SQL 文件；仅超级管理员
  ipcMain.handle('sys:export-db', async (event) => {
    if (!authService.getCurrentUser()) {
      return { success: false, message: '未登录，请重新登录' }
    }
    if (!authService.isAdmin()) {
      return { success: false, message: '无权限：仅超级管理员可导出数据库备份' }
    }
    const meta = connectionService.getActiveMeta()
    if (!meta.database) {
      return { success: false, message: '未配置数据库连接，无法导出' }
    }
    // 默认文件名：库名_backup_时间戳.sql
    const d = new Date()
    const pad2 = (n) => String(n).padStart(2, '0')
    const stamp =
      `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}` +
      `_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`
    const win = event && event.sender ? BrowserWindow.fromWebContents(event.sender) : null
    const options = {
      title: '导出数据库备份',
      defaultPath: `${meta.database}_backup_${stamp}.sql`,
      filters: [{ name: 'SQL 备份文件', extensions: ['sql'] }]
    }
    let picked
    try {
      picked = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
    } catch (err) {
      console.error('[sys:export-db] 保存对话框异常:', err)
      return { success: false, message: '打开保存窗口失败，请重试' }
    }
    if (!picked || picked.canceled || !picked.filePath) {
      return { success: false, canceled: true, message: '已取消导出' }
    }
    try {
      return await connectionService.exportDatabase(picked.filePath)
    } catch (err) {
      console.error('[sys:export-db] 未预期异常:', err)
      return { success: false, message: '导出失败，请稍后重试' }
    }
  })

  // 选择附件文件：弹出打开对话框，把所选文件复制到用户数据目录 uploads/ 后返回存储路径与原始文件名；需登录。
  // 存副本而非直接存原路径：原文件可能被移动 / 删除，复制后可长期保留。
  ipcMain.handle('sys:pick-attachment', async (event) => {
    if (!authService.getCurrentUser()) {
      return { success: false, message: '未登录，请重新登录' }
    }
    const win = event && event.sender ? BrowserWindow.fromWebContents(event.sender) : null
    let picked
    try {
      const options = {
        title: '选择附件',
        properties: ['openFile'],
        filters: [
          { name: '常用文件', extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'zip', 'png', 'jpg', 'jpeg'] },
          { name: '所有文件', extensions: ['*'] }
        ]
      }
      picked = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    } catch (err) {
      console.error('[sys:pick-attachment] 打开对话框异常:', err)
      return { success: false, message: '打开选择窗口失败，请重试' }
    }
    if (!picked || picked.canceled || !picked.filePaths || !picked.filePaths.length) {
      return { success: false, canceled: true, message: '已取消选择' }
    }
    const src = picked.filePaths[0]
    try {
      const uploadsDir = path.join(app.getPath('userData'), 'uploads')
      fs.mkdirSync(uploadsDir, { recursive: true })
      const base = path.basename(src)
      const d = new Date()
      const pad2 = (n) => String(n).padStart(2, '0')
      const stamp = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`
      const dest = path.join(uploadsDir, `${stamp}_${base}`)
      fs.copyFileSync(src, dest)
      return { success: true, path: dest, name: base }
    } catch (err) {
      console.error('[sys:pick-attachment] 复制附件失败:', err)
      return { success: false, message: '附件保存失败，请重试' }
    }
  })

  // 打开附件：用系统默认程序打开（仅允许打开用户数据目录 uploads 内的文件，避免任意路径访问）；需登录
  ipcMain.handle('sys:open-attachment', async (_evt, payload) => {
    if (!authService.getCurrentUser()) {
      return { success: false, message: '未登录，请重新登录' }
    }
    const filePath = payload && payload.path
    if (!filePath || typeof filePath !== 'string') {
      return { success: false, message: '缺少附件路径' }
    }
    const uploadsDir = path.join(app.getPath('userData'), 'uploads')
    const resolved = path.resolve(filePath)
    if (!resolved.startsWith(uploadsDir)) {
      return { success: false, message: '附件路径不合法' }
    }
    if (!fs.existsSync(resolved)) {
      return { success: false, message: '附件文件不存在（可能已被移动或删除）' }
    }
    try {
      const errorMessage = await shell.openPath(resolved)
      if (errorMessage) {
        return { success: false, message: `打开失败：${errorMessage}` }
      }
      return { success: true, message: '已打开附件' }
    } catch (err) {
      console.error('[sys:open-attachment] 未预期异常:', err)
      return { success: false, message: '打开失败，请重试' }
    }
  })

  // 公开应用信息（无需登录）：读取 system_param 中 app_name 参数，供登录页 / 主界面品牌名使用。
  // 数据库未连接或参数不存在时回退默认名，不报错。
  ipcMain.handle('sys:get-public-info', async () => {
    let appName = DEFAULT_APP_NAME
    try {
      const row = await systemParamRepository.findByKey('app_name')
      if (row && row.param_value && String(row.param_value).trim()) {
        appName = String(row.param_value).trim()
      }
    } catch (err) {
      // 数据库未连接 / 表不存在时静默回退默认名
    }
    return { success: true, appName }
  })

  // 当前生效数据库信息 + 实时连接状态（SELECT 1 探活）；不要求登录，供登录页「系统设置」展示
  ipcMain.handle('sys:db-info', async () => {
    const cfg = connectionService.getActiveConfig()
    const meta = connectionService.getActiveMeta()
    // 未配置任何数据库连接：直接标记未连接，不再尝试建连
    if (!cfg) {
      return { success: true, ...meta, status: 'disconnected', error: '未配置数据库连接' }
    }
    const test = await connectionService.ping(cfg)
    if (test.ok) {
      return { success: true, ...meta, status: 'connected' }
    }
    return { success: true, ...meta, status: 'disconnected', error: test.message }
  })

  // 查看数据表：当前库所有表 + 每张表字段与行数。仅登录页（未登录）配置数据库时可用。
  ipcMain.handle('sys:tables-info', async () => {
    if (authService.getCurrentUser()) {
      return { success: false, message: '已登录状态下不可查看数据库配置，请退出登录后在登录页操作' }
    }
    try {
      return await connectionService.getTablesInfo()
    } catch (err) {
      console.error('[sys:tables-info] 未预期异常:', err)
      return { success: false, message: '查询失败，请稍后重试' }
    }
  })

  // 连接清单（脱敏，不含密码）。仅登录页（未登录）配置数据库时可用。
  ipcMain.handle('sys:db-connections', async () => {
    if (authService.getCurrentUser()) {
      return { success: false, message: '已登录状态下不可查看数据库连接，请退出登录后在登录页操作' }
    }
    return { success: true, ...connectionService.list() }
  })

  // 切换当前生效连接。仅登录页（未登录）配置数据库时可用。
  ipcMain.handle('sys:switch-db', async (_evt, { id }) => {
    if (authService.getCurrentUser()) {
      return { success: false, message: '已登录状态下不可切换数据库连接，请退出登录后在登录页操作' }
    }
    try {
      return await connectionService.switchConnection(id)
    } catch (err) {
      console.error('[sys:switch-db] 未预期异常:', err)
      return { success: false, message: '切换失败，请稍后重试' }
    }
  })

  // 新增连接。仅登录页（未登录）配置数据库时可用。
  ipcMain.handle('sys:add-db', async (_evt, payload) => {
    if (authService.getCurrentUser()) {
      return { success: false, message: '已登录状态下不可新增数据库连接，请退出登录后在登录页操作' }
    }
    try {
      return await connectionService.add(payload)
    } catch (err) {
      console.error('[sys:add-db] 未预期异常:', err)
      return { success: false, message: '添加失败，请稍后重试' }
    }
  })

  // 删除连接。仅登录页（未登录）配置数据库时可用。
  ipcMain.handle('sys:delete-db', async (_evt, { id }) => {
    if (authService.getCurrentUser()) {
      return { success: false, message: '已登录状态下不可删除数据库连接，请退出登录后在登录页操作' }
    }
    try {
      return await connectionService.remove(id)
    } catch (err) {
      console.error('[sys:delete-db] 未预期异常:', err)
      return { success: false, message: '删除失败，请稍后重试' }
    }
  })

  // 卸载应用：启动安装器生成的 NSIS 卸载程序后退出；需登录。
  // 卸载器（Uninstall grad_studio.exe）由安装包在安装时写入安装目录，开发模式（未打包）下不存在。
  // 以 detached 方式启动后不随本进程退出而终止；用 app.exit 直接退出，绕开窗口关闭确认框。
  ipcMain.handle('sys:uninstall', async () => {
    if (!authService.getCurrentUser()) {
      return { success: false, message: '未登录，请重新登录' }
    }
    if (!app.isPackaged) {
      return { success: false, message: '开发模式下无法卸载，请使用打包安装后的版本' }
    }
    const uninstaller = path.join(path.dirname(app.getPath('exe')), 'Uninstall grad_studio.exe')
    if (!fs.existsSync(uninstaller)) {
      return { success: false, message: `未找到卸载程序：${uninstaller}` }
    }
    try {
      const child = spawn(uninstaller, [], { detached: true, stdio: 'ignore' })
      child.unref()
      // 稍作延迟再退出，确保卸载程序已启动
      setTimeout(() => app.exit(0), 500)
      return { success: true, message: '正在启动卸载程序…' }
    } catch (err) {
      console.error('[sys:uninstall] 未预期异常:', err)
      return { success: false, message: '启动卸载程序失败，请稍后重试' }
    }
  })
}

module.exports = { register }
