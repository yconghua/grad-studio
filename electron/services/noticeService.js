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

const MEETING_TYPE_TEXT = { regular: '常规组会', seminar: '专题研讨', thesis: '开题答辩', other: '其他' }

function fmtDT(v) {
  return v ? String(v).replace('T', ' ').slice(0, 16) : '—'
}

// 由组会信息构建自动公告的正文
function buildMeetingNoticeContent(m) {
  const lines = []
  if (m.meeting_type) lines.push(`类型：${MEETING_TYPE_TEXT[m.meeting_type] || m.meeting_type}`)
  lines.push(`时间：${fmtDT(m.start_time)} ~ ${fmtDT(m.end_time)}`)
  if (m.location) lines.push(`地点：${m.location}`)
  if (m.agenda) lines.push(`议程：${m.agenda}`)
  lines.push('请各位成员提前做好准备，准时参加。')
  return lines.join('\n')
}

// 给本组导师与学生发站内通知（课题组管理员不接收公告类通知，发布者本人也不发）
async function notifyGroupMembers(groupId, title, content, refId) {
  try {
    const members = await userGroupRepository.listByGroup({ group_id: groupId, status: 'active' })
    const publisherId = permission.currentUserId()
    members.forEach((m) => {
      if (m.role_in_group === 'group_admin') return
      if (m.user_id !== publisherId) {
        messageService.sendMessage({
          receiverId: m.user_id,
          msgType: 'notice',
          title,
          content,
          refType: 'notice',
          refId
        })
      }
    })
  } catch (err) {
    console.error('[noticeService] 发送公告通知失败:', err)
  }
}

// 公告列表：按 group_id 过滤，置顶优先、发布时间倒序，并打 is_read 标记
async function list(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const { group_id } = payload || {}
  if (!group_id) return { success: false, message: '缺少课题组标识' }
  try {
    const notices = await noticeRepository.listByGroup(group_id)
    // 课题组管理员不需要未读提示，公告全部视为已读
    if (permission.isGroupAdmin()) {
      const list = notices.map((n) => ({ ...n, is_read: 1 }))
      return { success: true, notices: list }
    }
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
    // 课题组管理员不显示公告未读
    if (permission.isGroupAdmin()) return { success: true, count: 0 }
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
    if (!existed) {
      await noticeReadRepository.create({
        notice_id,
        user_id: permission.currentUserId(),
        read_at: new Date()
      })
    }
    // 公告已读，同步其站内通知消息为已读（首页铃铛未读同步消失）
    await messageService.markNoticeReadSync(notice_id, permission.currentUserId())
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
    notifyGroupMembers(group_id, '新公告', `课题组发布新公告「${String(title).trim()}」`, id)
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

// 组会联动：组会保存为「已发布」时，自动生成 / 同步更新其关联公告（供 meetingService 调用）
// 首次发布生成公告并触发站内通知；后续编辑（时间 / 地点等变更）只更新公告内容并提醒成员，不重复生成。
async function syncFromMeeting(meeting) {
  const meetingId = meeting && meeting.id
  if (!meetingId || !meeting.group_id || !meeting.title) return null
  const title = String(meeting.title).trim()
  const noticeTitle = `组会通知：${title}`
  const content = buildMeetingNoticeContent(meeting)
  const exist = await noticeRepository.findByMeetingId(meetingId)
  if (exist) {
    await update({ id: exist.id, title: noticeTitle, content })
    notifyGroupMembers(exist.group_id, '组会公告已更新', `组会「${title}」的公告已更新，请查看最新安排`, exist.id)
    return { action: 'updated', noticeId: exist.id }
  }
  const res = await create({
    group_id: meeting.group_id,
    meeting_id: meetingId,
    title: noticeTitle,
    content,
    is_top: 0
  })
  return { action: 'created', noticeId: res.id }
}

module.exports = { list, unreadCount, markRead, create, update, remove, syncFromMeeting }
