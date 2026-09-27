/**
 * 数据总览服务（Service Layer）—— overview:* 通道的业务逻辑
 *
 * 仅超级管理员可访问。以主体（课题组 / 用户）为维度集中返回各业务模块数据，
 * 供「数据总览」页面浏览与导出。
 */
const permission = require('./permission')
const overviewRepository = require('../db/repositories/overviewRepository')

// 全部课题组（含计数）
async function listGroups() {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isAdmin()) return { success: false, message: '无权限：仅超级管理员可查看数据总览' }
  try {
    const rows = await overviewRepository.listGroups()
    return { success: true, groups: rows }
  } catch (err) {
    console.error('[overviewService.listGroups] 数据库异常:', err)
    return { success: false, message: '读取失败，请稍后重试' }
  }
}

// 单个课题组详情
async function groupDetail(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isAdmin()) return { success: false, message: '无权限：仅超级管理员可查看数据总览' }
  const { group_id } = payload
  if (!group_id) return { success: false, message: '缺少课题组标识' }
  try {
    const data = await overviewRepository.groupDetail(group_id)
    if (!data) return { success: false, message: '课题组不存在' }
    return { success: true, data }
  } catch (err) {
    console.error('[overviewService.groupDetail] 数据库异常:', err)
    return { success: false, message: '读取失败，请稍后重试' }
  }
}

// 全部用户（可按角色过滤）
async function listUsers(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isAdmin()) return { success: false, message: '无权限：仅超级管理员可查看数据总览' }
  const role = payload && payload.role ? String(payload.role) : ''
  try {
    const rows = await overviewRepository.listUsers(role || null)
    return { success: true, users: rows }
  } catch (err) {
    console.error('[overviewService.listUsers] 数据库异常:', err)
    return { success: false, message: '读取失败，请稍后重试' }
  }
}

// 单个用户详情
async function userDetail(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isAdmin()) return { success: false, message: '无权限：仅超级管理员可查看数据总览' }
  const { user_id } = payload
  if (!user_id) return { success: false, message: '缺少用户标识' }
  try {
    const data = await overviewRepository.userDetail(user_id)
    if (!data) return { success: false, message: '用户不存在' }
    return { success: true, data }
  } catch (err) {
    console.error('[overviewService.userDetail] 数据库异常:', err)
    return { success: false, message: '读取失败，请稍后重试' }
  }
}

module.exports = { listGroups, groupDetail, listUsers, userDetail }
