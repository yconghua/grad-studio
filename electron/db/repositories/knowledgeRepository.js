/**
 * 知识库目录仓库（Repository Layer）—— 对应 `knowledge` 表
 *
 * 继承 BaseRepository 获得通用 CRUD；树形节点查询在此以裸 SQL 表达。
 * 写入字段统一走 WRITE_FIELDS 白名单，前端夹带的非法列名一律丢弃。
 * 导出单例：全局共用同一个仓库实例。
 */
const BaseRepository = require('./BaseRepository')

// 安全返回列（含创建 / 更新时间）
const SAFE_COLUMNS = [
  'id',
  'group_id',
  'parent_id',
  'name',
  'node_type',
  'description',
  'sort_order',
  'created_by',
  'created_at',
  'updated_at'
]

// 写入字段白名单（不含 id / created_at / updated_at / is_deleted）
const WRITE_FIELDS = [
  'group_id',
  'parent_id',
  'name',
  'node_type',
  'description',
  'sort_order',
  'created_by'
]

// 列名拼接（反引号包裹，防与关键字冲突）
function cols(columns) {
  return columns.map((c) => `\`${c}\``).join(', ')
}

// 从输入对象中提取白名单内的可写字段：undefined 与空字符串跳过
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

class KnowledgeRepository extends BaseRepository {
  constructor() {
    super('knowledge')
  }

  /**
   * 按课题组列出全部知识库节点（树形数据由 Service 组装）
   * 排序：sort_order ASC, id ASC
   * @param {number} groupId
   * @returns {Object[]}
   */
  async listByGroup(groupId) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`knowledge\` WHERE group_id = ? AND is_deleted = 0 ORDER BY sort_order ASC, id ASC`
    const [rows] = await this._execute(sql, [groupId], 'listByGroup')
    return rows
  }

  /**
   * 新增知识库节点（白名单过滤后写入）
   * @param {Object} data
   * @returns {number} 新节点 id
   */
  async createNode(data) {
    return this.create(pickWrite(data))
  }

  /**
   * 按主键增量更新节点（仅白名单内字段生效）
   * @param {number} id
   * @param {Object} data
   * @returns {number} 受影响行数
   */
  async updateNode(id, data) {
    return this.update(id, pickWrite(data))
  }
}

module.exports = new KnowledgeRepository()
