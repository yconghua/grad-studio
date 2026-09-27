/**
 * 路由层（IPC Layer）—— 成果 / 论文相关路由（achievement:* / paper:* 前缀）
 *
 * 论文作为成果子模块，通道一并在此注册。
 * 仅做一层转发 + 防御性 catch，业务逻辑全部在 achievementService。
 */
const achievementService = require('../services/achievementService')

function register(ipcMain) {
  // ===== 成果 achievement =====
  // 我的成果列表
  ipcMain.handle('achievement:list-mine', async () => {
    try {
      return await achievementService.listMine()
    } catch (err) {
      console.error('[achievement:list-mine] 未预期异常:', err)
      return { success: false, message: '读取失败，请稍后重试' }
    }
  })

  // 申报成果
  ipcMain.handle('achievement:create', async (_evt, payload) => {
    try {
      return await achievementService.create(payload)
    } catch (err) {
      console.error('[achievement:create] 未预期异常:', err)
      return { success: false, message: '创建失败，请稍后重试' }
    }
  })

  // 更新本人待审核成果
  ipcMain.handle('achievement:update', async (_evt, payload) => {
    try {
      return await achievementService.update(payload)
    } catch (err) {
      console.error('[achievement:update] 未预期异常:', err)
      return { success: false, message: '更新失败，请稍后重试' }
    }
  })

  // 删除本人成果
  ipcMain.handle('achievement:remove', async (_evt, payload) => {
    try {
      return await achievementService.remove(payload)
    } catch (err) {
      console.error('[achievement:remove] 未预期异常:', err)
      return { success: false, message: '删除失败，请稍后重试' }
    }
  })

  // 教师审核成果
  ipcMain.handle('achievement:review', async (_evt, payload) => {
    try {
      return await achievementService.review(payload)
    } catch (err) {
      console.error('[achievement:review] 未预期异常:', err)
      return { success: false, message: '审核失败，请稍后重试' }
    }
  })

  // 全组成果列表
  ipcMain.handle('achievement:list-all', async (_evt, payload) => {
    try {
      return await achievementService.listAll(payload)
    } catch (err) {
      console.error('[achievement:list-all] 未预期异常:', err)
      return { success: false, message: '读取失败，请稍后重试' }
    }
  })

  // ===== 论文 paper =====
  // 我的论文列表
  ipcMain.handle('paper:list', async () => {
    try {
      return await achievementService.paperList()
    } catch (err) {
      console.error('[paper:list] 未预期异常:', err)
      return { success: false, message: '读取失败，请稍后重试' }
    }
  })

  // 新增论文
  ipcMain.handle('paper:create', async (_evt, payload) => {
    try {
      return await achievementService.paperCreate(payload)
    } catch (err) {
      console.error('[paper:create] 未预期异常:', err)
      return { success: false, message: '创建失败，请稍后重试' }
    }
  })

  // 更新本人论文
  ipcMain.handle('paper:update', async (_evt, payload) => {
    try {
      return await achievementService.paperUpdate(payload)
    } catch (err) {
      console.error('[paper:update] 未预期异常:', err)
      return { success: false, message: '更新失败，请稍后重试' }
    }
  })

  // 删除本人论文
  ipcMain.handle('paper:remove', async (_evt, payload) => {
    try {
      return await achievementService.paperRemove(payload)
    } catch (err) {
      console.error('[paper:remove] 未预期异常:', err)
      return { success: false, message: '删除失败，请稍后重试' }
    }
  })
}

module.exports = { register }
