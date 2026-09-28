/**
 * 公告仓库（Repository Layer）—— 对应 `notice` 表
 *
 * 课题组公告：组管新增 / 编辑 / 删除 / 置顶，导师与学生只读。
 * 列表排序：is_top DESC, published_at DESC；未读数通过 NOT EXISTS 子查询统计。
 * 导出单例。
 */
const BaseRepository = require('./BaseRepository')

const SAFE_COLUMNS = [
  'id', 'group_id', 'meeting_id', 'title', 'content', 'is_top',
  'publisher_id', 'status', 'published_at'
]

const WRITE_FIELDS = [
  'group_id', 'meeting_id', 'title', 'content', 'is_top',
  'publisher_id', 'status', 'published_at'
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

class NoticeRepository extends BaseRepository {
  constructor() {
    super('notice')
  }

  /**
   * 按课题组列出生效公告（置顶优先、发布时间倒序）
   * @param {number} groupId
   * @returns {Object[]}
   */
  async listByGroup(groupId) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`notice\`
      WHERE \`group_id\` = ? AND \`status\` = 'active' AND is_deleted = 0
      ORDER BY \`is_top\` DESC, \`published_at\` DESC, \`id\` DESC`
    const [rows] = await this._execute(sql, [groupId], 'listByGroup')
    return rows
  }

  /**
   * 统计某课题组生效公告总数（未读 = 总数 - 已读数）
   * @param {number} groupId
   * @returns {number}
   */
  async countActiveByGroup(groupId) {
    const sql = `SELECT COUNT(*) AS cnt FROM \`notice\`
      WHERE \`group_id\` = ? AND \`status\` = 'active' AND is_deleted = 0`
    const [rows] = await this._execute(sql, [groupId], 'countActiveByGroup')
    return rows[0] ? rows[0].cnt : 0
  }

  /**
   * 统计当前用户在某课题组的未读公告数（NOT EXISTS 排除已读记录）
   * @param {number} groupId
   * @param {number} userId
   * @returns {number}
   */
  async countUnreadByGroup(groupId, userId) {
    const sql = `SELECT COUNT(*) AS cnt FROM \`notice\` \`n\`
      WHERE \`n\`.\`group_id\` = ? AND \`n\`.\`status\` = 'active' AND \`n\`.\`is_deleted\` = 0
      AND NOT EXISTS (
        SELECT 1 FROM \`notice_read\` \`r\`
        WHERE \`r\`.\`notice_id\` = \`n\`.\`id\` AND \`r\`.\`user_id\` = ? AND \`r\`.\`is_deleted\` = 0
      )`
    const [rows] = await this._execute(sql, [groupId, userId], 'countUnreadByGroup')
    return rows[0] ? rows[0].cnt : 0
  }

  /**
   * 取一组公告 id 中当前用户已读的 id 集合（列表页打 is_read 标记用）
   * @param {number[]} noticeIds
   * @param {number} userId
   * @returns {Set<number>}
   */
  async readNoticeIds(noticeIds, userId) {
    if (!Array.isArray(noticeIds) || !noticeIds.length) return new Set()
    const placeholders = noticeIds.map(() => '?').join(', ')
    const sql = `SELECT \`notice_id\` FROM \`notice_read\`
      WHERE \`notice_id\` IN (${placeholders}) AND \`user_id\` = ? AND \`is_deleted\` = 0`
    const [rows] = await this._execute(sql, [...noticeIds, userId], 'readNoticeIds')
    return new Set(rows.map((r) => r.notice_id))
  }

  /**
   * 按关联组会查生效公告（组会发布自动生成的公告，一组会最多一条）
   * @param {number} meetingId
   * @returns {Object|null}
   */
  async findByMeetingId(meetingId) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`notice\`
      WHERE \`meeting_id\` = ? AND \`status\` = 'active' AND is_deleted = 0
      ORDER BY id DESC LIMIT 1`
    const [rows] = await this._execute(sql, [meetingId], 'findByMeetingId')
    return rows[0] || null
  }

  // 白名单提取可写入字段
  pick(data) {
    return pickWrite(data)
  }
}

module.exports = new NoticeRepository()
