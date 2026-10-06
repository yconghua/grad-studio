/**
 * 笔记服务（Service Layer）—— 学生私人笔记全生命周期
 *
 * 权限模型（唯一可信来源：主进程会话 authService.getCurrentUser）：
 *   - 仅学生角色可用；
 *   - 必须已入组（有课题组）且已指定导师（实时查库，不读会话快照，换组/离组立即生效）；
 *   - 笔记完全私有：所有读、写、删、恢复强制 user_id = 当前登录用户，
 *     user_id 一律由服务层注入，客户端传入的 user_id / created_at 一律忽略；
 *   - 更新走乐观锁（version 条件更新），冲突返回「笔记已被其他设备更新，请刷新」。
 *
 * 校验规则：主题必填 ≤120 字；类别必须是固定枚举；内容可选 ≤100000 字（允许空草稿）。
 */
const userRepository = require('../db/repositories/userRepository')
const noteRepository = require('../db/repositories/noteRepository')
const authService = require('./authService')
const ApiError = require('./apiError')
const { ROLE_STUDENT, NOTE_CATEGORIES } = require('../../shared/constants')

const TITLE_MAX = 120
const CONTENT_MAX = 100000

// 当前登录用户（401 兜底）
async function currentUser() {
  const me = await authService.getCurrentUser()
  if (!me) throw new ApiError('未登录，请重新登录', 401)
  return me
}

// 学生 + 已入组 + 已指定导师（实时查询，保证换组/离组/解除导师立即失效）
async function assertStudentInGroup(me) {
  if (me.role !== ROLE_STUDENT) throw new ApiError('无权限：仅学生可使用笔记功能', 403)
  const group = await userRepository.findActiveGroupOfUser(me.id)
  if (!group) throw new ApiError('无权限：需已入组才能使用笔记功能', 403)
  const row = await userRepository.findById(me.id)
  if (!row || !row.mentor_id) throw new ApiError('无权限：需已指定导师才能使用笔记功能', 403)
}

// 所有权兜底：笔记必须属于当前用户
function assertOwn(note, me) {
  if (!note) throw new ApiError('笔记不存在', 404)
  if (Number(note.user_id) !== me.id) throw new ApiError('无权限：只能操作自己的笔记', 403)
}

// 主题：必填 + 长度上限（trim 后校验）
function assertTitle(title) {
  const s = String(title == null ? '' : title).trim()
  if (!s) throw new ApiError('请输入笔记主题', 400)
  if (s.length > TITLE_MAX) throw new ApiError(`主题不能超过 ${TITLE_MAX} 字`, 400)
  return s
}

// 类别：必须是固定枚举值
function assertCategory(category) {
  const v = String(category == null ? '' : category)
  if (!NOTE_CATEGORIES.some((c) => c.value === v)) throw new ApiError('请选择笔记类别', 400)
  return v
}

// 内容：可选，长度上限，空串归一为 ''（允许空草稿）
function assertContent(content) {
  const s = String(content == null ? '' : content)
  if (s.length > CONTENT_MAX) throw new ApiError(`内容过长，请精简后保存（最多 ${CONTENT_MAX} 字）`, 400)
  return s
}

// 列表：status=active 正常 / deleted 回收站；category / keyword 可选过滤；按更新时间倒序分页
async function listNotes(filters = {}) {
  const me = await currentUser()
  await assertStudentInGroup(me)
  let category
  if (filters.category) category = assertCategory(filters.category)
  const result = await noteRepository.pagedList({
    userId: me.id,
    isDeleted: filters.status === 'deleted' ? 1 : 0,
    category,
    keyword: filters.keyword ? String(filters.keyword).trim().slice(0, 100) : '',
    sortField: filters.sortField,
    sortOrder: filters.sortOrder,
    page: filters.page
  })
  return result
}

// 详情
async function getNote(id) {
  const me = await currentUser()
  await assertStudentInGroup(me)
  const note = await noteRepository.findOwnById(id, me.id)
  assertOwn(note, me)
  return note
}

// 新建：user_id 由服务层注入；category 缺省为 other；created_at 忽略（数据库生成）
async function createNote(data = {}) {
  const me = await currentUser()
  await assertStudentInGroup(me)
  const title = assertTitle(data.title)
  const category = assertCategory(data.category === undefined ? 'other' : data.category)
  const content = assertContent(data.content)
  const id = await noteRepository.createNote(me.id, title, category, content)
  const note = await noteRepository.findOwnById(id, me.id)
  return note
}

// 更新：乐观锁（version 条件），只更新传入字段；created_at / user_id 不可改
async function updateNote(id, data = {}) {
  const me = await currentUser()
  await assertStudentInGroup(me)
  const note = await noteRepository.findOwnById(id, me.id)
  assertOwn(note, me)
  const version = Number(data.version)
  if (!Number.isInteger(version)) throw new ApiError('缺少版本号，请刷新后重试', 400)
  const patch = {}
  if (data.title !== undefined) patch.title = assertTitle(data.title)
  if (data.category !== undefined) patch.category = assertCategory(data.category)
  if (data.content !== undefined) patch.content = assertContent(data.content)
  if (Object.keys(patch).length === 0) throw new ApiError('没有需要保存的内容', 400)
  const affected = await noteRepository.updateWithVersion(id, me.id, patch, version)
  if (affected === 0) throw new ApiError('笔记已被其他设备更新，请刷新', 400)
  return noteRepository.findOwnById(id, me.id)
}

// 软删除：进入回收站
async function deleteNote(id) {
  const me = await currentUser()
  await assertStudentInGroup(me)
  const affected = await noteRepository.softDelete(Number(id), me.id)
  if (affected === 0) throw new ApiError('笔记不存在或已在回收站', 404)
  return { ok: true }
}

// 恢复：从回收站恢复
async function restoreNote(id) {
  const me = await currentUser()
  await assertStudentInGroup(me)
  const affected = await noteRepository.restore(Number(id), me.id)
  if (affected === 0) throw new ApiError('笔记不存在或不在回收站', 404)
  return { ok: true }
}

// 彻底删除：物理删除（仅回收站内笔记）
async function purgeNote(id) {
  const me = await currentUser()
  await assertStudentInGroup(me)
  const affected = await noteRepository.purge(Number(id), me.id)
  if (affected === 0) throw new ApiError('笔记不存在或不在回收站', 404)
  return { ok: true }
}

// 导出数据准备：校验权限后返回完整笔记（文件写入由 ipc 层完成）
async function exportNote(id) {
  const me = await currentUser()
  await assertStudentInGroup(me)
  const note = await noteRepository.findOwnById(id, me.id)
  assertOwn(note, me)
  return note
}

module.exports = { listNotes, getNote, createNote, updateNote, deleteNote, restoreNote, purgeNote, exportNote, TITLE_MAX, CONTENT_MAX }
