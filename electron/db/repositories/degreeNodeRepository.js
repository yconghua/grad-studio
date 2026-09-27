/**
 * 学位节点仓库（Repository Layer）—— 对应 `degree_node` 表
 *
 * 继承 BaseRepository 获得通用 CRUD；节点按 group_id 隔离，按 node_order 升序排列。
 * 写入字段统一走 pickWrite 白名单，前端夹带的非法列名 / 敏感列一律丢弃。
 * 导出单例。
 */
const BaseRepository = require('./BaseRepository')

// 安全返回列（业务列 + 时间戳，不含 is_deleted）
const SAFE_COLUMNS = [
  'id',
  'group_id',
  'name',
  'node_order',
  'description',
  'is_required',
  'created_at',
  'updated_at'
]

// 可写字段（不含 id / created_at / updated_at / is_deleted）
const WRITE_FIELDS = [
  'group_id',
  'name',
  'node_order',
  'description',
  'is_required'
]

function cols(columns) {
  return columns.map((c) => `\`${c}\``).join(', ')
}

// 白名单过滤：跳过 undefined（未传）与空字符串 ''（视为未填写），null 保留（显式清空）
function pickWrite(data) {
  const out = {}
  for (const k of WRITE_FIELDS) {
    const v = data ? data[k] : undefined
    if (v === undefined) continue
    if (typeof v === 'string' && v.trim() === '') continue
    out[k] = v
  }
  return out
}

class DegreeNodeRepository extends BaseRepository {
  constructor() {
    super('degree_node')
  }

  // 写入前统一白名单过滤
  async create(data) {
    return super.create(pickWrite(data))
  }

  async update(id, data) {
    return super.update(id, pickWrite(data))
  }

  // 按课题组列出学位节点，顺序号小在前
  async listByGroup(groupId) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`degree_node\` WHERE group_id = ? AND is_deleted = 0 ORDER BY node_order ASC, id ASC`
    const [rows] = await this._execute(sql, [groupId], 'listByGroup')
    return rows
  }

  // 新增或更新节点：id 存在则更新，否则创建
  async save(data) {
    const write = pickWrite(data)
    if (data && data.id) {
      await this.update(data.id, write)
      return data.id
    }
    return this.create(write)
  }
}

module.exports = new DegreeNodeRepository()
