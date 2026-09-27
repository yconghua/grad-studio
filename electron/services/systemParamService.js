/**
 * 系统参数服务（Service Layer）—— system_param 全局键值配置
 *
 * 权限：仅超级管理员。upsert 语义：param_key 存在则更新，不存在则创建。
 */
const permission = require('./permission')
const systemParamRepository = require('../db/repositories/systemParamRepository')
const operationLogService = require('./operationLogService')

// 列出全部系统参数：仅超级管理员
async function list() {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isAdmin()) return { success: false, message: '无权限：仅超级管理员可查看系统参数' }
  try {
    const rows = await systemParamRepository.listAll()
    return { success: true, data: rows }
  } catch (err) {
    console.error('[systemParamService.list] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// 新增或更新系统参数：仅超级管理员
async function save(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isAdmin()) return { success: false, message: '无权限：仅超级管理员可维护系统参数' }
  const { param_key, param_value, description } = payload
  if (!param_key || !String(param_key).trim()) return { success: false, message: '参数键不能为空' }
  try {
    const key = String(param_key).trim()
    const updatedBy = permission.currentUserId()
    const exist = await systemParamRepository.findByKey(key)
    if (exist) {
      await systemParamRepository.updateParam(exist.id, {
        param_value,
        description,
        updated_by: updatedBy
      })
    } else {
      await systemParamRepository.createParam({
        param_key: key,
        param_value,
        description,
        updated_by: updatedBy
      })
    }
    operationLogService.writeLog({
      action: 'saveSystemParam',
      targetType: 'system_param',
      targetId: 0,
      detail: `保存系统参数 ${key}`
    })
    return { success: true, message: '保存成功' }
  } catch (err) {
    console.error('[systemParamService.save] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// 软删除系统参数：仅超级管理员
async function remove(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isAdmin()) return { success: false, message: '无权限：仅超级管理员可删除系统参数' }
  const { id } = payload
  if (!id) return { success: false, message: '缺少参数标识' }
  try {
    await systemParamRepository.delete(id)
    operationLogService.writeLog({
      action: 'removeSystemParam',
      targetType: 'system_param',
      targetId: id,
      detail: '删除系统参数'
    })
    return { success: true, message: '已删除' }
  } catch (err) {
    console.error('[systemParamService.remove] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

module.exports = {
  list,
  save,
  remove
}
