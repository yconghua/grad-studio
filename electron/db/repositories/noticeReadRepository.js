/**
 * 公告已读仓库（Repository Layer）—— 对应 `notice_read` 表
 *
 * 记录「哪个用户已读哪条公告」。唯一索引 (notice_id, user_id)，
 * 标记已读需幂等：已存在则不重复插入。本表只有 created_at，无 updated_at。
 * 导出单例。
 */
const BaseRepository = require('./BaseRepository')

const SAFE_COLUMNS = [
  'id', 'notice_id', 'user_id', 'read_at'
]

const WRITE_FIELDS = [
  'notice_id', 'user_id', 'read_at'
]

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

class NoticeReadRepository extends BaseRepository {
  constructor() {
    super('notice_read')
  }

  /**
   * 按 (notice_id, user_id) 查已读记录（幂等判断用）
   * @param {number} noticeId
   * @param {number} userId
   * @returns {Object|null}
   */
  async findByNoticeAndUser(noticeId, userId) {
    const sql = `SELECT \`id\`, \`notice_id\`, \`user_id\`, \`read_at\` FROM \`notice_read\`
      WHERE \`notice_id\` = ? AND \`user_id\` = ? AND \`is_deleted\` = 0`
    const [rows] = await this._execute(sql, [noticeId, userId], 'findByNoticeAndUser')
    return rows[0] || null
  }

  // 白名单提取可写入字段
  pick(data) {
    return pickWrite(data)
  }
}

module.exports = new NoticeReadRepository()
