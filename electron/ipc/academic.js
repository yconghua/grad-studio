/**
 * 路由层（IPC Layer）—— 学生学业记录档案（academic:* 前缀）
 *
 * 权限闸门：细粒度校验在 academicService 内基于会话 + 实时关系完成
 * （学生只能看/填自己；导师只能确认名下学生；组管只能看本组 + 管本组模板；
 * 超管全局）。导出在主进程弹系统保存框，用 academicToXlsx 生成 Excel（.xlsx）。
 */
const path = require('node:path')
const fs = require('node:fs')
const { BrowserWindow, dialog } = require('electron')
const academicService = require('../services/academicService')
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
  return s || '学业档案'
}

// 文件名时间戳：年月日时分秒（yyyyMMdd_HHmmss）
function stamp() {
  const d = new Date()
  const pad2 = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`
}

function register(ipcMain) {
  // 档案时间线：学生不传 userId=自己；导师/组管/超管传 userId=目标学生
  ipcMain.handle('academic:records', handler(async (_evt, payload) => {
    await requireLogin()
    const me = await authService.getCurrentUser()
    const userId = payload && payload.userId ? payload.userId : me.id
    return academicService.recordsOf(userId, me)
  }))

  // 填写/修改节点（学生自己；导师/组管/超管代填）
  ipcMain.handle('academic:save-record', handler(async (_evt, payload) => {
    await requireLogin()
    return academicService.saveRecord(payload || {}, (await authService.getCurrentUser()))
  }))

  // 提交节点：pending → submitted（待导师确认）
  ipcMain.handle('academic:submit-record', handler(async (_evt, payload) => {
    await requireLogin()
    return academicService.submitRecord(payload && payload.id, (await authService.getCurrentUser()))
  }))

  // 确认节点（导师）：submitted → confirmed
  ipcMain.handle('academic:confirm-record', handler(async (_evt, payload) => {
    await requireLogin()
    return academicService.confirmRecord(payload && payload.id, (await authService.getCurrentUser()))
  }))

  // 退回节点（导师）：→ pending + 意见
  ipcMain.handle('academic:return-record', handler(async (_evt, payload) => {
    await requireLogin()
    return academicService.returnRecord(payload && payload.id, payload && payload.reason, (await authService.getCurrentUser()))
  }))

  // 批量确认（导师）：某学生多个 submitted 节点一次确认
  ipcMain.handle('academic:batch-confirm', handler(async (_evt, payload) => {
    await requireLogin()
    return academicService.batchConfirm(payload || {}, (await authService.getCurrentUser()))
  }))

  // 模板列表（管理视图，含停用项）：组管=本组；超管=全局
  ipcMain.handle('academic:templates', handler(async (_evt, payload) => {
    await requireLogin()
    return academicService.listTemplates(payload || {}, (await authService.getCurrentUser()))
  }))

  // 新增/更新模板节点
  ipcMain.handle('academic:template-save', handler(async (_evt, payload) => {
    await requireLogin()
    return academicService.saveTemplate(payload || {}, (await authService.getCurrentUser()))
  }))

  // 停用/启用模板节点
  ipcMain.handle('academic:template-toggle', handler(async (_evt, payload) => {
    await requireLogin()
    return academicService.toggleTemplate(payload && payload.id, payload && payload.enabled, (await authService.getCurrentUser()))
  }))

  // 删除模板节点（软删）
  ipcMain.handle('academic:template-remove', handler(async (_evt, payload) => {
    await requireLogin()
    return academicService.removeTemplate(payload && payload.id, (await authService.getCurrentUser()))
  }))

  // 统计：组管=本组；超管=全部或指定组（分页学生列表，每页 8 条，与其他列表统一）
  ipcMain.handle('academic:stats', handler(async (_evt, payload) => {
    await requireLogin()
    return academicService.stats(payload || {}, (await authService.getCurrentUser()))
  }))

  // 统计摘要：顶部统计卡（范围学生数 / 平均完成率 / 逾期节点总数，全量聚合）
  ipcMain.handle('academic:stats-summary', handler(async (_evt, payload) => {
    await requireLogin()
    return academicService.statsSummary(payload || {}, (await authService.getCurrentUser()))
  }))

  // 导出某学生档案 Excel：弹保存框（文件名含学生姓名 + 年月日时分秒）
  ipcMain.handle('academic:export', handler(async (event, payload) => {
    await requireLogin()
    const me = await authService.getCurrentUser()
    const userId = payload && payload.userId ? payload.userId : me.id
    const result = await academicService.exportXlsx(userId, me)
    const win = event && event.sender ? BrowserWindow.fromWebContents(event.sender) : null
    const options = {
      title: '导出学业档案',
      defaultPath: `${safeFileName(result.fileName || '学业档案')}-${stamp()}.xlsx`,
      filters: [{ name: 'Excel 工作簿', extensions: ['xlsx'] }]
    }
    let picked
    try {
      picked = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
    } catch (err) {
      console.error('[academic:export] 保存对话框异常:', err)
      return { success: false, code: 500, message: '打开保存窗口失败，请重试' }
    }
    if (!picked || picked.canceled || !picked.filePath) {
      return { success: false, code: 0, canceled: true, message: '已取消导出' }
    }
    try {
      fs.writeFileSync(picked.filePath, result.buffer)
      return { success: true, code: 0, message: '已导出学业档案', filePath: picked.filePath }
    } catch (err) {
      console.error('[academic:export] 写入文件失败:', err)
      return { success: false, code: 500, message: `导出失败：${err && err.message ? err.message : '写入文件异常'}` }
    }
  }))

  // 一键导出范围内全部学生学业档案 Excel（导师=名下学生；组管=本组；超管=按筛选的课题组或全部）
  ipcMain.handle('academic:export-all', handler(async (event, payload) => {
    await requireLogin()
    const result = await academicService.exportAllXlsx(payload || {}, (await authService.getCurrentUser()))
    const win = event && event.sender ? BrowserWindow.fromWebContents(event.sender) : null
    const options = {
      title: '导出全部学业档案',
      defaultPath: `${safeFileName(result.fileName || '学业档案汇总')}-${stamp()}.xlsx`,
      filters: [{ name: 'Excel 工作簿', extensions: ['xlsx'] }]
    }
    let picked
    try {
      picked = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
    } catch (err) {
      console.error('[academic:export-all] 保存对话框异常:', err)
      return { success: false, code: 500, message: '打开保存窗口失败，请重试' }
    }
    if (!picked || picked.canceled || !picked.filePath) {
      return { success: false, code: 0, canceled: true, message: '已取消导出' }
    }
    try {
      fs.writeFileSync(picked.filePath, result.buffer)
      return { success: true, code: 0, message: '已导出全部学业档案', filePath: picked.filePath }
    } catch (err) {
      console.error('[academic:export-all] 写入文件失败:', err)
      return { success: false, code: 500, message: `导出失败：${err && err.message ? err.message : '写入文件异常'}` }
    }
  }))
}

module.exports = { register }
