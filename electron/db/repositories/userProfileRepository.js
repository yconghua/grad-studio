/**
 * 用户档案仓库（Repository Layer）—— 对应 `user_profile` 表
 *
 * 与 user 表一对一（user_id 唯一索引）。本人档案的读写全部走这里：
 * 服务层按 currentUserId 定位 user_id，记录不存在时由服务层触发创建。
 *
 * 写入字段统一经 pickWrite 白名单过滤，杜绝前端越权写入 id / user_id 之外的敏感列。
 * 导出单例。
 */
const BaseRepository = require('./BaseRepository')

// 业务列（不含 id / created_at / updated_at / is_deleted）
const SAFE_COLUMNS = [
  'id', 'user_id', 'real_name', 'gender', 'student_no', 'email',
  'phone', 'avatar', 'college', 'department', 'major', 'grade',
  'degree_type', 'position', 'bio', 'join_date'
]

// 可写字段（不含 id / created_at / updated_at / is_deleted；user_id 由服务层显式写入）
const WRITE_FIELDS = [
  'user_id', 'real_name', 'gender', 'student_no', 'email',
  'phone', 'avatar', 'college', 'department', 'major', 'grade',
  'degree_type', 'position', 'bio', 'join_date'
]

function cols(columns) {
  return columns.map((c) => `\`${c}\``).join(', ')
}

// 白名单提取：undefined 跳过（未传），空串跳过（未填写），null 保留（显式清空）
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

class UserProfileRepository extends BaseRepository {
  constructor() {
    super('user_profile')
  }

  /**
   * 按 user_id 查询档案（user_id 唯一）
   * @param {number} userId
   * @returns {Object|null}
   */
  async findByUserId(userId) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`user_profile\` WHERE \`user_id\` = ? AND is_deleted = 0`
    const [rows] = await this._execute(sql, [userId], 'findByUserId')
    return rows[0] || null
  }

  // 白名单提取可写入字段（供服务层 create / update 使用）
  pick(data) {
    return pickWrite(data)
  }
}

module.exports = new UserProfileRepository()
