/**
 * 知识库服务（Service Layer）—— 知识库节点与文件记录的业务逻辑
 *
 * 职责：
 *   1. 树形节点的查询（平铺数据 + 内存组装树）；
 *   2. 节点 / 文件记录的增删改，权限收敛在本层（组管 / 导师可写，学生只读）；
 *   3. 删除节点时联动软删除其下文件记录。
 *
 * 所有数据访问均走 Repository，不在此处直接写 SQL。
 */
const permission = require('./permission')
const knowledgeRepository = require('../db/repositories/knowledgeRepository')
const knowledgeFileRepository = require('../db/repositories/knowledgeFileRepository')
const operationLogService = require('./operationLogService')

// 合法节点类型白名单
const VALID_NODE_TYPES = ['folder', 'doc']

/**
 * 将平铺节点列表组装为树（按 parent_id 挂接；根节点 parent_id=0）
 * @param {Object[]} nodes 已按 sort_order ASC, id ASC 排序
 * @returns {Object[]} 根节点数组，children 为子节点数组
 */
function buildTree(nodes) {
  const map = new Map()
  const roots = []
  nodes.forEach((n) => {
    map.set(n.id, { ...n, children: [] })
  })
  nodes.forEach((n) => {
    const node = map.get(n.id)
    if (n.parent_id && map.has(n.parent_id)) {
      map.get(n.parent_id).children.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

// 按课题组列出知识库节点（树形）：全员登录可读
async function list(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const { group_id } = payload
  if (!group_id) return { success: false, message: '缺少课题组标识' }
  try {
    const nodes = await knowledgeRepository.listByGroup(group_id)
    return { success: true, data: buildTree(nodes) }
  } catch (err) {
    console.error('[knowledgeService.list] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// 新增知识库节点：仅课题组管理员 / 导师
async function create(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isManager()) return { success: false, message: '无权限：仅课题组管理员与导师可维护知识库' }
  const { group_id, parent_id = 0, name, node_type = 'folder', description = '', sort_order = 0 } = payload
  if (!group_id) return { success: false, message: '缺少课题组标识' }
  if (!name || !String(name).trim()) return { success: false, message: '节点名称不能为空' }
  const nodeType = VALID_NODE_TYPES.includes(node_type) ? node_type : 'folder'
  try {
    const id = await knowledgeRepository.createNode({
      group_id,
      parent_id: parent_id || 0,
      name: String(name).trim(),
      node_type: nodeType,
      description,
      sort_order: sort_order || 0,
      created_by: permission.currentUserId()
    })
    operationLogService.writeLog({
      action: 'createKnowledge',
      targetType: 'knowledge',
      targetId: id,
      detail: `创建知识库节点「${String(name).trim()}」`
    })
    return { success: true, data: { id }, message: '创建成功' }
  } catch (err) {
    console.error('[knowledgeService.create] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// 更新知识库节点：仅课题组管理员 / 导师
async function update(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isManager()) return { success: false, message: '无权限：仅课题组管理员与导师可维护知识库' }
  const { id, name, node_type, description, sort_order } = payload
  if (!id) return { success: false, message: '缺少节点标识' }
  try {
    const exist = await knowledgeRepository.findById(id)
    if (!exist) return { success: false, message: '节点不存在' }
    const data = {}
    if (name !== undefined) data.name = String(name).trim()
    if (node_type !== undefined) data.node_type = VALID_NODE_TYPES.includes(node_type) ? node_type : exist.node_type
    if (description !== undefined) data.description = description
    if (sort_order !== undefined) data.sort_order = sort_order
    await knowledgeRepository.updateNode(id, data)
    operationLogService.writeLog({
      action: 'updateKnowledge',
      targetType: 'knowledge',
      targetId: id,
      detail: `编辑知识库节点「${exist.name}」`
    })
    return { success: true, message: '更新成功' }
  } catch (err) {
    console.error('[knowledgeService.update] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// 软删除节点：仅课题组管理员 / 导师；同时软删除其下文件记录
async function remove(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isManager()) return { success: false, message: '无权限：仅课题组管理员与导师可维护知识库' }
  const { id } = payload
  if (!id) return { success: false, message: '缺少节点标识' }
  try {
    const exist = await knowledgeRepository.findById(id)
    if (!exist) return { success: false, message: '节点不存在' }
    await knowledgeRepository.delete(id)
    await knowledgeFileRepository.softDeleteByKnowledgeId(id)
    operationLogService.writeLog({
      action: 'removeKnowledge',
      targetType: 'knowledge',
      targetId: id,
      detail: `删除知识库节点「${exist.name}」`
    })
    return { success: true, message: '已删除' }
  } catch (err) {
    console.error('[knowledgeService.remove] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// 按节点列出文件：全员登录可读
async function listFiles(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const { knowledge_id } = payload
  if (!knowledge_id) return { success: false, message: '缺少知识库节点标识' }
  try {
    const files = await knowledgeFileRepository.listByKnowledgeId(knowledge_id)
    return { success: true, data: files }
  } catch (err) {
    console.error('[knowledgeService.listFiles] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// 登记文件记录：仅课题组管理员 / 导师（文件本体由前端通过 sys:pick-attachment 完成，此处只写记录）
async function uploadFile(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isManager()) return { success: false, message: '无权限：仅课题组管理员与导师可上传文件' }
  const { knowledge_id, group_id, title, file_path = '', file_size = 0, file_type = '' } = payload
  if (!knowledge_id) return { success: false, message: '缺少知识库节点标识' }
  if (!title || !String(title).trim()) return { success: false, message: '文件标题不能为空' }
  try {
    const id = await knowledgeFileRepository.createFile({
      knowledge_id,
      group_id,
      title: String(title).trim(),
      file_path,
      file_size: file_size || 0,
      file_type,
      uploaded_by: permission.currentUserId()
    })
    operationLogService.writeLog({
      action: 'uploadKnowledgeFile',
      targetType: 'knowledge_file',
      targetId: id,
      detail: `上传文件「${String(title).trim()}」至知识库节点 ${knowledge_id}`
    })
    return { success: true, data: { id }, message: '文件记录已创建' }
  } catch (err) {
    console.error('[knowledgeService.uploadFile] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

// 软删除文件记录：仅课题组管理员 / 导师
async function removeFile(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isManager()) return { success: false, message: '无权限：仅课题组管理员与导师可删除文件' }
  const { id } = payload
  if (!id) return { success: false, message: '缺少文件标识' }
  try {
    await knowledgeFileRepository.delete(id)
    operationLogService.writeLog({
      action: 'removeKnowledgeFile',
      targetType: 'knowledge_file',
      targetId: id,
      detail: '删除知识库文件'
    })
    return { success: true, message: '已删除' }
  } catch (err) {
    console.error('[knowledgeService.removeFile] 数据库异常:', err)
    return { success: false, message: '操作失败，请稍后重试' }
  }
}

module.exports = {
  list,
  create,
  update,
  remove,
  listFiles,
  uploadFile,
  removeFile
}
