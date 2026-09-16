/**
 * 通用 CRUD 服务工厂（Service Layer 复用）
 *
 * 为「只需标准增删改查 + 统一权限规则」的业务资源，生成 list / get / create / update / remove 五个方法。
 * 本次新增 28 张业务表，绝大多数符合这个模式，用工厂 + 每表一行配置即可，避免逐表复制粘贴。
 *
 * 权限模型（三级，按表选择）：
 *   - 查询（list / get）：所有已登录用户可用；
 *   - 写入（create / update / remove）：
 *       · write = 'manager' → 仅导师 / 管理员可写（管理类数据）；
 *       · write = 'member'  → 所有已登录用户可写（协作 / 登记类数据，导师常需代成员维护）；
 *       · write = 'self'    → 所有已登录用户可写，但只能操作 ownerField 指向自己的记录
 *                             （纯个人数据：待办 / 日程 / 消息；导师 / 管理员不受限）。
 *
 * 安全约定：
 *   - creatorField 指定的字段（created_by / author_id / uploader_id / user_id 等）在 create 时
 *     由后端用当前登录用户强制回填，前端传入值一律被覆盖，杜绝伪造「谁创建 / 谁所属」；
 *   - write='self' 时，update / remove 会校验记录归属，非本人（且非管理角色）一律拒绝；
 *   - 所有写操作先过 Repository 的字段白名单，越权列名被丢弃。
 *
 * 复杂业务（审核流 / 报名去重 / 计数器自增 / 归还流转等）在各自模块 Service 中补充，不在这里堆砌。
 */
const permission = require('./permission')
// 操作日志（独立模块，避免 crudService ↔ systemService 循环依赖）
const logService = require('./logService')

/**
 * @param {object} repo crudFactory 实例
 * @param {object} opts
 *   - label       资源中文名（用于错误消息）
 *   - write       'manager' | 'member' | 'self'，默认 'manager'
 *   - creatorField 创建人字段，create 时强制回填当前用户 id（防伪造）；不传则不回填
 *   - ownerField   write='self' 时，用于归属校验的所属字段（如 'user_id'）
 */
function createCrudService(repo, opts = {}) {
  const label = opts.label || '记录'
  const write = opts.write || 'manager'
  const creatorField = opts.creatorField || null
  const ownerField = opts.ownerField || null

  // 写权限校验：返回 null 表示放行，否则返回错误外壳
  function guardWrite() {
    if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
    if (write === 'manager' && !permission.isManager()) {
      return { success: false, message: `无权限：仅导师或管理员可操作${label}` }
    }
    return null
  }

  // self 模式的归属校验：非本人且非管理角色时拒绝（返回错误外壳，null 表示放行）
  async function guardOwn(id) {
    if (write !== 'self' || !ownerField) return null
    if (permission.isManager()) return null // 导师 / 管理员不受限
    const me = permission.currentUserId()
    const row = await repo.get(id)
    if (!row) return { success: false, message: `${label}不存在` }
    if (row[ownerField] !== me) return { success: false, message: `无权限：只能操作自己的${label}` }
    return null
  }

  async function list(filters = {}) {
    if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
    try {
      // self 模式：非管理角色只能看到「归属自己」的记录（个人数据隐私边界）
      const effectiveFilters = { ...filters }
      if (write === 'self' && ownerField && !permission.isManager()) {
        effectiveFilters[ownerField] = permission.currentUserId()
      }
      const rows = await repo.list(effectiveFilters)
      return { success: true, list: rows }
    } catch (err) {
      console.error(`[${repo.tableName}.list] 数据库异常:`, err)
      return { success: false, message: `查询${label}列表失败` }
    }
  }

  async function get(id) {
    if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
    if (id === null || id === undefined) return { success: false, message: '缺少记录标识' }
    try {
      const row = await repo.get(id)
      return { success: true, data: row }
    } catch (err) {
      console.error(`[${repo.tableName}.get] 数据库异常:`, err)
      return { success: false, message: `查询${label}失败` }
    }
  }

  async function create(payload) {
    const denied = guardWrite()
    if (denied) return denied
    try {
      const data = { ...(payload || {}) }
      // 创建人字段由后端强制回填，覆盖前端伪造值
      if (creatorField) data[creatorField] = permission.currentUserId()
      const id = await repo.create(data)
      logService.record('create', repo.tableName, id, data)
      return { success: true, id, message: '创建成功' }
    } catch (err) {
      console.error(`[${repo.tableName}.create] 数据库异常:`, err)
      return { success: false, message: '创建失败' }
    }
  }

  async function update(id, payload) {
    const denied = guardWrite()
    if (denied) return denied
    if (id === null || id === undefined) return { success: false, message: '缺少记录标识' }
    try {
      const ownDenied = await guardOwn(id)
      if (ownDenied) return ownDenied
      const affected = await repo.update(id, payload)
      if (affected) logService.record('update', repo.tableName, id, payload)
      return { success: true, message: affected ? '保存成功' : '记录不存在或内容未变化' }
    } catch (err) {
      console.error(`[${repo.tableName}.update] 数据库异常:`, err)
      return { success: false, message: '更新失败' }
    }
  }

  async function remove(id) {
    const denied = guardWrite()
    if (denied) return denied
    if (id === null || id === undefined) return { success: false, message: '缺少记录标识' }
    try {
      const ownDenied = await guardOwn(id)
      if (ownDenied) return ownDenied
      const affected = await repo.remove(id)
      if (affected) logService.record('delete', repo.tableName, id)
      return { success: true, message: affected ? '已删除' : '记录不存在' }
    } catch (err) {
      console.error(`[${repo.tableName}.remove] 数据库异常:`, err)
      return { success: false, message: '删除失败' }
    }
  }

  return { list, get, create, update, remove }
}

module.exports = { createCrudService }
