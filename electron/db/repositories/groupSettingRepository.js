/**
 * 课题组配置仓库（Repository Layer）—— 对应 `group_setting` 表
 *
 * 键值对模型：(group_id, config_key) 唯一。读取整组配置、按键查存在性在此以裸 SQL 表达。
 * 写入字段统一走 WRITE_FIELDS 白名单。
 * 导出单例：全局共用同一个仓库实例。
 */
const BaseRepository = require('./BaseRepository')

const SAFE_COLUMNS = [
  'id',
  'group_id',
  'config_key',
  'config_value',
  'description',
  'updated_by',
  'created_at',
  'updated_at'
]

// 写入字段白名单（不含 id / created_at / updated_at / is_deleted）
const WRITE_FIELDS = [
  'group_id',
  'config_key',
  'config_value',
  'description',
  'updated_by'
]

function cols(columns) {
  return columns.map((c) => `\`${c}\``).join(', ')
}

// 从输入对象中提取白名单内的可写字段：undefined 跳过；空字符串保留（允许清空配置值时由调用方决定）
function pickWrite(data) {
  const out = {}
  for (const k of WRITE_FIELDS) {
    const v = data ? data[k] : undefined
    if (v === undefined) continue
    out[k] = v
  }
  return out
}

class GroupSettingRepository extends BaseRepository {
  constructor() {
    super('group_setting')
  }

  /**
   * 按课题组列出全部配置
   * @param {number} groupId
   * @returns {Object[]}
   */
  async listByGroupId(groupId) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`group_setting\` WHERE group_id = ? AND is_deleted = 0 ORDER BY id ASC`
    const [rows] = await this._execute(sql, [groupId], 'listByGroupId')
    return rows
  }

  /**
   * 按课题组 + 配置键查单条（upsert 前的存在性判断）
   * @param {number} groupId
   * @param {string} configKey
   * @returns {Object|null}
   */
  async findByGroupAndKey(groupId, configKey) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`group_setting\` WHERE group_id = ? AND config_key = ? AND is_deleted = 0`
    const [rows] = await this._execute(sql, [groupId, configKey], 'findByGroupAndKey')
    return rows[0] || null
  }

  /**
   * 新增配置（白名单过滤后写入）
   * @param {Object} data
   * @returns {number} 新记录 id
   */
  async createSetting(data) {
    return this.create(pickWrite(data))
  }

  /**
   * 按主键增量更新配置（仅白名单内字段生效）
   * @param {number} id
   * @param {Object} data
   * @returns {number} 受影响行数
   */
  async updateSetting(id, data) {
    return this.update(id, pickWrite(data))
  }
}

module.exports = new GroupSettingRepository()
