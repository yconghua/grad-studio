/**
 * 工作台服务（Service Layer）—— 个人待办 / 日程安排 / 通知公告
 *
 * 待办 / 日程为纯个人数据（write='self'：只能操作自己的），公告为管理类写操作。
 * 「总览」是聚合展示（不落库），「快捷入口」复用资源中心的 link 表，均不在此建模。
 */
const { todoRepo, scheduleRepo, noticeRepo } = require('../db/repositories/workbenchRepository')
const { createCrudService } = require('./crudService')
const permission = require('./permission')
const { TODO_STATUS_DONE, NOTICE_STATUS_PUBLISHED } = require('../../shared/constants')

const todoService = createCrudService(todoRepo, {
  label: '待办', write: 'self', creatorField: 'user_id', ownerField: 'user_id'
})
const scheduleService = createCrudService(scheduleRepo, {
  label: '日程', write: 'self', creatorField: 'user_id', ownerField: 'user_id'
})
const noticeService = createCrudService(noticeRepo, {
  label: '公告', write: 'manager', creatorField: 'publisher_id'
})

/**
 * 完成待办：置为已完成并记录完成时间（复用工厂的 self 归属校验）。
 * @param {number} id 待办 id
 */
async function completeTodo(id) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const res = await todoService.update(id, { status: TODO_STATUS_DONE, done_at: new Date() })
  if (res.success) res.message = '已完成'
  return res
}

/**
 * 发布公告：置为已发布并记录发布时间。
 * @param {number} id 公告 id
 */
async function publishNotice(id) {
  if (!permission.isManager()) return { success: false, message: '无权限：仅导师或管理员可发布公告' }
  const res = await noticeService.update(id, { status: NOTICE_STATUS_PUBLISHED, published_at: new Date() })
  if (res.success) res.message = '已发布'
  return res
}

// 公告列表：普通用户（学生）只看「已发布」；已关闭的公告不再显示（记录保留，导师 / 管理员可见全部）
const _noticeList = noticeService.list
noticeService.list = async (filters) => {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isManager()) {
    return _noticeList({ ...(filters || {}), status: NOTICE_STATUS_PUBLISHED })
  }
  return _noticeList(filters)
}

module.exports = { todo: todoService, schedule: scheduleService, notice: noticeService, completeTodo, publishNotice }
