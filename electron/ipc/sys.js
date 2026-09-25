/**
 * 路由层（IPC Layer）—— 系统管理相关路由（sys:* 前缀）
 *
 * 本模块负责「系统设置 / 数据库管理」两类前端能力：
 *   - 系统信息与运行环境：sys:info / sys:clear-cache / sys:user-data-path / sys:open-user-data-dir / sys:app-path / sys:open-app-dir / sys:open-devtools / sys:check-update
 *   - 数据库管理：sys:db-info / sys:tables-info / sys:db-connections / sys:switch-db / sys:add-db / sys:delete-db / sys:export-db
 * 路由只做转发与必要的登录态判定（sys:info 等需登录，sys:db-info 不要求登录供登录页展示），真正的业务落到 connectionService；
 * 系统名称 / 版本号来自 package.json（写活不硬编码）。不在此处写 SQL。
 */
const path = require('node:path')
const os = require('node:os')
const fs = require('node:fs')
const { app, session, shell, dialog, BrowserWindow } = require('electron')
// 读取 package.json，供「系统管理」展示系统名称 / 版本号 / 发布日期
const appPkg = require('../../package.json')
const connectionService = require('../services/connectionService')
const authService = require('../services/authService')

// 应用启动时间戳：模块加载时机≈主进程启动，供「运行时长」计算
const STARTED_AT = Date.now()

// ===== 手动检查更新（版本更新源配置）=====
// 框架源码会分发给使用者各自发布：把下面 owner/repo 改成自己的 GitHub 仓库即可，
// 「系统管理 → 关于 → 版本号（检查更新）」会指向该仓库的 GitHub Releases。
// 注意：
//   1. 该仓库必须为【公开】仓库——检查更新通过 GitHub 匿名只读 API 拉取最新 Release，
//      私有仓库匿名访问会返回 404（如需私有仓库支持，需另行扩展携带 Token 的请求头）；
//   2. 发布新版本前，先把 package.json 的 version 升上去再推送 main，触发自动打包发版。
const UPDATE_REPO = 'yconghua/grad-studio'
// 请求超时兜底：国内直连 GitHub 不稳定，超时即返回「检查失败」，不阻塞界面
const UPDATE_TIMEOUT_MS = 8000

// 语义化版本三段比较：a > b 返回 1，a < b 返回 -1，相等返回 0。
// 不能直接用字符串比较（如 '3.10.10' < '3.10.5' 会误判）；容忍可选的 v 前缀（如 v3.10.5）。
function compareVersions(a, b) {
  const pa = String(a).replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0)
  const pb = String(b).replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }
  return 0
}

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
  // 不清理 localStorage（属渲染层数据），由前端按需处理。
  ipcMain.handle('sys:clear-cache', async () => {
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

  // 手动检查更新：查 GitHub Releases 最新版，与本地版本号（package.json）对比；需登录。
  // 只读请求公网 API，不做任何下载 / 执行；渲染层拿结果后自行引导用户去下载页。
  ipcMain.handle('sys:check-update', async () => {
    if (!authService.getCurrentUser()) {
      return { success: false, message: '未登录，请重新登录' }
    }
    const current = appPkg.version
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), UPDATE_TIMEOUT_MS)
    try {
      const res = await fetch(
        `https://api.github.com/repos/${UPDATE_REPO}/releases/latest`,
        {
          signal: controller.signal,
          headers: {
            'User-Agent': 'grad-studio-update-check',
            Accept: 'application/vnd.github+json'
          }
        }
      )
      if (res.status === 404) {
        // 常见原因：仓库为私有（匿名 API 不可见）或尚未发布过任何 Release
        return {
          success: false,
          message: '更新源不可用（HTTP 404）：请确认仓库已设为公开，且已发布过 GitHub Release'
        }
      }
      if (!res.ok) {
        return { success: false, message: `检查失败（服务器返回 ${res.status}），请稍后重试` }
      }
      const data = await res.json()
      // GitHub 自动打的 tag 形如 v3.10.5，去掉前缀 v 再比较
      const latest = String(data.tag_name || '').replace(/^v/i, '')
      const hasUpdate = Boolean(latest) && compareVersions(latest, current) > 0
      return {
        success: true,
        hasUpdate,
        current,
        latest,
        // 变更说明来自公网，前端只做纯文本渲染（不 v-html），此处已截断长度
        notes: String(data.body || '').slice(0, 2000),
        url: data.html_url || `https://github.com/${UPDATE_REPO}/releases/latest`
      }
    } catch (err) {
      const reason =
        err && err.name === 'AbortError' ? '请求超时' : err && err.message ? err.message : '网络异常'
      return { success: false, message: `检查失败：${reason}` }
    } finally {
      clearTimeout(timer)
    }
  })

  // 导出数据库备份：先弹「保存」对话框让用户选位置，再导出当前库为 SQL 文件；需登录
  ipcMain.handle('sys:export-db', async (event) => {
    if (!authService.getCurrentUser()) {
      return { success: false, message: '未登录，请重新登录' }
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

  // 查看数据表：当前库所有表 + 每张表字段与行数
  ipcMain.handle('sys:tables-info', async () => {
    try {
      return await connectionService.getTablesInfo()
    } catch (err) {
      console.error('[sys:tables-info] 未预期异常:', err)
      return { success: false, message: '查询失败，请稍后重试' }
    }
  })

  // 连接清单（脱敏，不含密码）
  ipcMain.handle('sys:db-connections', async () => {
    return { success: true, ...connectionService.list() }
  })

  // 切换当前生效连接
  ipcMain.handle('sys:switch-db', async (_evt, { id }) => {
    try {
      return await connectionService.switchConnection(id)
    } catch (err) {
      console.error('[sys:switch-db] 未预期异常:', err)
      return { success: false, message: '切换失败，请稍后重试' }
    }
  })

  // 新增连接
  ipcMain.handle('sys:add-db', async (_evt, payload) => {
    try {
      return await connectionService.add(payload)
    } catch (err) {
      console.error('[sys:add-db] 未预期异常:', err)
      return { success: false, message: '添加失败，请稍后重试' }
    }
  })

  // 删除连接
  ipcMain.handle('sys:delete-db', async (_evt, { id }) => {
    try {
      return await connectionService.remove(id)
    } catch (err) {
      console.error('[sys:delete-db] 未预期异常:', err)
      return { success: false, message: '删除失败，请稍后重试' }
    }
  })
}

module.exports = { register }
