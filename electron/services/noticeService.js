/**
 * 公告服务（Service Layer）—— 模块 notice
 *
 * 全员登录可读公告列表 / 未读数 / 标记已读；组管理员可增删改。
 * 未读数 = 该组生效公告总数 - 当前用户已读记录数；标记已读幂等。
 */
const permission = require('./permission')
const noticeRepository = require('../db/repositories/noticeRepository')
const noticeReadRepository = require('../db/repositories/noticeReadRepository')
const userGroupRepository = require('../db/repositories/userGroupRepository')
const operationLogService = require('./operationLogService')
const messageService = require('./messageService')

// 公告列表：按 group_id 过滤，置顶优先、发布时间倒序，并打 is_read 标记
async function list(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const { group_id } = payload || {}
  if (!group_id) return { success: false, message: '缺少课题组标识' }
  try {
    const notices = await noticeRepository.listByGroup(group_id)
    const readSet = await noticeRepository.readNoticeIds(
      notices.map((n) => n.id),
      permission.currentUserId()
    )
    const list = notices.map((n) => ({ ...n, is_read: readSet.has(n.id) ? 1 : 0 }))
    return { success: true, notices: list }
  } catch (err) {
    console.error('[noticeService.list] 数据库异常:', err)
    return { success: false, message: '读取失败，请稍后重试' }
  }
}

// 当前用户在某组的未读公告数
async function unreadCount(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const { group_id } = payload || {}
  if (!group_id) return { success: false, message: '缺少课题组标识' }
  try {
    const count = await noticeRepository.countUnreadByGroup(group_id, permission.currentUserId())
    return { success: true, count }
  } catch (err) {
    console.error('[noticeService.unreadCount] 数据库异常:', err)
    return { success: false, message: '读取失败，请稍后重试' }
  }
}

// 标记某条公告已读（幂等：已存在则不重复插入）
async function markRead(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const { notice_id } = payload || {}
  if (!notice_id) return { success: false, message: '缺少公告标识' }
  try {
    const existed = await noticeReadRepository.findByNoticeAndUser(notice_id, permission.currentUserId())
    if (existed) return { success: true, message: '已读' }
    await noticeReadRepository.create({
      notice_id,
      user_id: permission.currentUserId(),
      read_at: new Date()
    })
    return { success: true, message: '已标记为已读' }
  } catch (err) {
    console.error('[noticeService.markRead] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// 新增公告（仅组管理员；publisher_id 取当前登录用户）
async function create(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isGroupAdmin()) return { success: false, message: '无权限：仅课题组管理员可发布公告' }
  const { group_id, title } = payload || {}
  if (!group_id) return { success: false, message: '缺少课题组标识' }
  if (!title || !String(title).trim()) return { success: false, message: '公告标题不能为空' }
  try {
    const data = noticeRepository.pick(payload)
    data.publisher_id = permission.currentUserId()
    data.published_at = new Date()
    if (data.is_top === undefined) data.is_top = 0
    const id = await noticeRepository.create(data)
    operationLogService.writeLog({
      action: 'createNotice',
      targetType: 'notice',
      targetId: id,
      detail: `发布公告「${String(title).trim()}」`
    })
    // 站内通知：发送给本组生效成员（不含发布者本人）
    try {
      const members = await userGroupRepository.listByGroup({ group_id, status: 'active' })
      const publisherId = permission.currentUserId()
      members.forEach((m) => {
        if (m.user_id !== publisherId) {
          messageService.sendMessage({
            receiverId: m.user_id,
            msgType: 'notice',
            title: '新公告',
            content: `课题组发布新公告「${String(title).trim()}」`,
            refType: 'notice',
            refId: id
          })
        }
      })
    } catch (err) {
      console.error('[noticeService.create] 发送公告通知失败:', err)
    }
    return { success: true, message: '公告已发布', id }
  } catch (err) {
    console.error('[noticeService.create] 数据库异常:', err)
    return { success: false, message: '发布失败，请稍后重试' }
  }
}

// 编辑公告（仅组管理员）
async function update(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isGroupAdmin()) return { success: false, message: '无权限：仅课题组管理员可编辑公告' }
  const { id } = payload || {}
  if (!id) return { success: false, message: '缺少公告标识' }
  try {
    const exist = await noticeRepository.findById(id)
    if (!exist) return { success: false, message: '公告不存在' }
    const data = noticeRepository.pick(payload)
    delete data.group_id // 不允许跨组移动
    delete data.publisher_id // 发布人不可变更
    delete data.published_at // 发布时间不可变更
    if (Object.keys(data).length) {
      await noticeRepository.update(id, data)
    }
    operationLogService.writeLog({
      action: 'updateNotice',
      targetType: 'notice',
      targetId: id,
      detail: `编辑公告「${exist.title}」`
    })
    return { success: true, message: '保存成功' }
  } catch (err) {
    console.error('[noticeService.update] 数据库异常:', err)
    return { success: false, message: '更新失败，请稍后重试' }
  }
}

// 软删除公告（仅组管理员）
async function remove(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isGroupAdmin()) return { success: false, message: '无权限：仅课题组管理员可删除公告' }
  const { id } = payload || {}
  if (!id) return { success: false, message: '缺少公告标识' }
  try {
    const exist = await noticeRepository.findById(id)
    if (!exist) return { success: false, message: '公告不存在' }
    await noticeRepository.delete(id)
    operationLogService.writeLog({
      action: 'removeNotice',
      targetType: 'notice',
      targetId: id,
      detail: `删除公告「${exist.title}」`
    })
    return { success: true, message: '已删除' }
  } catch (err) {
    console.error('[noticeService.remove] 数据库异常:', err)
    return { success: false, message: '删除失败，请稍后重试' }
  }
}

module.exports = { list, unreadCount, markRead, create, update, remove }
