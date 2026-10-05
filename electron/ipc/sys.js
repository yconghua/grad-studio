/**
 * 路由层（IPC Layer）—— 系统基础设施路由（sys:* 前缀）
 *
 * 职责范围（与「系统配置页」的 system:* 区分开）：
 *   - 登录页可用的数据库连接管理：sys:db-info / sys:db-connections / sys:switch-db / sys:add-db / sys:delete-db / sys:tables-info；
 *   - 登录后基础设施能力：sys:info（系统信息）、sys:export-db（数据库备份）、
 *     sys:pick-attachment / sys:open-attachment（附件选择与打开）；
 *   - 登录页品牌名：sys:get-public-info。
 * 应用更新检查见 ipc/update.js（electron-updater 自动更新）。
 * 权限闸门按角色在前端对应页面内控制；导出备份额外校验仅超级管理员。
 */
const path = require('node:path')
const fs = require('node:fs')
const { app, shell, dialog, BrowserWindow } = require('electron')
const connectionService = require('../services/connectionService')
const dbStatusService = require('../services/dbStatusService')
const authService = require('../services/authService')
const systemService = require('../services/systemService')

// 默认系统名称（system_configs 参数缺失时回退）
const DEFAULT_APP_NAME = '千兆中心'

// 安全删除目录：Windows 下缓存文件可能被当前进程占用（EPERM/EBUSY），
// 逐个文件尝试删除，被占用的跳过并计数，不中断整体清理
async function safeRemoveDir(dir) {
  if (!fs.existsSync(dir)) return 0
  let failed = 0
  const entries = await fs.promises.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const p = path.join(dir, entry.name)
    try {
      if (entry.isDirectory()) failed += await safeRemoveDir(p)
      else await fs.promises.unlink(p)
    } catch (err) {
      if (err && (err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'ENOENT')) failed += 1
      else throw err
    }
  }
  try {
    await fs.promises.rmdir(dir)
  } catch (err) {
    if (err && (err.code === 'ENOTEMPTY' || err.code === 'EPERM' || err.code === 'EBUSY')) failed += 1
    else if (err && err.code !== 'ENOENT') throw err
  }
  return failed
}

function register(ipcMain) {
  // 系统信息（登录后可用，供「系统配置」页块 1 展示）
  ipcMain.handle('sys:info', async () => {
    const user = await authService.getCurrentUser()
    if (!user) {
      return { success: false, code: 401, message: '未登录，请重新登录' }
    }
    try {
      const info = await systemService.getInfo()
      return { success: true, code: 0, message: 'success', ...info }
    } catch (err) {
      console.error('[sys:info] 未预期异常:', err)
      return { success: false, code: 500, message: '读取系统信息失败' }
    }
  })

  // 公开应用信息（无需登录）：读取 system_configs 中 system.name / system.theme / 版本 / 简介，供登录页品牌名、标语与默认主题使用
  ipcMain.handle('sys:get-public-info', async () => {
    let appName = DEFAULT_APP_NAME
    let defaultTheme = 'system'
    let version = ''
    let introduction = ''
    try {
      const info = await systemService.getIntroduction()
      if (info && info.name) appName = info.name
      if (info && info.defaultTheme) defaultTheme = info.defaultTheme
      if (info && info.version) version = info.version
      if (info && info.introduction) introduction = info.introduction
    } catch (err) {
      // 数据库未连接 / 表不存在时静默回退默认值
    }
    return { success: true, code: 0, message: 'success', appName, defaultTheme, version, introduction }
  })

  // 当前生效数据库信息 + 实时连接状态（SELECT 1 探活）；不要求登录，供登录页「数据库」展示
  ipcMain.handle('sys:db-info', async () => {
    const cfg = connectionService.getActiveConfig()
    const meta = connectionService.getActiveMeta()
    if (!cfg) {
      return { success: true, code: 0, ...meta, status: 'disconnected', error: '未配置数据库连接' }
    }
    const test = await connectionService.ping(cfg)
    if (test.ok) {
      return { success: true, code: 0, ...meta, status: 'connected' }
    }
    return { success: true, code: 0, ...meta, status: 'disconnected', error: test.message }
  })

  // 数据库连接状态（dbStatusService 持续探测维护的实时快照）；不要求登录，
  // 供登录页在"未连接"时禁用登录表单，状态变化由主进程推送 db:status-changed
  ipcMain.handle('sys:db-status', async () => {
    const { connected, message } = dbStatusService.getStatus()
    return { success: true, code: 0, connected, message }
  })

  // 查看数据表：当前库所有表 + 每张表字段与行数。仅登录页（未登录）配置数据库时可用。
  ipcMain.handle('sys:tables-info', async () => {
    if (await authService.getCurrentUser()) {
      return { success: false, code: 403, message: '已登录状态下不可查看数据库配置，请退出登录后在登录页操作' }
    }
    try {
      return await connectionService.getTablesInfo()
    } catch (err) {
      console.error('[sys:tables-info] 未预期异常:', err)
      return { success: false, code: 500, message: '查询失败，请稍后重试' }
    }
  })

  // 连接清单（脱敏，不含密码）。仅登录页（未登录）配置数据库时可用。
  ipcMain.handle('sys:db-connections', async () => {
    if (await authService.getCurrentUser()) {
      return { success: false, code: 403, message: '已登录状态下不可查看数据库连接，请退出登录后在登录页操作' }
    }
    return { success: true, code: 0, ...connectionService.list() }
  })

  // 切换当前生效连接。仅登录页（未登录）配置数据库时可用。
  ipcMain.handle('sys:switch-db', async (_evt, payload) => {
    if (await authService.getCurrentUser()) {
      return { success: false, code: 403, message: '已登录状态下不可切换数据库连接，请退出登录后在登录页操作' }
    }
    try {
      return await connectionService.switchConnection(payload && payload.id)
    } catch (err) {
      console.error('[sys:switch-db] 未预期异常:', err)
      return { success: false, code: 500, message: '切换失败，请稍后重试' }
    }
  })

  // 新增连接。仅登录页（未登录）配置数据库时可用。
  ipcMain.handle('sys:add-db', async (_evt, payload) => {
    if (await authService.getCurrentUser()) {
      return { success: false, code: 403, message: '已登录状态下不可新增数据库连接，请退出登录后在登录页操作' }
    }
    try {
      return await connectionService.add(payload || {})
    } catch (err) {
      console.error('[sys:add-db] 未预期异常:', err)
      return { success: false, code: 500, message: '添加失败，请稍后重试' }
    }
  })

  // 批量导入数据库连接（渲染层完成 JSON Lines txt 解析后传入对象数组）。仅登录页（未登录）配置数据库时可用。
  ipcMain.handle('sys:import-db', async (_evt, payload) => {
    if (await authService.getCurrentUser()) {
      return { success: false, code: 403, message: '已登录状态下不可导入数据库连接，请退出登录后在登录页操作' }
    }
    try {
      return await connectionService.importMany(payload && payload.list)
    } catch (err) {
      console.error('[sys:import-db] 未预期异常:', err)
      return { success: false, code: 500, message: '导入失败，请稍后重试' }
    }
  })

  // 下载批量导入示例 TXT：弹保存对话框写入 JSON Lines 模板。仅登录页（未登录）配置数据库时可用。
  ipcMain.handle('sys:export-db-template', async (event) => {
    if (await authService.getCurrentUser()) {
      return { success: false, code: 403, message: '已登录状态下不可下载模板，请退出登录后在登录页操作' }
    }
    const win = event && event.sender ? BrowserWindow.fromWebContents(event.sender) : null
    const options = {
      title: '保存批量导入示例',
      defaultPath: 'db-connections-template.txt',
      filters: [{ name: '文本文件', extensions: ['txt'] }]
    }
    let picked
    try {
      picked = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
    } catch (err) {
      console.error('[sys:export-db-template] 保存对话框异常:', err)
      return { success: false, code: 500, message: '打开保存窗口失败，请重试' }
    }
    if (!picked || picked.canceled || !picked.filePath) {
      return { success: false, code: 0, canceled: true, message: '已取消保存' }
    }
    try {
      fs.writeFileSync(picked.filePath, connectionService.DB_IMPORT_TEMPLATE, 'utf8')
      return { success: true, code: 0, message: '示例 TXT 已保存' }
    } catch (err) {
      console.error('[sys:export-db-template] 写入模板失败:', err)
      return { success: false, code: 500, message: '保存失败，请重试' }
    }
  })

  // 删除连接。仅登录页（未登录）配置数据库时可用。
  ipcMain.handle('sys:delete-db', async (_evt, payload) => {
    if (await authService.getCurrentUser()) {
      return { success: false, code: 403, message: '已登录状态下不可删除数据库连接，请退出登录后在登录页操作' }
    }
    try {
      return await connectionService.remove(payload && payload.id)
    } catch (err) {
      console.error('[sys:delete-db] 未预期异常:', err)
      return { success: false, code: 500, message: '删除失败，请稍后重试' }
    }
  })

  // 导出数据库备份：先弹「保存」对话框让用户选位置，再导出当前库为 SQL 文件；仅超级管理员
  ipcMain.handle('sys:export-db', async (event) => {
    const user = await authService.getCurrentUser()
    if (!user) {
      return { success: false, code: 401, message: '未登录，请重新登录' }
    }
    if (user.role !== 'super_admin') {
      return { success: false, code: 403, message: '无权限：仅超级管理员可导出数据库备份' }
    }
    const meta = connectionService.getActiveMeta()
    if (!meta.database) {
      return { success: false, code: 400, message: '未配置数据库连接，无法导出' }
    }
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
      return { success: false, code: 500, message: '打开保存窗口失败，请重试' }
    }
    if (!picked || picked.canceled || !picked.filePath) {
      return { success: false, code: 0, canceled: true, message: '已取消导出' }
    }
    try {
      return await connectionService.exportDatabase(picked.filePath)
    } catch (err) {
      console.error('[sys:export-db] 未预期异常:', err)
      return { success: false, code: 500, message: '导出失败，请稍后重试' }
    }
  })

  // 选择附件文件：弹出打开对话框，把所选文件复制到用户数据目录 uploads/ 后返回存储路径与原始文件名；需登录
  ipcMain.handle('sys:pick-attachment', async (event) => {
    const user = await authService.getCurrentUser()
    if (!user) {
      return { success: false, code: 401, message: '未登录，请重新登录' }
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
      return { success: false, code: 500, message: '打开选择窗口失败，请重试' }
    }
    if (!picked || picked.canceled || !picked.filePaths || !picked.filePaths.length) {
      return { success: false, code: 0, canceled: true, message: '已取消选择' }
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
      return { success: true, code: 0, message: 'success', path: dest, name: base }
    } catch (err) {
      console.error('[sys:pick-attachment] 复制附件失败:', err)
      return { success: false, code: 500, message: '附件保存失败，请重试' }
    }
  })

  // 打开附件：用系统默认程序打开（仅允许打开用户数据目录 uploads 内的文件，避免任意路径访问）；需登录
  ipcMain.handle('sys:open-attachment', async (_evt, payload) => {
    const user = await authService.getCurrentUser()
    if (!user) {
      return { success: false, code: 401, message: '未登录，请重新登录' }
    }
    const filePath = payload && payload.path
    if (!filePath || typeof filePath !== 'string') {
      return { success: false, code: 400, message: '缺少附件路径' }
    }
    const uploadsDir = path.join(app.getPath('userData'), 'uploads')
    const resolved = path.resolve(filePath)
    if (!resolved.startsWith(uploadsDir)) {
      return { success: false, code: 400, message: '附件路径不合法' }
    }
    if (!fs.existsSync(resolved)) {
      return { success: false, code: 404, message: '附件文件不存在（可能已被移动或删除）' }
    }
    try {
      const errorMessage = await shell.openPath(resolved)
      if (errorMessage) {
        return { success: false, code: 500, message: `打开失败：${errorMessage}` }
      }
      return { success: true, code: 0, message: '已打开附件' }
    } catch (err) {
      console.error('[sys:open-attachment] 未预期异常:', err)
      return { success: false, code: 500, message: '打开失败，请重试' }
    }
  })

  // 打开渲染层开发者工具（控制台），供「系统配置」页程序操作区使用
  // detach 模式：DevTools 在独立窗口中打开，而非停靠在页面侧边
  ipcMain.handle('sys:open-dev-console', async (event) => {
    event.sender.openDevTools({ mode: 'detach' })
    return { success: true, code: 0, message: '已打开控制台' }
  })

  // 打开程序所在文件夹目录：打包后 app.getAppPath() 指向 resources/app.asar（文件），
  // 需取其上级目录（安装根目录，含 exe）；开发模式 getAppPath() 即项目根目录
  ipcMain.handle('sys:open-app-folder', async () => {
    const dir = app.isPackaged ? path.dirname(app.getAppPath()) : app.getAppPath()
    const err = await shell.openPath(dir)
    if (err) return { success: false, code: 500, message: `打开失败：${err}` }
    return { success: true, code: 0, message: '已打开程序目录' }
  })

  // 打开数据（用户数据）文件夹目录：存放应用配置与上传附件等
  ipcMain.handle('sys:open-data-folder', async () => {
    const err = await shell.openPath(app.getPath('userData'))
    if (err) return { success: false, code: 500, message: `打开失败：${err}` }
    return { success: true, code: 0, message: '已打开数据目录' }
  })

  // 清除缓存：渲染层会话缓存 + 用户数据目录下的 Chromium 缓存目录
  // 登录态存于 sessionStorage，不属于此范围，清除后无需重新登录；
  // 被当前进程占用的缓存文件跳过，提示重启后自动清理
  ipcMain.handle('sys:clear-cache', async (event) => {
    try {
      await event.sender.session.clearCache()
      const cacheDirs = ['Cache', 'Code Cache', 'GPUCache', 'D3DSCache', 'ShaderCache', 'GrShaderCache', 'GraphiteDawnCache']
      let failedFiles = 0
      for (const name of cacheDirs) {
        failedFiles += await safeRemoveDir(path.join(app.getPath('userData'), name))
      }
      if (failedFiles > 0) {
        return { success: true, code: 0, message: `缓存已清除（${failedFiles} 个文件被占用，重启应用后自动清理）` }
      }
      return { success: true, code: 0, message: '缓存已清除' }
    } catch (err) {
      console.error('[sys:clear-cache] 未预期异常:', err)
      return { success: false, code: 500, message: '清除缓存失败，请重试' }
    }
  })
}

module.exports = { register }
