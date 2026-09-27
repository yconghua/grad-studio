/**
 * 文献 Service（Service Layer）—— literature:* / literature-note:* 通道的业务逻辑
 *
 * 仅学生本人操作：文献条目与笔记均以 currentUserId 强制限定 user_id，
 * 先查记录归属再放行，杜绝越权。
 */
const permission = require('./permission')
const literatureRepository = require('../db/repositories/literatureRepository')
const literatureNoteRepository = require('../db/repositories/literatureNoteRepository')

// ===== 文献条目 literature =====

// 列出我的文献（可按 read_status / source_type / keyword 过滤）
async function listMine(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const userId = permission.currentUserId()
  try {
    const data = await literatureRepository.listByUser(userId, {
      readStatus: payload.read_status,
      sourceType: payload.source_type,
      keyword: payload.keyword
    })
    return { success: true, data }
  } catch (err) {
    console.error('[literatureService.listMine] 数据库异常:', err)
    return { success: false, message: '读取文献列表失败，请稍后重试' }
  }
}

// 新增文献
async function create(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const userId = permission.currentUserId()
  if (!payload.title || !String(payload.title).trim()) {
    return { success: false, message: '请填写文献标题' }
  }
  try {
    const id = await literatureRepository.createForUser(userId, payload)
    return { success: true, data: { id }, message: '文献已添加' }
  } catch (err) {
    console.error('[literatureService.create] 数据库异常:', err)
    return { success: false, message: '添加文献失败，请稍后重试' }
  }
}

// 更新本人文献
async function update(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const userId = permission.currentUserId()
  const { id } = payload
  if (!id) return { success: false, message: '缺少文献 id' }
  try {
    const record = await literatureRepository.findById(id)
    if (!record || record.user_id !== userId) {
      return { success: false, message: '记录不存在或无权操作' }
    }
    const affected = await literatureRepository.updateOwned(id, userId, payload)
    return { success: true, data: { affected }, message: '文献已更新' }
  } catch (err) {
    console.error('[literatureService.update] 数据库异常:', err)
    return { success: false, message: '更新文献失败，请稍后重试' }
  }
}

// 删除本人文献（软删除）
async function remove(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const userId = permission.currentUserId()
  const { id } = payload
  if (!id) return { success: false, message: '缺少文献 id' }
  try {
    const record = await literatureRepository.findById(id)
    if (!record || record.user_id !== userId) {
      return { success: false, message: '记录不存在或无权操作' }
    }
    await literatureRepository.delete(id)
    return { success: true, message: '文献已删除' }
  } catch (err) {
    console.error('[literatureService.remove] 数据库异常:', err)
    return { success: false, message: '删除文献失败，请稍后重试' }
  }
}

// ===== 文献笔记 literature-note =====

// 列出某篇文献的本人笔记（先校验文献归属）
async function noteList(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const userId = permission.currentUserId()
  const { literature_id: literatureId } = payload
  if (!literatureId) return { success: false, message: '缺少文献 id' }
  try {
    const lit = await literatureRepository.findById(literatureId)
    if (!lit || lit.user_id !== userId) {
      return { success: false, message: '文献不存在或无权访问' }
    }
    const data = await literatureNoteRepository.listByLiterature(literatureId, userId)
    return { success: true, data }
  } catch (err) {
    console.error('[literatureService.noteList] 数据库异常:', err)
    return { success: false, message: '读取笔记失败，请稍后重试' }
  }
}

// 新增笔记
async function noteCreate(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const userId = permission.currentUserId()
  if (!payload.literature_id) return { success: false, message: '缺少文献 id' }
  if (!payload.content || !String(payload.content).trim()) {
    return { success: false, message: '笔记内容不能为空' }
  }
  try {
    const lit = await literatureRepository.findById(payload.literature_id)
    if (!lit || lit.user_id !== userId) {
      return { success: false, message: '文献不存在或无权访问' }
    }
    const id = await literatureNoteRepository.createForUser(userId, payload)
    return { success: true, data: { id }, message: '笔记已保存' }
  } catch (err) {
    console.error('[literatureService.noteCreate] 数据库异常:', err)
    return { success: false, message: '保存笔记失败，请稍后重试' }
  }
}

// 更新本人笔记
async function noteUpdate(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const userId = permission.currentUserId()
  const { id } = payload
  if (!id) return { success: false, message: '缺少笔记 id' }
  try {
    const note = await literatureNoteRepository.findById(id)
    if (!note || note.user_id !== userId) {
      return { success: false, message: '笔记不存在或无权操作' }
    }
    const affected = await literatureNoteRepository.updateOwned(id, userId, payload)
    return { success: true, data: { affected }, message: '笔记已更新' }
  } catch (err) {
    console.error('[literatureService.noteUpdate] 数据库异常:', err)
    return { success: false, message: '更新笔记失败，请稍后重试' }
  }
}

// 删除本人笔记（软删除）
async function noteRemove(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const userId = permission.currentUserId()
  const { id } = payload
  if (!id) return { success: false, message: '缺少笔记 id' }
  try {
    const note = await literatureNoteRepository.findById(id)
    if (!note || note.user_id !== userId) {
      return { success: false, message: '笔记不存在或无权操作' }
    }
    await literatureNoteRepository.delete(id)
    return { success: true, message: '笔记已删除' }
  } catch (err) {
    console.error('[literatureService.noteRemove] 数据库异常:', err)
    return { success: false, message: '删除笔记失败，请稍后重试' }
  }
}

module.exports = {
  listMine,
  create,
  update,
  remove,
  noteList,
  noteCreate,
  noteUpdate,
  noteRemove
}
