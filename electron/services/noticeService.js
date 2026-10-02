/**
 * 课题组公告服务（Service Layer）—— 公告与已读
 *
 * 权限模型（唯一可信来源为主进程内存会话 authService.getCurrentUser，
 * 不信任前端传入的 role / groupId / publisherId）：
 *   - 超级管理员：全部课题组公告的查看、发布（指定任意组）、编辑、删除、置顶、已读统计；
 *   - 课题组管理员：仅本组公告的查看、发布（groupId 强制本组，忽略前端传值）、
 *     编辑、删除、置顶、已读统计；
 *   - 导师 / 学生：仅本组「已发布」公告只读（按当前有效课题组实时计算），可标记自己已读。
 * 公告属于课题组：管理员/用户被删除不影响公告存在；课题组被删除时由 groupService 级联硬删。
 */
const userRepository = require('../db/repositories/userRepository')
const groupRepository = require('../db/repositories/groupRepository')
const groupNoticeRepository = require('../db/repositories/groupNoticeRepository')
const groupNoticeReadRepository = require('../db/repositories/groupNoticeReadRepository')
const authService = require('./authService')
const groupService = require('./groupService')
const notificationService = require('./notificationService')
const ApiError = require('./apiError')
const {
  ROLE_SUPER_ADMIN,
  ROLE_GROUP_ADMIN,
  ROLE_MENTOR,
  ROLE_STUDENT
} = require('../../shared/constants')

// 公告状态：仅保留「已发布 / 下架」两种（无草稿）
const NOTICE_STATUS_PUBLISHED = 1
const NOTICE_STATUS_OFFLINE = 2

// 当前登录用户（401 兜底）
async function currentUser() {
  const me = await authService.getCurrentUser()
  if (!me) throw new ApiError('未登录，请重新登录', 401)
  return me
}

// 课题组管理员绑定的课题组（权威来源：groups.admin_user_id）
async function groupAdminGroupId(me) {
  const group = await groupRepository.findByAdminUserId(me.id)
  if (!group) throw new ApiError('当前账号未绑定课题组', 404)
  return group.id
}

// 导师/学生当前有效课题组（实时查用户表，不读会话缓存）
async function memberGroupId(me) {
  const row = await userRepository.findActiveGroupOfUser(me.id)
  return row && row.group_id ? Number(row.group_id) : null
}

// 公告应读基数：该组启用状态的导师+学生人数（已读统计专用）
async function getGroupAudience(groupId) {
  return userRepository.countAudienceByGroup(groupId)
}

// 公告标题/内容长度校验（与表列宽一致：title 100 / content 10000）；
// 内容按 Markdown 纯文本存储，服务端只做第一道安全闸（拒绝明显 HTML 标签），
// 主要 XSS 防护由渲染层 DOMPurify 白名单过滤承担。
function assertTitle(title) {
  const t = String(title).trim()
  if (!t) throw new ApiError('请输入公告标题', 400)
  if (t.length > 100) throw new ApiError('公告标题不能超过 100 个字符', 400)
  return t
}
function assertContent(content) {
  const c = content === undefined || content === null ? '' : String(content).trim()
  if (!c) throw new ApiError('请输入公告内容', 400)
  if (c.length > 10000) throw new ApiError('公告内容不能超过 10000 个字符', 400)
  if (/<script|<iframe|javascript:/i.test(c)) {
    throw new ApiError('公告内容包含不允许的代码片段', 400)
  }
  return c
}

// 发布/编辑时仅允许 1 已发布 / 2 下架
function assertStatus(status) {
  const st = Number(status)
  if (![NOTICE_STATUS_PUBLISHED, NOTICE_STATUS_OFFLINE].includes(st)) throw new ApiError('状态参数不合法', 400)
  return st
}

// 本地时间格式化（YYYY-MM-DD HH:mm:ss，DATETIME 列写入用）
function nowSql() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  )
}

// 行转 DTO（发布人被删除时姓名回退「用户 #id」）
function toNoticeDto(row) {
  if (!row) return null
  return {
    id: row.id,
    groupId: row.group_id,
    groupName: row.group_name || '',
    publisherId: row.publisher_id,
    publisherRole: row.publisher_role,
    publisherName: row.publisher_real_name || row.publisher_username || `用户 #${row.publisher_id}`,
    title: row.title,
    content: row.content,
    isTop: row.is_top,
    status: row.status,
    publishTime: row.publish_time,
    createTime: row.create_time,
    updateTime: row.update_time
  }
}

// 分页结果包装（附加当前用户已读状态）
async function pageNotices(result, me) {
  const list = result.list.map(toNoticeDto)
  const readIds = new Set(await groupNoticeReadRepository.findReadIdsByUser(me.id))
  list.forEach((n) => {
    n.read = readIds.has(n.id)
  })
  return {
    list,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages
  }
}

/**
 * 校验当前用户可管理某公告：存在 + 角色 + 归属。
 * 超管可管理任意公告；组管仅本组；导师/学生一律拒绝。
 */
async function assertManageable(me, id) {
  const notice = await groupNoticeRepository.findById(Number(id))
  if (!notice) throw new ApiError('公告不存在', 404)
  if (me.role === ROLE_SUPER_ADMIN) return notice
  if (me.role === ROLE_GROUP_ADMIN) {
    const myGroupId = await groupAdminGroupId(me)
    if (notice.group_id !== myGroupId) throw new ApiError('无权限：只能操作本课题组的公告', 403)
    return notice
  }
  throw new ApiError('无权限：无权执行此操作', 403)
}

// ===== 公告列表 =====

/**
 * 公告分页列表（四角色共用入口，可见范围按角色在服务端强制收敛）
 */
async function listNotices({ page, keyword, groupId, status } = {}) {
  const me = await currentUser()
  const filters = { page, keyword }
  let effectiveGroupId = null

  if (me.role === ROLE_SUPER_ADMIN) {
    // 全部课题组公告，支持按课题组筛选
    if (groupId !== undefined && groupId !== null && groupId !== '') effectiveGroupId = Number(groupId)
  } else if (me.role === ROLE_GROUP_ADMIN) {
    // 仅本组（忽略前端传值）
    effectiveGroupId = await groupAdminGroupId(me)
  } else {
    // 导师/学生：仅当前有效课题组的已发布公告
    effectiveGroupId = await memberGroupId(me)
    if (!effectiveGroupId) {
      return { list: [], total: 0, page: 1, pageSize: 8, totalPages: 1, groupId: null, notInGroup: true }
    }
    status = NOTICE_STATUS_PUBLISHED
  }

  if (effectiveGroupId) filters.groupId = effectiveGroupId
  if (status !== undefined && status !== null && status !== '') filters.status = Number(status)

  const result = await groupNoticeRepository.pagedList(filters)
  const data = await pageNotices(result, me)
  data.groupId = effectiveGroupId
  return data
}

// ===== 公告管理（超管 / 组管） =====

/**
 * 发布公告：超管可指定任意课题组（校验存在）；组管强制发到本组；
 * 状态固定为「已发布」，发布人/发布角色/发布时间由服务端生成。
 */
async function createNotice({ groupId, title, content } = {}) {
  const me = await currentUser()
  let targetGroupId
  if (me.role === ROLE_SUPER_ADMIN) {
    targetGroupId = groupId === undefined || groupId === null || groupId === '' ? null : Number(groupId)
    if (!targetGroupId) throw new ApiError('请选择要发布公告的课题组', 400)
    const g = await groupRepository.findById(targetGroupId)
    if (!g) throw new ApiError('课题组不存在', 404)
  } else if (me.role === ROLE_GROUP_ADMIN) {
    targetGroupId = await groupAdminGroupId(me)
  } else {
    throw new ApiError('无权限：无权发布公告', 403)
  }

  // 状态校验：停用组禁止发布新公告
  await groupService.assertGroupWritable(targetGroupId)

  const id = await groupNoticeRepository.create({
    group_id: targetGroupId,
    publisher_id: me.id,
    publisher_role: me.role,
    title: assertTitle(title),
    content: assertContent(content),
    is_top: 0,
    status: NOTICE_STATUS_PUBLISHED,
    publish_time: nowSql()
  })
  // 通知中心：发布公告 → 通知该组全部启用成员（摘要取正文前 50 字，按码点安全截断）
  await notificationService.createForGroup({
    groupId: targetGroupId,
    typeKey: 'notice',
    title: assertTitle(title),
    summary: Array.from(String(content).trim()).slice(0, 50).join(''),
    bizType: 'notice',
    bizId: id
  })
  return getNotice(id)
}

/**
 * 编辑公告：仅标题 / 内容 / 状态可改（groupId 不可改，公告不能跨组移动）
 */
async function updateNotice(id, { title, content, status } = {}) {
  const me = await currentUser()
  const notice = await assertManageable(me, id)
  // 状态校验：停用组禁止编辑公告
  await groupService.assertGroupWritable(notice.group_id)

  const data = {}
  if (title !== undefined) data.title = assertTitle(title)
  if (content !== undefined) data.content = assertContent(content)
  if (status !== undefined) data.status = assertStatus(status)
  if (Object.keys(data).length === 0) throw new ApiError('没有需要修改的内容', 400)

  await groupNoticeRepository.updateById(notice.id, data)
  return getNotice(notice.id)
}

/**
 * 删除公告（硬删除）：先清已读记录，再物理删除公告
 */
async function deleteNotice(id) {
  const me = await currentUser()
  const notice = await assertManageable(me, id)
  await groupNoticeReadRepository.deleteByNoticeId(notice.id)
  await groupNoticeRepository.deleteById(notice.id)
  // 通知中心：删除公告 → 关联通知软删（保留历史，不硬删）
  await notificationService.softDeleteByBiz('notice', notice.id)
  return true
}

/**
 * 置顶 / 取消置顶（状态翻转）
 */
async function toggleTop(id) {
  const me = await currentUser()
  const notice = await assertManageable(me, id)
  // 状态校验：停用组禁止置顶操作
  await groupService.assertGroupWritable(notice.group_id)
  await groupNoticeRepository.updateById(notice.id, { is_top: notice.is_top ? 0 : 1 })
  return getNotice(notice.id)
}

/**
 * 公告详情（管理侧复用，返回完整 DTO）
 */
async function getNotice(id) {
  const row = await groupNoticeRepository.findById(Number(id))
  if (!row) throw new ApiError('公告不存在', 404)
  return toNoticeDto(row)
}

// ===== 已读 =====

/**
 * 已读统计：应读基数 = 该组启用状态导师+学生数；已读人数 / 名单
 */
async function readStats(id) {
  const me = await currentUser()
  const notice = await assertManageable(me, id)
  const totalMembers = await getGroupAudience(notice.group_id)
  const readCount = await groupNoticeReadRepository.countByNotice(notice.id)
  const readers = await groupNoticeReadRepository.listByNotice(notice.id)
  return {
    noticeId: notice.id,
    groupId: notice.group_id,
    title: notice.title,
    totalMembers,
    readCount,
    list: readers.map((r) => ({
      userId: r.user_id,
      realName: r.real_name || '',
      username: r.username || '',
      readAt: r.read_at
    }))
  }
}

/**
 * 导师/学生标记自己已读（幂等）：
 * 1. 公告必须存在；2. 必须是「已发布」状态；3. 当前用户必须是该组有效成员。
 */
async function markRead(id) {
  const me = await currentUser()
  if (me.role !== ROLE_MENTOR && me.role !== ROLE_STUDENT) {
    throw new ApiError('无权限：仅导师/学生可标记已读', 403)
  }
  const notice = await groupNoticeRepository.findById(Number(id))
  if (!notice || notice.status !== NOTICE_STATUS_PUBLISHED) {
    throw new ApiError('公告不存在或已下架', 404)
  }
  const myGroupId = await memberGroupId(me)
  if (!myGroupId || myGroupId !== notice.group_id) {
    throw new ApiError('无权限：你不是该课题组的有效成员', 403)
  }
  await groupNoticeReadRepository.markRead(notice.id, me.id)
  return { read: true }
}

/**
 * 当前用户未读公告数（导师/学生侧边菜单角标专用）：
 * 口径 = 当前有效课题组 + 已发布 + 没有已读记录。
 * 导师/学生每次实时查当前有效课题组（换组/离组立即按新组重算）；
 * 超管/组管不产生角标（固定 0），他们只看已读统计。
 * 统一返回 { unreadCount, notInGroup }：无组用户 notInGroup=true，
 * 供前端区分「未入组」与「组内无未读」。
 */
async function unreadCount() {
  const me = await currentUser()
  if (me.role !== ROLE_MENTOR && me.role !== ROLE_STUDENT) return { unreadCount: 0, notInGroup: false }
  const myGroupId = await memberGroupId(me)
  if (!myGroupId) return { unreadCount: 0, notInGroup: true }
  const count = await groupNoticeRepository.countUnreadByGroup(myGroupId, me.id)
  return { unreadCount: count, notInGroup: false }
}

module.exports = {
  listNotices,
  createNotice,
  updateNotice,
  deleteNotice,
  toggleTop,
  getNotice,
  readStats,
  markRead,
  getGroupAudience,
  unreadCount
}
