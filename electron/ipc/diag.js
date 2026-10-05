/**
 * 路由层（IPC Layer）—— 日志与诊断路由（diag:* 前缀）
 *
 * 仅超级管理员可用：运行时长 / 内存占用 / 日志查看 / 日志导出 / 打开日志目录。
 * 日志文件由 logService 在 userData/logs/main.log 落盘（含主进程全部 console 输出）。
 */
const fs = require('node:fs')
const { app, shell, dialog, BrowserWindow } = require('electron')
const authService = require('../services/authService')
const logService = require('../services/logService')

// 运行时长格式化：'X 天 X 小时 X 分 X 秒'
function formatUptime(sec) {
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  return `${d} 天 ${h} 小时 ${m} 分 ${s} 秒`
}

// 内存格式化：MB 一位小数
function formatMB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function register(ipcMain) {
  // 诊断概览：运行时长（进程启动起）+ 主进程内存 + 日志文件大小/行数
  ipcMain.handle('diag:info', async () => {
    const user = await authService.getCurrentUser()
    if (!user) {
      return { success: false, code: 401, message: '未登录，请重新登录' }
    }
    if (user.role !== 'super_admin') {
      return { success: false, code: 403, message: '无权限：仅超级管理员可查看诊断信息' }
    }
    try {
      const mem = process.memoryUsage()
      const log = logService.getInfo()
      return {
        success: true,
        code: 0,
        data: {
          uptimeSeconds: Math.floor(process.uptime()),
          uptimeText: formatUptime(process.uptime()),
          memoryText: `RSS ${formatMB(mem.rss)} · 堆 ${formatMB(mem.heapUsed)}`,
          logFileText: `${formatMB(log.fileSize)} / ${log.lineCount} 行`,
          logDir: log.logDir
        }
      }
    } catch (err) {
      console.error('[diag:info] 未预期异常:', err)
      return { success: false, code: 500, message: '读取诊断信息失败' }
    }
  })

  // 读取日志：level = all / error / warn，返回最新 limit 行（倒序）
  ipcMain.handle('diag:logs', async (_evt, payload) => {
    const user = await authService.getCurrentUser()
    if (!user) {
      return { success: false, code: 401, message: '未登录，请重新登录' }
    }
    if (user.role !== 'super_admin') {
      return { success: false, code: 403, message: '无权限：仅超级管理员可查看日志' }
    }
    try {
      const rawLevel = payload && payload.level
      const level = rawLevel === 'error' || rawLevel === 'warn' ? rawLevel : 'all'
      const limit = payload && payload.limit ? Number(payload.limit) : 200
      const data = logService.readLogs(level, limit)
      return { success: true, code: 0, data }
    } catch (err) {
      console.error('[diag:logs] 未预期异常:', err)
      return { success: false, code: 500, message: '读取日志失败' }
    }
  })

  // 导出日志：弹保存对话框，把 main.log 复制到用户指定位置
  ipcMain.handle('diag:export', async (event) => {
    const user = await authService.getCurrentUser()
    if (!user) {
      return { success: false, code: 401, message: '未登录，请重新登录' }
    }
    if (user.role !== 'super_admin') {
      return { success: false, code: 403, message: '无权限：仅超级管理员可导出日志' }
    }
    const d = new Date()
    const pad2 = (n) => String(n).padStart(2, '0')
    const stamp = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}`
    const win = event && event.sender ? BrowserWindow.fromWebContents(event.sender) : null
    let picked
    try {
      const options = {
        title: '导出日志',
        defaultPath: `grad-studio_log_${stamp}.log`,
        filters: [{ name: '日志文件', extensions: ['log', 'txt'] }]
      }
      picked = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
    } catch (err) {
      console.error('[diag:export] 保存对话框异常:', err)
      return { success: false, code: 500, message: '打开保存窗口失败，请重试' }
    }
    if (!picked || picked.canceled || !picked.filePath) {
      return { success: false, code: 0, canceled: true, message: '已取消导出' }
    }
    try {
      const src = logService.getLogDir() ? require('node:path').join(logService.getLogDir(), 'main.log') : ''
      if (!src || !fs.existsSync(src)) {
        return { success: false, code: 404, message: '日志文件不存在' }
      }
      fs.copyFileSync(src, picked.filePath)
      return { success: true, code: 0, message: '日志已导出' }
    } catch (err) {
      console.error('[diag:export] 导出失败:', err)
      return { success: false, code: 500, message: '导出失败，请重试' }
    }
  })

  // 打开日志目录
  ipcMain.handle('diag:open-folder', async () => {
    const user = await authService.getCurrentUser()
    if (!user) {
      return { success: false, code: 401, message: '未登录，请重新登录' }
    }
    if (user.role !== 'super_admin') {
      return { success: false, code: 403, message: '无权限：仅超级管理员可打开日志目录' }
    }
    const err = await shell.openPath(logService.getLogDir() || app.getPath('userData'))
    if (err) return { success: false, code: 500, message: `打开失败：${err}` }
    return { success: true, code: 0, message: '已打开日志目录' }
  })
}

module.exports = { register }
