/**
 * 课题组公告已读仓库（Repository Layer）—— 对应 `group_notice_read` 表
 *
 * 说明：导师/学生标记已读，唯一键 uk_notice_user 保证同一公告同一用户仅一条；
 * 公告删除时清空其已读记录，课题组删除时级联清空该组公告的已读记录。
 */
const BaseRepository = require('./BaseRepository')

class GroupNoticeReadRepository extends BaseRepository {
  constructor() {
    super('group_notice_read')
  }

  /**
   * 幂等标记已读：重复标记不改变首次已读时间
   * @param {number} noticeId
   * @param {number} userId
   */
  async markRead(noticeId, userId) {
    const sql =
      `INSERT INTO \`group_notice_read\` (\`notice_id\`, \`user_id\`, \`read_at\`) VALUES (?, ?, NOW()) ` +
      'ON DUPLICATE KEY UPDATE `read_at` = `read_at`'
    const [result] = await this._execute(sql, [Number(noticeId), Number(userId)], 'markRead')
    return result.affectedRows
  }

  /**
   * 某公告已读人数
   * @param {number} noticeId
   * @returns {number}
   */
  async countByNotice(noticeId) {
    const sql = 'SELECT COUNT(*) AS total FROM `group_notice_read` WHERE notice_id = ?'
    const [rows] = await this._execute(sql, [Number(noticeId)], 'countByNotice')
    return Number(rows[0] && rows[0].total) || 0
  }

  /**
   * 某公告已读名单（含用户姓名，发布人被删时姓名回退为空）
   * @param {number} noticeId
   * @returns {Array<{ user_id: number, read_at: string, real_name: string|null, username: string }>}
   */
  async listByNotice(noticeId) {
    const sql =
      `SELECT r.user_id, r.read_at, u.real_name, u.username FROM \`group_notice_read\` r ` +
      'LEFT JOIN `users` u ON u.id = r.user_id WHERE r.notice_id = ? ORDER BY r.read_at DESC'
    const [rows] = await this._execute(sql, [Number(noticeId)], 'listByNotice')
    return rows
  }

  /**
   * 某用户已读过的全部公告ID（列表页标注「是否已读」用）
   * @param {number} userId
   * @returns {number[]}
   */
  async findReadIdsByUser(userId) {
    const sql = 'SELECT notice_id FROM `group_notice_read` WHERE user_id = ?'
    const [rows] = await this._execute(sql, [Number(userId)], 'findReadIdsByUser')
    return rows.map((r) => Number(r.notice_id))
  }

  /**
   * 删除某公告的全部已读记录（公告硬删除时调用，避免孤儿数据）
   * @param {number} noticeId
   */
  async deleteByNoticeId(noticeId) {
    const sql = 'DELETE FROM `group_notice_read` WHERE notice_id = ?'
    const [result] = await this._execute(sql, [Number(noticeId)], 'deleteByNoticeId')
    return result.affectedRows
  }

  /**
   * 删除某课题组下全部公告的已读记录（课题组删除时级联调用）
   * @param {number} groupId
   */
  async deleteByGroupId(groupId) {
    const sql =
      'DELETE r FROM `group_notice_read` r JOIN `group_notice` n ON r.notice_id = n.id WHERE n.group_id = ?'
    const [result] = await this._execute(sql, [Number(groupId)], 'deleteByGroupId')
    return result.affectedRows
  }
}

// 导出单例
module.exports = new GroupNoticeReadRepository()
