/**
 * 系统参数仓库（Repository Layer）—— 对应 `system_param` 表
 *
 * 全局键值配置：param_key 唯一。列出全部、按键查存在性在此以裸 SQL 表达。
 * 写入字段统一走 WRITE_FIELDS 白名单。
 * 导出单例：全局共用同一个仓库实例。
 */
const BaseRepository = require('./BaseRepository')

const SAFE_COLUMNS = [
  'id',
  'param_key',
  'param_value',
  'description',
  'updated_by',
  'created_at',
  'updated_at'
]

// 写入字段白名单（不含 id / created_at / updated_at / is_deleted）
const WRITE_FIELDS = [
  'param_key',
  'param_value',
  'description',
  'updated_by'
]

function cols(columns) {
  return columns.map((c) => `\`${c}\``).join(', ')
}

// 从输入对象中提取白名单内的可写字段：undefined 跳过
function pickWrite(data) {
  const out = {}
  for (const k of WRITE_FIELDS) {
    const v = data ? data[k] : undefined
    if (v === undefined) continue
    out[k] = v
  }
  return out
}

class SystemParamRepository extends BaseRepository {
  constructor() {
    super('system_param')
  }

  /**
   * 列出全部系统参数
   * @returns {Object[]}
   */
  async listAll() {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`system_param\` WHERE is_deleted = 0 ORDER BY id ASC`
    const [rows] = await this._execute(sql, [], 'listAll')
    return rows
  }

  /**
   * 按参数键查单条（upsert 前的存在性判断）
   * @param {string} paramKey
   * @returns {Object|null}
   */
  async findByKey(paramKey) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`system_param\` WHERE param_key = ? AND is_deleted = 0`
    const [rows] = await this._execute(sql, [paramKey], 'findByKey')
    return rows[0] || null
  }

  /**
   * 新增参数（白名单过滤后写入）
   * @param {Object} data
   * @returns {number} 新记录 id
   */
  async createParam(data) {
    return this.create(pickWrite(data))
  }

  /**
   * 按主键增量更新参数（仅白名单内字段生效）
   * @param {number} id
   * @param {Object} data
   * @returns {number} 受影响行数
   */
  async updateParam(id, data) {
    return this.update(id, pickWrite(data))
  }
}

module.exports = new SystemParamRepository()
