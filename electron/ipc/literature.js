/**
 * 路由层（IPC Layer）—— 文献 / 文献笔记相关路由（literature:* / literature-note:* 前缀）
 *
 * 仅做一层转发 + 防御性 catch，业务逻辑全部在 literatureService。
 */
const literatureService = require('../services/literatureService')

function register(ipcMain) {
  // ===== 文献条目 literature =====
  // 我的文献列表（可按 read_status / source_type / keyword 过滤）
  ipcMain.handle('literature:list-mine', async (_evt, payload) => {
    try {
      return await literatureService.listMine(payload)
    } catch (err) {
      console.error('[literature:list-mine] 未预期异常:', err)
      return { success: false, message: '读取失败，请稍后重试' }
    }
  })

  // 新增文献
  ipcMain.handle('literature:create', async (_evt, payload) => {
    try {
      return await literatureService.create(payload)
    } catch (err) {
      console.error('[literature:create] 未预期异常:', err)
      return { success: false, message: '创建失败，请稍后重试' }
    }
  })

  // 更新本人文献
  ipcMain.handle('literature:update', async (_evt, payload) => {
    try {
      return await literatureService.update(payload)
    } catch (err) {
      console.error('[literature:update] 未预期异常:', err)
      return { success: false, message: '更新失败，请稍后重试' }
    }
  })

  // 删除本人文献
  ipcMain.handle('literature:remove', async (_evt, payload) => {
    try {
      return await literatureService.remove(payload)
    } catch (err) {
      console.error('[literature:remove] 未预期异常:', err)
      return { success: false, message: '删除失败，请稍后重试' }
    }
  })

  // ===== 文献笔记 literature-note =====
  // 列出某篇文献的笔记
  ipcMain.handle('literature-note:list', async (_evt, payload) => {
    try {
      return await literatureService.noteList(payload)
    } catch (err) {
      console.error('[literature-note:list] 未预期异常:', err)
      return { success: false, message: '读取失败，请稍后重试' }
    }
  })

  // 新增笔记
  ipcMain.handle('literature-note:create', async (_evt, payload) => {
    try {
      return await literatureService.noteCreate(payload)
    } catch (err) {
      console.error('[literature-note:create] 未预期异常:', err)
      return { success: false, message: '创建失败，请稍后重试' }
    }
  })

  // 更新本人笔记
  ipcMain.handle('literature-note:update', async (_evt, payload) => {
    try {
      return await literatureService.noteUpdate(payload)
    } catch (err) {
      console.error('[literature-note:update] 未预期异常:', err)
      return { success: false, message: '更新失败，请稍后重试' }
    }
  })

  // 删除本人笔记
  ipcMain.handle('literature-note:remove', async (_evt, payload) => {
    try {
      return await literatureService.noteRemove(payload)
    } catch (err) {
      console.error('[literature-note:remove] 未预期异常:', err)
      return { success: false, message: '删除失败，请稍后重试' }
    }
  })
}

module.exports = { register }
