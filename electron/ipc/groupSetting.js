/**
 * 路由层（IPC Layer）—— 课题组配置相关路由（group-setting:* 前缀，仅课题组管理员）
 *
 * 只做路由转发与防御性 catch，业务逻辑全部在 groupSettingService。
 */
const groupSettingService = require('../services/groupSettingService')

function register(ipcMain) {
  // 按课题组读取全部配置
  ipcMain.handle('group-setting:get', async (_evt, payload) => {
    try {
      return await groupSettingService.get(payload)
    } catch (err) {
      console.error('[group-setting:get] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })

  // 按 group_id + config_key 新增或更新配置
  ipcMain.handle('group-setting:update', async (_evt, payload) => {
    try {
      return await groupSettingService.update(payload)
    } catch (err) {
      console.error('[group-setting:update] 未预期异常:', err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })
}

module.exports = { register }
