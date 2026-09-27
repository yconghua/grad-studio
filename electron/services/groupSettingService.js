/**
 * 课题组配置服务（Service Layer）—— group_setting 键值配置
 *
 * 权限：仅课题组管理员可读 / 写。upsert 语义：(group_id, config_key) 存在则更新，不存在则创建。
 */
const permission = require('./permission')
const groupSettingRepository = require('../db/repositories/groupSettingRepository')
const operationLogService = require('./operationLogService')

// 读取课题组全部配置：仅课题组管理员
async function get(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isGroupAdmin()) return { success: false, message: '无权限：仅课题组管理员可查看课题组配置' }
  const { group_id } = payload
  if (!group_id) return { success: false, message: '缺少课题组标识' }
  try {
    const rows = await groupSettingRepository.listByGroupId(group_id)
    // 同时返回明细列表与键值映射对象，便于前端按需取用
    const map = {}
    rows.forEach((r) => {
      map[r.config_key] = r.config_value
    })
    return { success: true, data: map, list: rows }
  } catch (err) {
    console.error('[groupSettingService.get] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// 按 group_id + config_key 保存配置：仅课题组管理员
async function update(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isGroupAdmin()) return { success: false, message: '无权限：仅课题组管理员可修改课题组配置' }
  const { group_id, config_key, config_value, description } = payload
  if (!group_id) return { success: false, message: '缺少课题组标识' }
  if (!config_key || !String(config_key).trim()) return { success: false, message: '配置键不能为空' }
  try {
    const key = String(config_key).trim()
    const updatedBy = permission.currentUserId()
    const exist = await groupSettingRepository.findByGroupAndKey(group_id, key)
    if (exist) {
      await groupSettingRepository.updateSetting(exist.id, {
        config_value,
        description,
        updated_by: updatedBy
      })
    } else {
      await groupSettingRepository.createSetting({
        group_id,
        config_key: key,
        config_value,
        description,
        updated_by: updatedBy
      })
    }
    operationLogService.writeLog({
      action: 'updateGroupSetting',
      targetType: 'group_setting',
      targetId: group_id,
      detail: `保存课题组配置 ${key}`
    })
    return { success: true, message: '保存成功' }
  } catch (err) {
    console.error('[groupSettingService.update] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

module.exports = {
  get,
  update
}
