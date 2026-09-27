/**
 * 课题组仓库（Repository Layer）—— 对应 `group` 表
 *
 * 课题组是平台级组织单位，由超级管理员维护。
 * code 唯一索引，创建 / 编辑时需查重。
 * 导出单例。
 */
const BaseRepository = require('./BaseRepository')
const { buildWhereClause } = require('./queryHelpers')

const SAFE_COLUMNS = [
  'id', 'name', 'code', 'description', 'leader_id', 'status', 'created_by'
]

const WRITE_FIELDS = [
  'name', 'code', 'description', 'leader_id', 'status', 'created_by'
]

function cols(columns) {
  return columns.map((c) => `\`${c}\``).join(', ')
}

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

class GroupRepository extends BaseRepository {
  constructor() {
    super('group')
  }

  /**
   * 课题组列表，支持按名称 / 编号关键字、状态过滤
   * @param {{ keyword?: string, status?: string }} filters
   * @returns {Object[]}
   */
  async list(filters = {}) {
    const conditions = [{ field: 'is_deleted', op: '=', value: 0 }]
    if (filters.status) {
      conditions.push({ field: 'status', op: '=', value: filters.status })
    }
    if (filters.keyword) {
      conditions.push({
        field: 'name',
        op: 'LIKE',
        value: `%${filters.keyword}%`
      })
    }
    const { clause, values } = buildWhereClause(conditions)
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`group\` ${clause} ORDER BY id ASC`
    const [rows] = await this._execute(sql, values, 'list')
    return rows
  }

  /**
   * 按编号查重（创建 / 编辑时调用；排除自身 id 可选）
   * @param {string} code
   * @param {number?} excludeId 编辑时排除当前记录
   * @returns {Object|null}
   */
  async findByCode(code, excludeId) {
    const params = [code]
    let excludeSql = ''
    if (excludeId) {
      excludeSql = ' AND id <> ?'
      params.push(excludeId)
    }
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`group\` WHERE \`code\` = ? AND is_deleted = 0${excludeSql}`
    const [rows] = await this._execute(sql, params, 'findByCode')
    return rows[0] || null
  }

  // 白名单提取可写入字段
  pick(data) {
    return pickWrite(data)
  }
}

module.exports = new GroupRepository()
