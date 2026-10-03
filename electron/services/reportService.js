/**
 * 周报服务（Service Layer）—— 学生周报全生命周期 + 附件 + 统计
 *
 * 权限模型（唯一可信来源：主进程会话 authService.getCurrentUser）：
 *   - 学生：仅本人周报，且必须已入组、有导师；
 *   - 导师：仅批阅名下学生（users.mentor_id 实时关系），本组只读与统计；
 *   - 组管：本组只读、统计、免交周、催交；
 *   - 超管：全局统计聚合 + 强制删除（无内容字段）。
 *
 * 状态机：draft → submitted → reviewed / returned →（打回可重交）→ submitted；
 * 学生提交后 1h 内可撤回；导师批阅后 24h 内可撤回（清空批阅字段）。
 * 补交：仅最近 4 个自然周内可提交/可批；reviewed 后全角色只读。
 * 附件：仅 draft/returned 可增删；类型白名单 + 单文件 50MB + 每生累计 1GB。
 */
const userRepository = require('../db/repositories/userRepository')
const reportRepository = require('../db/repositories/reportRepository')
const reportAttachmentRepository = require('../db/repositories/reportAttachmentRepository')
const reportConfigRepository = require('../db/repositories/reportConfigRepository')
const authService = require('./authService')
const ApiError = require('./apiError')
const reportWeek = require('./reportWeek')
const notificationService = require('./notificationService')
const {
  ROLE_STUDENT, ROLE_MENTOR, ROLE_GROUP_ADMIN, ROLE_SUPER_ADMIN,
  REPORT_STATUS_DRAFT, REPORT_STATUS_SUBMITTED, REPORT_STATUS_RETURNED, REPORT_STATUS_REVIEWED,
  REPORT_REVIEW_APPROVE, REPORT_REVIEW_RETURN,
  REPORT_ATTACH_EXTS, REPORT_ATTACH_MAX_BYTES, REPORT_ATTACH_QUOTA_BYTES,
  REPORT_BACKFILL_WEEKS, REPORT_SUBMIT_WITHDRAW_MS, REPORT_REVIEW_WITHDRAW_MS
} = require('../../shared/constants')

const TITLE_MAX = 120
const CONTENT_MAX = 100000
const COMMENT_MAX = 5000
const REASON_MAX = 255
const SCORE_MIN = 1
const SCORE_MAX = 5

// 当前登录用户（401 兜底）
async function currentUser() {
  const me = await authService.getCurrentUser()
  if (!me) throw new ApiError('未登录，请重新登录', 401)
  return me
}

// 学生 + 已入组 + 已指定导师（实时查询）
async function assertStudentInGroup(me) {
  if (me.role !== ROLE_STUDENT) throw new ApiError('无权限：仅学生可使用周报功能', 403)
  const group = await userRepository.findActiveGroupOfUser(me.id)
  if (!group) throw new ApiError('无权限：需已入组才能使用周报功能', 403)
  const row = await userRepository.findById(me.id)
  if (!row || !row.mentor_id) throw new ApiError('无权限：需已指定导师才能使用周报功能', 403)
  return { groupId: Number(group.group_id), mentorId: Number(row.mentor_id), realName: row.real_name || row.username }
}

// 导师：已入组（有效课题组）
async function assertMentor(me) {
  if (me.role !== ROLE_MENTOR) throw new ApiError('无权限：仅导师可操作', 403)
  const group = await userRepository.findActiveGroupOfUser(me.id)
  if (!group) throw new ApiError('无权限：需已入组', 403)
  return Number(group.group_id)
}

// 组管：已绑定课题组
async function assertGroupAdmin(me) {
  if (me.role !== ROLE_GROUP_ADMIN) throw new ApiError('无权限：仅组管可操作', 403)
  if (!me.groupId) throw new ApiError('无权限：未绑定课题组', 403)
  return Number(me.groupId)
}

// 超管
async function assertSuperAdmin(me) {
  if (me.role !== ROLE_SUPER_ADMIN) throw new ApiError('无权限：仅超管可操作', 403)
}

// 所有权兜底（学生只能操作自己的周报）
function assertOwn(row, me) {
  if (!row) throw new ApiError('周报不存在', 404)
  if (Number(row.user_id) !== me.id) throw new ApiError('无权限：只能操作自己的周报', 403)
}

// 周报可操作周校验：本周 或 补交窗口（最近 N 周）内；未来周一律拒绝
function assertWeekOperable(weekKey) {
  const diff = reportWeek.weekDiffFromCurrent(weekKey)
  if (diff === null || diff > 0 || diff < -REPORT_BACKFILL_WEEKS) {
    throw new ApiError(`仅支持操作本周或最近 ${REPORT_BACKFILL_WEEKS} 周内的周报`, 400)
  }
}

// 可编辑状态：draft / returned（reviewed 只读，submitted 锁定）
function assertEditable(row) {
  if (row.status !== REPORT_STATUS_DRAFT && row.status !== REPORT_STATUS_RETURNED) {
    throw new ApiError('当前状态不可编辑', 400)
  }
}

function assertTitle(title) {
  const s = String(title == null ? '' : title).trim()
  if (!s) throw new ApiError('请输入周报主题', 400)
  if (s.length > TITLE_MAX) throw new ApiError(`主题不能超过 ${TITLE_MAX} 字`, 400)
  return s
}

function assertContent(content) {
  const s = String(content == null ? '' : content)
  if (s.length > CONTENT_MAX) throw new ApiError(`内容过长，请精简后保存（最多 ${CONTENT_MAX} 字）`, 400)
  return s
}

function assertComment(comment) {
  const s = String(comment == null ? '' : comment).trim()
  if (!s) throw new ApiError('请填写评语或打回理由', 400)
  if (s.length > COMMENT_MAX) throw new ApiError(`评语不能超过 ${COMMENT_MAX} 字`, 400)
  return s
}

function assertReason(reason) {
  const s = String(reason == null ? '' : reason).trim()
  if (!s) throw new ApiError('请填写撤回理由', 400)
  if (s.length > REASON_MAX) throw new ApiError(`理由不能超过 ${REASON_MAX} 字`, 400)
  return s
}

function assertScore(score) {
  if (score === undefined || score === null || score === '') return null
  const n = Number(score)
  if (!Number.isInteger(n) || n < SCORE_MIN || n > SCORE_MAX) {
    throw new ApiError(`评分需为 ${SCORE_MIN}-${SCORE_MAX} 的整数`, 400)
  }
  return n
}

function assertVersion(version) {
  const v = Number(version)
  if (!Number.isInteger(v)) throw new ApiError('缺少版本号，请刷新后重试', 400)
  return v
}

// 本地时间格式化为 'YYYY-MM-DD HH:mm:ss'（与 DATETIME 字符串一致）
function fmtDateTime(d) {
  const pad2 = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

// 解析 'YYYY-MM-DD HH:mm:ss' 为 Date（兼容 Date 实例）
function toDate(v) {
  if (v instanceof Date) return v
  return new Date(String(v).replace(/-/g, '/'))
}

// ===== 学生端 =====

// 我的本周：返回本周记录（无则 null）
async function myWeek() {
  const me = await currentUser()
  await assertStudentInGroup(me)
  const weekKey = reportWeek.currentWeekKey()
  return reportRepository.findByUserAndWeek(me.id, weekKey)
}

// 我的周报历史（分页）
async function listMine(page) {
  const me = await currentUser()
  await assertStudentInGroup(me)
  return reportRepository.listMine(me.id, page)
}

// 新建周报草稿：默认本周；weekKey 可指定补交窗口（最近 N 周）内的周；
// 已有记录直接返回；无则用默认模板创建
async function createWeekReport(weekKey) {
  const me = await currentUser()
  const { groupId } = await assertStudentInGroup(me)
  const key = weekKey ? String(weekKey) : reportWeek.currentWeekKey()
  if (!reportWeek.parseKey(key)) throw new ApiError('周次格式不正确', 400)
  const diff = reportWeek.weekDiffFromCurrent(key)
  if (diff === null || diff > 0 || diff < -REPORT_BACKFILL_WEEKS) {
    throw new ApiError(`仅支持创建本周或最近 ${REPORT_BACKFILL_WEEKS} 周内的周报`, 400)
  }
  const existed = await reportRepository.findByUserAndWeek(me.id, key)
  if (existed) return existed
  const template = await reportConfigRepository.getDefaultTemplate(groupId)
  const id = await reportRepository.createReport(
    me.id,
    groupId,
    key,
    reportWeek.defaultTitle(key),
    template ? template.content : '',
    template ? template.id : null
  )
  return reportRepository.findById(id)
}

// 保存草稿 / 打回修改（乐观锁）
async function saveDraft(id, data = {}) {
  const me = await currentUser()
  await assertStudentInGroup(me)
  const row = await reportRepository.findById(id)
  assertOwn(row, me)
  assertEditable(row)
  assertWeekOperable(row.week_key)
  const version = assertVersion(data.version)
  const patch = {}
  if (data.title !== undefined) patch.title = assertTitle(data.title)
  if (data.content !== undefined) patch.content = assertContent(data.content)
  if (Object.keys(patch).length === 0) throw new ApiError('没有需要保存的内容', 400)
  const affected = await reportRepository.updateWithVersion(id, me.id, patch, version)
  if (affected === 0) throw new ApiError('周报已被其他设备更新，请刷新', 400)
  return reportRepository.findById(id)
}

// 提交：draft/returned → submitted；主题必填；补交标记服务端计算；通知导师
async function submit(id, data = {}) {
  const me = await currentUser()
  const { mentorId } = await assertStudentInGroup(me)
  const row = await reportRepository.findById(id)
  assertOwn(row, me)
  assertEditable(row)
  assertWeekOperable(row.week_key)
  const version = assertVersion(data.version)
  // 提交时主题必填（与保存草稿不同）
  const title = assertTitle(data.title === undefined ? row.title : data.title)
  if (title !== row.title) {
    const affectedT = await reportRepository.updateWithVersion(id, me.id, { title }, version)
    if (affectedT === 0) throw new ApiError('周报已被其他设备更新，请刷新', 400)
  }
  const now = new Date()
  const late = reportWeek.weeksBetween(reportWeek.currentWeekKey(), row.week_key) > 0 ? 1 : 0
  const affected = await reportRepository.submit(id, me.id, version, fmtDateTime(now), late === 1)
  if (affected === 0) throw new ApiError('周报已被其他设备更新，请刷新', 400)
  // 通知导师（同一课题组的导师）
  await notificationService.createForUsers({
    recipients: [mentorId],
    typeKey: 'report_submitted',
    title: `周报待批阅：${reportWeek.weekLabelOf(row.week_key)}`,
    summary: `${me.realName || me.username} 提交了周报（${late ? '补交' : '按时'}）`,
    bizType: 'report',
    bizId: Number(id),
    groupId: Number(row.group_id)
  })
  return reportRepository.findById(id)
}

// 学生撤回提交：submitted → draft（仅 1h 窗口内）
async function withdrawSubmit(id, data = {}) {
  const me = await currentUser()
  const { mentorId } = await assertStudentInGroup(me)
  const row = await reportRepository.findById(id)
  assertOwn(row, me)
  if (row.status !== REPORT_STATUS_SUBMITTED) throw new ApiError('当前状态不可撤回', 400)
  const version = assertVersion(data.version)
  const submittedAt = toDate(row.submitted_at)
  if (Number.isNaN(submittedAt.getTime()) || Date.now() - submittedAt.getTime() > REPORT_SUBMIT_WITHDRAW_MS) {
    throw new ApiError('提交已超过 1 小时，无法撤回，如需修改请联系导师打回', 400)
  }
  const affected = await reportRepository.withdrawSubmit(id, me.id, version)
  if (affected === 0) throw new ApiError('周报已被其他设备更新，请刷新', 400)
  await notificationService.createForUsers({
    recipients: [mentorId],
    typeKey: 'report_withdraw',
    title: `周报已撤回：${reportWeek.weekLabelOf(row.week_key)}`,
    summary: `${me.realName || me.username} 撤回了已提交的周报`,
    bizType: 'report',
    bizId: Number(id),
    groupId: Number(row.group_id)
  })
  return reportRepository.findById(id)
}

// 详情（学生本人 / 导师名下 / 组管本组）
async function get(id) {
  const me = await currentUser()
  const row = await reportRepository.getDetail(id)
  if (!row) throw new ApiError('周报不存在', 404)
  await assertCanView(me, row)
  return row
}

// ===== 导师端 =====

// 待批列表（名下学生 submitted/returned，补交置顶）
async function listToReview(page) {
  const me = await currentUser()
  await assertMentor(me)
  return reportRepository.listToReview(me.id, page)
}

// 导师批阅：submitted → reviewed / returned
async function review(id, data = {}) {
  const me = await currentUser()
  await assertMentor(me)
  const row = await reportRepository.getDetail(id)
  if (!row) throw new ApiError('周报不存在', 404)
  const stu = await userRepository.findById(row.user_id)
  if (!stu || Number(stu.mentor_id) !== me.id) throw new ApiError('无权限：只能批阅名下学生的周报', 403)
  if (row.status !== REPORT_STATUS_SUBMITTED) throw new ApiError('仅待批阅的周报可批阅', 400)
  const version = assertVersion(data.version)
  const action = data.action === REPORT_REVIEW_RETURN ? REPORT_REVIEW_RETURN : REPORT_REVIEW_APPROVE
  const comment = assertComment(data.comment)
  const score = action === REPORT_REVIEW_APPROVE ? assertScore(data.score) : null
  const affected = await reportRepository.review(id, me.id, { action, comment, score }, version)
  if (affected === 0) throw new ApiError('周报已被其他设备更新，请刷新', 400)
  const typeKey = action === REPORT_REVIEW_APPROVE ? 'report_reviewed' : 'report_returned'
  const typeName = action === REPORT_REVIEW_APPROVE ? '周报已批阅' : '周报已打回'
  await notificationService.createForUsers({
    recipients: [Number(row.user_id)],
    typeKey,
    title: `${typeName}：${reportWeek.weekLabelOf(row.week_key)}`,
    summary: action === REPORT_REVIEW_APPROVE ? `评分 ${score == null ? '—' : score}：${comment}` : `打回理由：${comment}`,
    bizType: 'report',
    bizId: Number(id),
    groupId: Number(row.group_id)
  })
  return reportRepository.findById(id)
}

// 导师撤回批阅：reviewed → submitted（24h 内，清空批阅字段）
async function unreview(id, data = {}) {
  const me = await currentUser()
  await assertMentor(me)
  const row = await reportRepository.findById(id)
  if (!row) throw new ApiError('周报不存在', 404)
  if (Number(row.reviewed_by) !== me.id) throw new ApiError('无权限：仅批阅人可撤回', 403)
  if (row.status !== REPORT_STATUS_REVIEWED) throw new ApiError('当前状态不可撤回批阅', 400)
  const reviewedAt = toDate(row.reviewed_at)
  if (Number.isNaN(reviewedAt.getTime()) || Date.now() - reviewedAt.getTime() > REPORT_REVIEW_WITHDRAW_MS) {
    throw new ApiError('批阅已超过 24 小时，无法撤回', 400)
  }
  const version = assertVersion(data.version)
  const reason = assertReason(data.reason)
  const affected = await reportRepository.unreview(id, me.id, reason, version)
  if (affected === 0) throw new ApiError('周报已被其他设备更新，请刷新', 400)
  await notificationService.createForUsers({
    recipients: [Number(row.user_id)],
    typeKey: 'report_withdraw',
    title: `批阅已撤回：${reportWeek.weekLabelOf(row.week_key)}`,
    summary: `导师撤回了批阅：${reason}`,
    bizType: 'report',
    bizId: Number(id),
    groupId: Number(row.group_id)
  })
  return reportRepository.findById(id)
}

// 组内只读列表（导师 / 组管）
async function listGroup(filters = {}) {
  const me = await currentUser()
  let groupId
  if (me.role === ROLE_MENTOR) {
    groupId = await assertMentor(me)
  } else if (me.role === ROLE_GROUP_ADMIN) {
    groupId = await assertGroupAdmin(me)
  } else {
    throw new ApiError('无权限', 403)
  }
  return reportRepository.listGroup(groupId, filters)
}

// ===== 附件 =====

// 扩展名提取（小写）
function extOf(fileName) {
  const idx = String(fileName || '').lastIndexOf('.')
  return idx >= 0 ? String(fileName).slice(idx + 1).toLowerCase() : ''
}

// 上传附件：仅本人 + draft/returned + 类型白名单 + 单文件 50MB + 累计 1GB
async function addAttachment({ reportId, fileName, mimeType, data } = {}) {
  const me = await currentUser()
  await assertStudentInGroup(me)
  const row = await reportRepository.findById(reportId)
  assertOwn(row, me)
  assertEditable(row)
  assertWeekOperable(row.week_key)
  const name = String(fileName == null ? '' : fileName).trim()
  if (!name) throw new ApiError('缺少文件名', 400)
  const ext = extOf(name)
  if (!REPORT_ATTACH_EXTS.includes(ext)) {
    throw new ApiError(`仅支持上传：${REPORT_ATTACH_EXTS.join(' / ')}`, 400)
  }
  // IPC 传参后 data 可能为 Buffer / Uint8Array / ArrayBuffer
  const buf = Buffer.isBuffer(data)
    ? data
    : data instanceof ArrayBuffer
      ? Buffer.from(data)
      : data && data.buffer instanceof ArrayBuffer
        ? Buffer.from(data.buffer, data.byteOffset, data.byteLength)
        : null
  if (!buf || buf.length === 0) throw new ApiError('文件内容为空', 400)
  if (buf.length > REPORT_ATTACH_MAX_BYTES) {
    throw new ApiError(`单文件不能超过 ${Math.floor(REPORT_ATTACH_MAX_BYTES / 1024 / 1024)}MB`, 400)
  }
  const used = await reportAttachmentRepository.sumSizeByUser(me.id)
  if (used + buf.length > REPORT_ATTACH_QUOTA_BYTES) {
    const remain = Math.floor((REPORT_ATTACH_QUOTA_BYTES - used) / 1024 / 1024)
    throw new ApiError(`附件总量已达上限（1GB），剩余可用约 ${Math.max(0, remain)}MB`, 400)
  }
  const id = await reportAttachmentRepository.create({
    reportId,
    userId: me.id,
    fileName: name,
    fileSize: buf.length,
    mimeType: String(mimeType || '').slice(0, 100),
    fileExt: ext,
    data: buf
  })
  return reportAttachmentRepository.getById(id)
}

// 附件清单（按周报）：返回元数据 + 学生侧配额
async function listAttachments(reportId) {
  const me = await currentUser()
  const row = await reportRepository.findById(reportId)
  if (!row) throw new ApiError('周报不存在', 404)
  await assertCanView(me, row)
  const list = await reportAttachmentRepository.listMetaByReport(reportId)
  let quota = null
  if (me.role === ROLE_STUDENT) {
    const used = await reportAttachmentRepository.sumSizeByUser(me.id)
    quota = { used, quota: REPORT_ATTACH_QUOTA_BYTES, maxFile: REPORT_ATTACH_MAX_BYTES }
  }
  return { list, quota }
}

// 查看权限判定：学生本人 / 导师名下 / 组管本组
async function assertCanView(me, row) {
  if (me.role === ROLE_STUDENT) {
    await assertStudentInGroup(me)
    assertOwn(row, me)
  } else if (me.role === ROLE_MENTOR) {
    await assertMentor(me)
    const stu = await userRepository.findById(row.user_id)
    if (!stu || Number(stu.mentor_id) !== me.id) throw new ApiError('无权限', 403)
  } else if (me.role === ROLE_GROUP_ADMIN) {
    const groupId = await assertGroupAdmin(me)
    if (Number(row.group_id) !== groupId) throw new ApiError('无权限', 403)
  } else {
    throw new ApiError('无权限', 403)
  }
}

// 删除附件：仅本人 + draft/returned（物理删除，释放配额）
async function deleteAttachment(id) {
  const me = await currentUser()
  await assertStudentInGroup(me)
  const att = await reportAttachmentRepository.getById(id)
  if (!att) throw new ApiError('附件不存在', 404)
  if (Number(att.user_id) !== me.id) throw new ApiError('无权限：只能删除自己上传的附件', 403)
  const row = await reportRepository.findById(att.report_id)
  if (!row) throw new ApiError('周报不存在', 404)
  assertEditable(row)
  assertWeekOperable(row.week_key)
  const affected = await reportAttachmentRepository.deleteById(id)
  if (affected === 0) throw new ApiError('附件不存在', 404)
  return { ok: true }
}

// 下载附件：返回文件元数据 + 二进制（文件写入由 IPC 层完成）
async function downloadAttachment(id) {
  const me = await currentUser()
  const att = await reportAttachmentRepository.getWithData(id)
  if (!att) throw new ApiError('附件不存在', 404)
  const row = await reportRepository.findById(att.report_id)
  if (!row) throw new ApiError('周报不存在', 404)
  await assertCanView(me, row)
  return {
    fileName: att.file_name,
    mimeType: att.mime_type,
    size: Number(att.file_size),
    data: att.file_data
  }
}

// 我的附件配额（学生个人中心展示用）
async function myQuota() {
  const me = await currentUser()
  await assertStudentInGroup(me)
  const used = await reportAttachmentRepository.sumSizeByUser(me.id)
  return { used, quota: REPORT_ATTACH_QUOTA_BYTES, maxFile: REPORT_ATTACH_MAX_BYTES }
}

// ===== 模板（学生/导师/组管查看；组管可维护组模板） =====
async function listTemplates() {
  const me = await currentUser()
  let groupId = null
  if (me.role === ROLE_STUDENT) {
    const info = await assertStudentInGroup(me)
    groupId = info.groupId
  } else if (me.role === ROLE_MENTOR) {
    groupId = await assertMentor(me)
  } else if (me.role === ROLE_GROUP_ADMIN) {
    groupId = await assertGroupAdmin(me)
  } else {
    throw new ApiError('无权限', 403)
  }
  return reportConfigRepository.listTemplates(groupId)
}

// 组管保存组模板：组内仅维护一条（有则更新，无则创建）
async function saveGroupTemplate(data = {}) {
  const me = await currentUser()
  const groupId = await assertGroupAdmin(me)
  const name = String(data.name == null ? '' : data.name).trim()
  if (!name) throw new ApiError('请输入模板名称', 400)
  if (name.length > 50) throw new ApiError('模板名称不能超过 50 字', 400)
  const content = String(data.content == null ? '' : data.content)
  if (content.length > CONTENT_MAX) throw new ApiError('模板内容过长', 400)
  if (!content.trim()) throw new ApiError('模板内容不能为空', 400)
  const templates = await reportConfigRepository.listTemplates(groupId)
  const mine = templates.find((t) => Number(t.group_id) === groupId)
  if (mine) {
    await reportConfigRepository.updateTemplate(mine.id, { name, content })
  } else {
    await reportConfigRepository.createTemplate({ groupId, name, content, createdBy: me.id })
  }
  return reportConfigRepository.listTemplates(groupId)
}

// ===== 免交周（组管设置，导师只读） =====
async function listHolidays() {
  const me = await currentUser()
  let groupId
  if (me.role === ROLE_GROUP_ADMIN) {
    groupId = await assertGroupAdmin(me)
  } else if (me.role === ROLE_MENTOR) {
    groupId = await assertMentor(me)
  } else {
    throw new ApiError('无权限', 403)
  }
  return reportConfigRepository.listHolidays(groupId)
}

async function upsertHoliday(data = {}) {
  const me = await currentUser()
  const groupId = await assertGroupAdmin(me)
  const weekKey = String(data.weekKey || '')
  const reason = String(data.reason == null ? '' : data.reason).slice(0, 100)
  if (!reportWeek.parseKey(weekKey)) throw new ApiError('周次格式不正确', 400)
  await reportConfigRepository.upsertHoliday({ groupId, weekKey, reason, createdBy: me.id })
  return reportConfigRepository.listHolidays(groupId)
}

async function removeHoliday(weekKey) {
  const me = await currentUser()
  const groupId = await assertGroupAdmin(me)
  await reportConfigRepository.removeHoliday(groupId, String(weekKey || ''))
  return reportConfigRepository.listHolidays(groupId)
}

// ===== 统计 =====

// 应提交学生集合（启用 + 在组 + 有导师）
async function expectedStudents(groupId) {
  if (groupId == null) {
    return { count: await reportRepository.expectedCountAll(), ids: [] }
  }
  const ids = await reportRepository.expectedStudentIds(groupId)
  return { count: ids.length, ids }
}

// 统计：导师/组管看本组；超管看全局（无内容）
async function stats({ weekKey } = {}) {
  const me = await currentUser()
  const key = weekKey && reportWeek.parseKey(weekKey) ? weekKey : reportWeek.currentWeekKey()
  const isSuper = me.role === ROLE_SUPER_ADMIN
  const isMentor = me.role === ROLE_MENTOR
  const isGroupAdmin = me.role === ROLE_GROUP_ADMIN
  if (!isSuper && !isMentor && !isGroupAdmin) throw new ApiError('无权限', 403)

  let groupId = null
  if (isSuper) {
    await assertSuperAdmin(me)
  } else if (isMentor) {
    groupId = await assertMentor(me)
  } else {
    groupId = await assertGroupAdmin(me)
  }

  const holiday = groupId != null ? await reportConfigRepository.isHoliday(groupId, key) : false
  const expected = await expectedStudents(groupId)
  const weekly = groupId != null
    ? await reportRepository.statsOfWeek(groupId, key)
    : await reportRepository.globalStatsOfWeek(key)

  const rate = (num) => (expected.count > 0 ? Math.round((Number(num) / expected.count) * 100) : 0)
  // 免交周：应提交分母按 0 处理，提交率/按时率返回 null（不展示）
  const submitRate = holiday ? null : rate(weekly.submitted)
  const onTimeRate = holiday ? null : rate(weekly.onTime)

  let trend = []
  const recentKeys = []
  for (let i = REPORT_BACKFILL_WEEKS; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i * 7)
    recentKeys.push(reportWeek.currentWeekKey(d))
  }
  trend = groupId != null
    ? await reportRepository.recentWeekStats(groupId, recentKeys)
    : await reportRepository.globalRecentWeekStats(recentKeys)

  const result = {
    weekKey: key,
    weekLabel: reportWeek.weekLabelOf(key),
    holiday,
    expected: expected.count,
    submitted: weekly.submitted,
    onTime: weekly.onTime,
    reviewed: weekly.reviewed,
    avgScore: weekly.avgScore,
    submitRate,
    onTimeRate,
    trend: trend.map((t) => ({ ...t, weekLabel: reportWeek.weekLabelOf(t.weekKey) }))
  }

  // 未交名单：仅导师（名下）/ 组管（本组）；超管不返回名单
  if (isMentor || isGroupAdmin) {
    const submittedIds = await reportRepository.listSubmittedUserIds(groupId, key)
    const missedIds = expected.ids.filter((uid) => !submittedIds.includes(uid))
    const missedRows = await reportRepository.studentsByIds(missedIds)
    result.missedList = missedRows.map((r) => ({
      id: Number(r.id),
      username: r.username,
      realName: r.real_name || r.username
    }))
  }

  // 超管附加：各组排名
  if (isSuper) {
    result.ranking = await reportRepository.groupRanking(key)
  }
  return result
}

// ===== 组管催交 =====
async function remindMissed({ weekKey } = {}) {
  const me = await currentUser()
  const groupId = await assertGroupAdmin(me)
  const key = weekKey && reportWeek.parseKey(weekKey) ? weekKey : reportWeek.currentWeekKey()
  const expected = await expectedStudents(groupId)
  const submittedIds = await reportRepository.listSubmittedUserIds(groupId, key)
  const missedIds = expected.ids.filter((uid) => !submittedIds.includes(uid))
  if (missedIds.length === 0) return { reminded: 0 }
  const count = await notificationService.createForUsers({
    recipients: missedIds,
    typeKey: 'report_remind',
    title: `请及时提交周报：${reportWeek.weekLabelOf(key)}`,
    summary: '组管理员提醒您尽快提交本周周报',
    bizType: 'report',
    bizId: 0,
    groupId
  })
  return { reminded: count }
}

// ===== 超管强制删除（物理删除 + 级联附件 + 通知学生） =====
async function purge(id, reason) {
  const me = await currentUser()
  await assertSuperAdmin(me)
  const row = await reportRepository.findById(id)
  if (!row) throw new ApiError('周报不存在', 404)
  await reportAttachmentRepository.deleteByReportId(id)
  const affected = await reportRepository.purge(id)
  if (affected === 0) throw new ApiError('周报不存在', 404)
  const reasonText = String(reason || '').trim().slice(0, 100)
  await notificationService.createForUsers({
    recipients: [Number(row.user_id)],
    typeKey: 'report_purged',
    title: `周报已被删除：${reportWeek.weekLabelOf(row.week_key)}`,
    summary: reasonText ? `删除原因：${reasonText}` : '管理员删除了该周报（如有疑问请联系管理员）',
    bizType: 'report',
    bizId: Number(id),
    groupId: Number(row.group_id)
  })
  return { ok: true }
}

// 超管/组管元数据列表（无内容）
async function listMeta(filters = {}) {
  const me = await currentUser()
  let groupId = null
  if (me.role === ROLE_SUPER_ADMIN) {
    await assertSuperAdmin(me)
    groupId = filters.groupId != null && filters.groupId !== '' ? Number(filters.groupId) : null
  } else if (me.role === ROLE_GROUP_ADMIN) {
    groupId = await assertGroupAdmin(me)
  } else {
    throw new ApiError('无权限', 403)
  }
  if (groupId == null) {
    throw new ApiError('超管视图请按课题组查询', 400)
  }
  return reportRepository.listMeta(groupId, filters)
}

module.exports = {
  myWeek, listMine, createWeekReport, saveDraft, submit, withdrawSubmit, get,
  listToReview, review, unreview, listGroup,
  addAttachment, listAttachments, deleteAttachment, downloadAttachment, myQuota,
  listTemplates, saveGroupTemplate,
  listHolidays, upsertHoliday, removeHoliday,
  stats, remindMissed, purge, listMeta,
  TITLE_MAX, CONTENT_MAX
}
