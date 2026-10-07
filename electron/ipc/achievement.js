/**
 * 路由层（IPC Layer）—— 学生科研成果（achievement:* 前缀）
 *
 * 权限闸门：细粒度校验在 achievementService 内基于会话 + 实时关系完成
 * （学生只能填/提交自己；导师只能确认名下学生；组管只能看本组；
 * 超管全局）。导出在主进程弹系统保存框，Word（.docx）/ Excel（.xlsx）。
 */
const path = require('node:path')
const fs = require('node:fs')
const { BrowserWindow, dialog } = require('electron')
const achievementService = require('../services/achievementService')
const authService = require('../services/authService')
const ApiError = require('../services/apiError')
const { handler } = require('./helper')

// 任意已登录角色（细粒度权限在服务层）
async function requireLogin() {
  const u = await authService.getCurrentUser()
  if (!u) throw new ApiError('未登录，请重新登录', 401)
  return u
}

// 清洗文件名非法字符（Windows 保留字符），空串兜底
function safeFileName(name) {
  const s = String(name == null ? '' : name).replace(/[\\/:*?"<>|]/g, '_').trim()
  return s || '科研成果'
}

// 弹系统保存框并写文件；ext 与 filterName 由调用方按类型传入
async function pickAndWrite(event, { title, defaultName, filterName, ext, buffer }) {
  const win = event && event.sender ? BrowserWindow.fromWebContents(event.sender) : null
  const options = {
    title,
    defaultPath: defaultName,
    filters: [{ name: filterName, extensions: [ext] }]
  }
  let picked
  try {
    picked = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
  } catch (err) {
    console.error('[achievement:export] 保存对话框异常:', err)
    return { success: false, code: 500, message: '打开保存窗口失败，请重试' }
  }
  if (!picked || picked.canceled || !picked.filePath) {
    return { success: false, code: 0, canceled: true, message: '已取消导出' }
  }
  try {
    fs.writeFileSync(picked.filePath, buffer)
    return { success: true, code: 0, message: '已导出', filePath: picked.filePath }
  } catch (err) {
    console.error('[achievement:export] 写入文件失败:', err)
    return { success: false, code: 500, message: `导出失败：${err && err.message ? err.message : '写入文件异常'}` }
  }
}

function register(ipcMain) {
  // 分页列表（范围由登录角色 + groupId 决定）
  ipcMain.handle('achievement:stats', handler(async (_evt, payload) => {
    await requireLogin()
    return achievementService.stats(payload || {}, (await authService.getCurrentUser()))
  }))

  // 统计摘要：顶部统计卡（范围总数 / 待确认 / 已确认 / 按类型分布）
  ipcMain.handle('achievement:stats-summary', handler(async (_evt, payload) => {
    await requireLogin()
    return achievementService.statsSummary(payload || {}, (await authService.getCurrentUser()))
  }))

  // 新增/编辑成果（学生自己；导师/超管代填）
  ipcMain.handle('achievement:save', handler(async (_evt, payload) => {
    await requireLogin()
    return achievementService.saveAchievement(payload || {}, (await authService.getCurrentUser()))
  }))

  // 提交成果：pending → submitted（待导师确认）
  ipcMain.handle('achievement:submit', handler(async (_evt, payload) => {
    await requireLogin()
    return achievementService.submitAchievement(payload && payload.id, (await authService.getCurrentUser()))
  }))

  // 确认成果（导师）：submitted → confirmed
  ipcMain.handle('achievement:confirm', handler(async (_evt, payload) => {
    await requireLogin()
    return achievementService.confirmAchievement(payload && payload.id, (await authService.getCurrentUser()))
  }))

  // 退回成果（导师）：→ pending + 意见
  ipcMain.handle('achievement:return', handler(async (_evt, payload) => {
    await requireLogin()
    return achievementService.returnAchievement(payload && payload.id, payload && payload.reason, (await authService.getCurrentUser()))
  }))

  // 批量确认（导师）：某学生多条 submitted 成果一次确认
  ipcMain.handle('achievement:batch-confirm', handler(async (_evt, payload) => {
    await requireLogin()
    return achievementService.batchConfirm(payload || {}, (await authService.getCurrentUser()))
  }))

  // 导师名下全部已提交成果一次确认（导师页「全部确认」）
  ipcMain.handle('achievement:batch-confirm-all', handler(async (_evt, payload) => {
    await requireLogin()
    return achievementService.batchConfirmAll((await authService.getCurrentUser()))
  }))

  // 删除成果（学生本人 / 超管）：软删
  ipcMain.handle('achievement:remove', handler(async (_evt, payload) => {
    await requireLogin()
    return achievementService.removeAchievement(payload && payload.id, (await authService.getCurrentUser()))
  }))

  // 导出学生个人成果 Word：弹保存框
  ipcMain.handle('achievement:export-docx', handler(async (event, payload) => {
    await requireLogin()
    const me = await authService.getCurrentUser()
    const userId = payload && payload.userId ? payload.userId : me.id
    const buffer = await achievementService.exportDocx(userId, me)
    const d = new Date()
    const pad2 = (n) => String(n).padStart(2, '0')
    const date = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`
    return pickAndWrite(event, {
      title: '导出科研成果',
      defaultName: `科研成果-${date}.docx`,
      filterName: 'Word 文档',
      ext: 'docx',
      buffer
    })
  }))

  // 范围成果 Excel（导师/组管/超管）：弹保存框
  ipcMain.handle('achievement:export-xlsx', handler(async (event, payload) => {
    await requireLogin()
    const buffer = await achievementService.exportXlsx(payload || {}, (await authService.getCurrentUser()))
    const d = new Date()
    const pad2 = (n) => String(n).padStart(2, '0')
    const date = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`
    return pickAndWrite(event, {
      title: '导出科研成果',
      defaultName: `科研成果-${date}.xlsx`,
      filterName: 'Excel 工作簿',
      ext: 'xlsx',
      buffer
    })
  }))

  // ===== 附件（LONGBLOB 入库，与周报附件同模式） =====

  // 上传附件：前端传二进制（file.arrayBuffer()），主进程校验后 INSERT
  ipcMain.handle('achievement:attachment-upload', handler(async (_evt, payload) => {
    await requireLogin()
    return achievementService.addAttachment(payload || {}, (await authService.getCurrentUser()))
  }))

  // 附件元数据列表（不含二进制）
  ipcMain.handle('achievement:attachment-list', handler(async (_evt, payload) => {
    await requireLogin()
    return achievementService.listAttachments(payload && payload.achievementId, (await authService.getCurrentUser()))
  }))

  // 删除附件：物理删除
  ipcMain.handle('achievement:attachment-remove', handler(async (_evt, payload) => {
    await requireLogin()
    return achievementService.removeAttachment(payload && payload.id, (await authService.getCurrentUser()))
  }))

  // 下载附件：权限校验通过后弹系统保存框写入文件
  ipcMain.handle('achievement:attachment-download', handler(async (event, payload) => {
    await requireLogin()
    const att = await achievementService.downloadAttachment(payload && payload.id, (await authService.getCurrentUser()))
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
      console.error('[achievement:attachment-download] 保存对话框异常:', err)
      return { success: false, code: 500, message: '打开保存窗口失败，请重试' }
    }
    if (!picked || picked.canceled || !picked.filePath) {
      return { success: false, code: 0, canceled: true, message: '已取消下载' }
    }
    try {
      fs.writeFileSync(picked.filePath, att.data)
      return { success: true, code: 0, message: '附件已下载' }
    } catch (err) {
      console.error('[achievement:attachment-download] 写入文件失败:', err)
      return { success: false, code: 500, message: '下载失败，请重试' }
    }
  }))
}

module.exports = { register }
