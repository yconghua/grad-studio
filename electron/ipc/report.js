/**
 * 路由层（IPC Layer）—— 周报模块（report:* 前缀）
 *
 * 权限闸门：各通道 requireXxx 粗筛角色，细粒度校验（入组/归属/状态机/配额）
 * 在 reportService 内基于会话完成。附件二进制经 IPC 传入（渲染层 File.arrayBuffer()），
 * 下载在主进程弹系统保存框并写文件（与 note:export 同一套模式）。
 */
const path = require('node:path')
const fs = require('node:fs')
const { BrowserWindow, dialog } = require('electron')
const reportService = require('../services/reportService')
const authService = require('../services/authService')
const ApiError = require('../services/apiError')
const { handler } = require('./helper')
const { ROLE_STUDENT, ROLE_MENTOR, ROLE_GROUP_ADMIN, ROLE_SUPER_ADMIN } = require('../../shared/constants')

async function requireStudent() {
  const u = await authService.getCurrentUser()
  if (!u) throw new ApiError('未登录，请重新登录', 401)
  if (u.role !== ROLE_STUDENT) throw new ApiError('无权限：无权执行此操作', 403)
  return u
}
async function requireMentor() {
  const u = await authService.getCurrentUser()
  if (!u) throw new ApiError('未登录，请重新登录', 401)
  if (u.role !== ROLE_MENTOR) throw new ApiError('无权限：无权执行此操作', 403)
  return u
}
async function requireGroupAdmin() {
  const u = await authService.getCurrentUser()
  if (!u) throw new ApiError('未登录，请重新登录', 401)
  if (u.role !== ROLE_GROUP_ADMIN) throw new ApiError('无权限：无权执行此操作', 403)
  return u
}
async function requireSuperAdmin() {
  const u = await authService.getCurrentUser()
  if (!u) throw new ApiError('未登录，请重新登录', 401)
  if (u.role !== ROLE_SUPER_ADMIN) throw new ApiError('无权限：无权执行此操作', 403)
  return u
}
// 已登录粗筛（混合角色通道：学生本人/导师名下/组管本组，细粒度由服务层校验）
async function requireLoggedIn() {
  const u = await authService.getCurrentUser()
  if (!u) throw new ApiError('未登录，请重新登录', 401)
  return u
}
// 导师或组管（组内只读视图共用）
async function requireMentorOrGroupAdmin() {
  const u = await authService.getCurrentUser()
  if (!u) throw new ApiError('未登录，请重新登录', 401)
  if (u.role !== ROLE_MENTOR && u.role !== ROLE_GROUP_ADMIN) throw new ApiError('无权限：无权执行此操作', 403)
  return u
}

// 清洗下载文件名（Windows 保留字符），空串兜底
function safeFileName(name) {
  const s = String(name == null ? '' : name).replace(/[\\/:*?"<>|]/g, '_').trim()
  return s || '附件'
}

function register(ipcMain) {
  // ===== 学生端 =====
  ipcMain.handle('report:my-week', handler(async () => {
    await requireStudent()
    return reportService.myWeek()
  }))
  ipcMain.handle('report:create', handler(async (_e, payload) => {
    await requireStudent()
    return reportService.createWeekReport(payload && payload.weekKey)
  }))
  ipcMain.handle('report:save-draft', handler(async (_e, payload) => {
    await requireStudent()
    return reportService.saveDraft(payload && payload.id, payload && payload.data)
  }))
  ipcMain.handle('report:submit', handler(async (_e, payload) => {
    await requireStudent()
    return reportService.submit(payload && payload.id, payload && payload.data)
  }))
  ipcMain.handle('report:withdraw-submit', handler(async (_e, payload) => {
    await requireStudent()
    return reportService.withdrawSubmit(payload && payload.id, payload && payload.data)
  }))
  ipcMain.handle('report:list-mine', handler(async (_e, payload) => {
    await requireStudent()
    return reportService.listMine(payload && payload.page)
  }))

  // ===== 导师端 =====
  ipcMain.handle('report:list-to-review', handler(async (_e, payload) => {
    await requireMentor()
    return reportService.listToReview(payload && payload.page)
  }))
  ipcMain.handle('report:review', handler(async (_e, payload) => {
    await requireMentor()
    return reportService.review(payload && payload.id, payload && payload.data)
  }))
  ipcMain.handle('report:unreview', handler(async (_e, payload) => {
    await requireMentor()
    return reportService.unreview(payload && payload.id, payload && payload.data)
  }))

  // ===== 详情 / 组内只读（学生本人、导师名下、组管本组） =====
  ipcMain.handle('report:get', handler(async (_e, payload) => {
    await requireLoggedIn()
    return reportService.get(payload && payload.id)
  }))
  ipcMain.handle('report:list-group', handler(async (_e, payload) => {
    await requireMentorOrGroupAdmin()
    return reportService.listGroup(payload || {})
  }))

  // ===== 附件 =====
  ipcMain.handle('report:attachment-add', handler(async (_e, payload) => {
    await requireStudent()
    return reportService.addAttachment(payload || {})
  }))
  ipcMain.handle('report:attachment-list', handler(async (_e, payload) => {
    await requireLoggedIn()
    return reportService.listAttachments(payload && payload.reportId)
  }))
  ipcMain.handle('report:attachment-delete', handler(async (_e, payload) => {
    await requireStudent()
    return reportService.deleteAttachment(payload && payload.id)
  }))
  ipcMain.handle('report:attachment-quota', handler(async () => {
    await requireStudent()
    return reportService.myQuota()
  }))
  // 下载：权限校验通过后弹系统保存框写入文件
  ipcMain.handle('report:attachment-download', handler(async (event, payload) => {
    await requireLoggedIn()
    const att = await reportService.downloadAttachment(payload && payload.id)
    const win = event && event.sender ? BrowserWindow.fromWebContents(event.sender) : null
    const options = {
      title: '下载附件',
      defaultPath: safeFileName(att.fileName),
      filters: [{ name: '附件', extensions: [String(att.fileName).split('.').pop() || '*'] }]
    }
    let picked
    try {
      picked = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
    } catch (err) {
      console.error('[report:attachment-download] 保存对话框异常:', err)
      return { success: false, code: 500, message: '打开保存窗口失败，请重试' }
    }
    if (!picked || picked.canceled || !picked.filePath) {
      return { success: false, code: 0, canceled: true, message: '已取消下载' }
    }
    try {
      fs.writeFileSync(picked.filePath, att.data)
      return { success: true, code: 0, message: '附件已下载' }
    } catch (err) {
      console.error('[report:attachment-download] 写入文件失败:', err)
      return { success: false, code: 500, message: '下载失败，请重试' }
    }
  }))

  // ===== 模板 =====
  ipcMain.handle('report:template-list', handler(async () => {
    await requireLoggedIn()
    return reportService.listTemplates()
  }))
  ipcMain.handle('report:template-save', handler(async (_e, payload) => {
    await requireGroupAdmin()
    return reportService.saveGroupTemplate(payload || {})
  }))

  // ===== 免交周（组管维护，导师只读） =====
  ipcMain.handle('report:holiday-list', handler(async () => {
    await requireMentorOrGroupAdmin()
    return reportService.listHolidays()
  }))
  ipcMain.handle('report:holiday-upsert', handler(async (_e, payload) => {
    await requireGroupAdmin()
    return reportService.upsertHoliday(payload || {})
  }))
  ipcMain.handle('report:holiday-remove', handler(async (_e, payload) => {
    await requireGroupAdmin()
    return reportService.removeHoliday(payload && payload.weekKey)
  }))

  // ===== 统计（导师/组管/超管） =====
  ipcMain.handle('report:stats', handler(async (_e, payload) => {
    await requireLoggedIn()
    return reportService.stats(payload || {})
  }))

  // ===== 组管催交 =====
  ipcMain.handle('report:remind', handler(async (_e, payload) => {
    await requireGroupAdmin()
    return reportService.remindMissed(payload || {})
  }))

  // ===== 超管：强制删除 / 元数据列表 =====
  ipcMain.handle('report:purge', handler(async (_e, payload) => {
    await requireSuperAdmin()
    return reportService.purge(payload && payload.id, payload && payload.reason)
  }))
  ipcMain.handle('report:list-meta', handler(async (_e, payload) => {
    await requireLoggedIn()
    return reportService.listMeta(payload || {})
  }))
}

module.exports = { register }
