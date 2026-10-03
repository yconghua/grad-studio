/**
 * 路由层（IPC Layer）—— 学生私人笔记模块（note:* 前缀）
 *
 * 权限闸门：所有通道 requireStudent 粗筛（仅学生角色），细粒度校验
 * （已入组 + 已指定导师 + 所有权）在 noteService 内基于会话完成。
 * 导出在主进程弹系统保存框并写 Markdown 文件（与 sys:export-db 同一套模式）。
 */
const path = require('node:path')
const fs = require('node:fs')
const { BrowserWindow, dialog } = require('electron')
const noteService = require('../services/noteService')
const authService = require('../services/authService')
const ApiError = require('../services/apiError')
const { handler } = require('./helper')
const { ROLE_STUDENT, NOTE_CATEGORIES } = require('../../shared/constants')

// 校验当前用户是学生（服务层再做入组与所有权校验）
async function requireStudent() {
  const u = await authService.getCurrentUser()
  if (!u) throw new ApiError('未登录，请重新登录', 401)
  if (u.role !== ROLE_STUDENT) throw new ApiError('无权限：无权执行此操作', 403)
  return u
}

// 清洗文件名非法字符（Windows 保留字符），空串兜底
function safeFileName(name) {
  const s = String(name == null ? '' : name).replace(/[\\/:*?"<>|]/g, '_').trim()
  return s || '笔记'
}

// 类别显示名（导出元信息头用）
function categoryLabel(value) {
  const item = NOTE_CATEGORIES.find((c) => c.value === value)
  return item ? item.label : String(value)
}

function register(ipcMain) {
  // 列表：status=active/deleted，category 可选，分页按更新时间倒序
  ipcMain.handle('note:list', handler(async (_evt, payload) => {
    await requireStudent()
    return noteService.listNotes(payload || {})
  }))

  // 详情
  ipcMain.handle('note:get', handler(async (_evt, payload) => {
    await requireStudent()
    return noteService.getNote(payload && payload.id)
  }))

  // 新建（user_id / created_at 由服务端处理，客户端传入忽略）
  ipcMain.handle('note:create', handler(async (_evt, payload) => {
    await requireStudent()
    return noteService.createNote(payload || {})
  }))

  // 更新（乐观锁，version 必带）
  ipcMain.handle('note:update', handler(async (_evt, payload) => {
    await requireStudent()
    const { id, data } = payload || {}
    return noteService.updateNote(id, data || {})
  }))

  // 删除（进回收站）
  ipcMain.handle('note:delete', handler(async (_evt, payload) => {
    await requireStudent()
    return noteService.deleteNote(payload && payload.id)
  }))

  // 恢复（回收站 → 正常）
  ipcMain.handle('note:restore', handler(async (_evt, payload) => {
    await requireStudent()
    return noteService.restoreNote(payload && payload.id)
  }))

  // 彻底删除（物理删除，仅回收站内）
  ipcMain.handle('note:purge', handler(async (_evt, payload) => {
    await requireStudent()
    return noteService.purgeNote(payload && payload.id)
  }))

  // 导出单篇 Markdown：弹保存框；内容 = # 主题 + 类别/创建时间元信息头 + 正文
  ipcMain.handle('note:export', handler(async (event, payload) => {
    await requireStudent()
    const note = await noteService.exportNote(payload && payload.id)
    const d = new Date()
    const pad2 = (n) => String(n).padStart(2, '0')
    const date = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`
    const win = event && event.sender ? BrowserWindow.fromWebContents(event.sender) : null
    const options = {
      title: '导出笔记',
      defaultPath: `${safeFileName(note.title)}-${date}.md`,
      filters: [{ name: 'Markdown 文件', extensions: ['md'] }]
    }
    let picked
    try {
      picked = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
    } catch (err) {
      console.error('[note:export] 保存对话框异常:', err)
      return { success: false, code: 500, message: '打开保存窗口失败，请重试' }
    }
    if (!picked || picked.canceled || !picked.filePath) {
      return { success: false, code: 0, canceled: true, message: '已取消导出' }
    }
    const body = [
      `# ${note.title}`,
      '',
      `> 类别：${categoryLabel(note.category)}`,
      `> 创建时间：${note.created_at || ''}`,
      '',
      note.content || ''
    ].join('\n')
    try {
      fs.writeFileSync(picked.filePath, body, 'utf8')
      return { success: true, code: 0, message: '已导出笔记' }
    } catch (err) {
      console.error('[note:export] 写入文件失败:', err)
      return { success: false, code: 500, message: '导出失败，请重试' }
    }
  }))
}

module.exports = { register }
