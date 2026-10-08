/**
 * 路由层（IPC Layer）—— 登录日志路由（login-log:* 前缀）
 *
 * 权限闸门：全部仅超级管理员（登录日志属于系统级审计信息）。
 * 业务实现（记录/清理调度）在 loginLogService / loginLogScheduler。
 */
const loginLogService = require('../services/loginLogService')
const authService = require('../services/authService')
const { ROLE_SUPER_ADMIN } = require('../../shared/constants')
const { dialog, BrowserWindow, app } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

// 导出通道手写返回结构（不经 handler 包装，供渲染层直接判断 canceled/success）
async function requireSuperAdminRaw() {
  const u = await authService.getCurrentUser()
  if (!u) return { success: false, code: 401, message: '未登录，请重新登录' }
  if (u.role !== ROLE_SUPER_ADMIN) return { success: false, code: 403, message: '无权限：仅超级管理员可执行此操作' }
  return null
}

function register(ipcMain) {
  // 登录日志分页列表（筛选：关键字/状态/登录方式/时间范围；排序见 repository 白名单）
  ipcMain.handle('login-log:list', handler(async (_evt, payload) => {
    await requireSuperAdmin()
    return loginLogService.pagedList(payload || {})
  }))

  // 导出登录日志 CSV（按当前筛选条件导出，最多 5000 条）
  ipcMain.handle('login-log:export', async (event, payload) => {
    const denied = await requireSuperAdminRaw()
    if (denied) return denied
    let csv
    try {
      csv = await loginLogService.buildCsv(payload || {})
    } catch (err) {
      console.error('[login-log:export] 生成 CSV 失败:', err)
      return { success: false, code: 500, message: '生成导出内容失败，请重试' }
    }
    const win = event && event.sender ? BrowserWindow.fromWebContents(event.sender) : null
    let picked
    try {
      const options = {
        title: '导出登录日志',
        defaultPath: path.join(app.getPath('documents'), '登录日志.csv'),
        filters: [{ name: 'CSV', extensions: ['csv'] }]
      }
      picked = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
    } catch (err) {
      console.error('[login-log:export] 保存对话框异常:', err)
      return { success: false, code: 500, message: '打开保存窗口失败，请重试' }
    }
    if (!picked || picked.canceled || !picked.filePath) {
      return { success: false, code: 0, canceled: true, message: '已取消导出' }
    }
    try {
      fs.writeFileSync(picked.filePath, csv, 'utf8')
      return { success: true, code: 0, message: '登录日志已导出' }
    } catch (err) {
      console.error('[login-log:export] 写入失败:', err)
      return { success: false, code: 500, message: '导出失败，请重试' }
    }
  })

  // 读取登录日志保留天数
  ipcMain.handle('login-log:retain-days', handler(async () => {
    await requireSuperAdmin()
    return loginLogService.getRetainDays()
  }))

  // 设置登录日志保留天数
  ipcMain.handle('login-log:set-retain-days', handler(async (_evt, payload) => {
    await requireSuperAdmin()
    return loginLogService.setRetainDays(payload && payload.days)
  }))
}

module.exports = { register }
