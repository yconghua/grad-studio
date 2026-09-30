/**
 * 路由层（IPC Layer）—— 师生关系相关路由（students:* 前缀）
 *
 * 只做一层转发：渲染层的 students:* 调用交给 studentsService，
 * 不写 SQL、不做权限判断（权限在 Service 层）。
 */
const studentsService = require('../services/studentsService')

function register(ipcMain) {
  // 学生列表（导师看自己名下 / 组管看全组）
  ipcMain.handle('students:list', async (_evt, payload) => {
    try {
      return await studentsService.list(payload)
    } catch (err) {
      console.error('[students:list] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 学生名单（导师看自己名下 / 组管与超管看组内学生）——学位记录等选人场景
  ipcMain.handle('students:list-group-students', async (_evt, payload) => {
    try {
      return await studentsService.listGroupStudents(payload)
    } catch (err) {
      console.error('[students:list-group-students] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 绑定候选：组内尚未被任何导师绑定的学生
  ipcMain.handle('students:list-available', async (_evt, payload) => {
    try {
      return await studentsService.listAvailableForBind(payload)
    } catch (err) {
      console.error('[students:list-available] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 我的指导老师（学生本人，个人资料页）
  ipcMain.handle('students:my-mentor', async (_evt, payload) => {
    try {
      return await studentsService.myMentor(payload)
    } catch (err) {
      console.error('[students:my-mentor] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 绑定师生关系
  ipcMain.handle('students:bind', async (_evt, payload) => {
    try {
      return await studentsService.bind(payload)
    } catch (err) {
      console.error('[students:bind] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 解除绑定（软删除）
  ipcMain.handle('students:unbind', async (_evt, payload) => {
    try {
      return await studentsService.unbind(payload)
    } catch (err) {
      console.error('[students:unbind] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 任意用户师生关系（仅超级管理员，成员资料用）
  ipcMain.handle('students:relation-by-user', async (_evt, payload) => {
    try {
      return await studentsService.listByUser(payload && payload.userId)
    } catch (err) {
      console.error('[students:relation-by-user] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })
}

module.exports = { register }
