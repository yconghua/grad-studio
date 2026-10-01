/**
 * 组会参与人仓库（Repository Layer）—— 对应 `group_meeting_participant` 表
 *
 * 说明：参与人由发布者指定（不做参与确认），同一会议同一用户仅一条（唯一键幂等）。
 * 列表 JOIN `users` 取姓名 / 用户名 / 角色，用户被删除时姓名回退「用户 #id」。
 */
class GroupMeetingParticipantRepository {
  constructor() {
    this.tableName = 'group_meeting_participant'
  }

  /** 统一 SQL 执行出口（复用 BaseRepository 的连接获取与日志） */
  async _execute(sql, params, action) {
    const BaseRepository = require('./BaseRepository')
    return new BaseRepository(this.tableName)._execute(sql, params, action)
  }

  /** 某会议参与人名单（JOIN users 取姓名/用户名/角色） */
  async listByMeeting(meetingId) {
    const sql =
      `SELECT p.user_id, p.role_in_meeting, p.create_time,
        u.real_name, u.username, u.role
      FROM \`group_meeting_participant\` p
      LEFT JOIN \`users\` u ON u.id = p.user_id
      WHERE p.meeting_id = ?
      ORDER BY p.id ASC`
    const [rows] = await this._execute(sql, [Number(meetingId)], 'listByMeeting')
    return rows
  }

  /** 某用户参与过的全部会议 id 列表 */
  async listMeetingIdsByUser(userId) {
    const sql = 'SELECT meeting_id FROM `group_meeting_participant` WHERE user_id = ?'
    const [rows] = await this._execute(sql, [Number(userId)], 'listMeetingIdsByUser')
    return rows.map((r) => Number(r.meeting_id))
  }

  /** 批量插入参与人（INSERT IGNORE：同人同会重复静默跳过） */
  async createMany(meetingId, userIds) {
    if (!Array.isArray(userIds) || userIds.length === 0) return 0
    const marks = userIds.map(() => '(?, ?)').join(', ')
    const values = []
    for (const uid of userIds) {
      values.push(Number(meetingId), Number(uid))
    }
    const sql = `INSERT IGNORE INTO \`group_meeting_participant\` (meeting_id, user_id) VALUES ${marks}`
    const [result] = await this._execute(sql, values, 'createMany')
    return result.affectedRows
  }

  /** 删除某会议全部参与人（编辑全量替换 / 删除会议级联用） */
  async deleteByMeeting(meetingId) {
    const sql = 'DELETE FROM `group_meeting_participant` WHERE meeting_id = ?'
    const [result] = await this._execute(sql, [Number(meetingId)], 'deleteByMeeting')
    return result.affectedRows
  }

  /** 删除某会议指定参与人（发布时移除已失效成员用） */
  async deleteByMeetingAndUsers(meetingId, userIds) {
    if (!Array.isArray(userIds) || userIds.length === 0) return 0
    const marks = userIds.map(() => '?').join(', ')
    const sql = `DELETE FROM \`group_meeting_participant\` WHERE meeting_id = ? AND user_id IN (${marks})`
    const [result] = await this._execute(sql, [Number(meetingId), ...userIds.map(Number)], 'deleteByMeetingAndUsers')
    return result.affectedRows
  }

  /** 某会议参与人数量 */
  async countByMeeting(meetingId) {
    const sql = 'SELECT COUNT(*) AS total FROM `group_meeting_participant` WHERE meeting_id = ?'
    const [rows] = await this._execute(sql, [Number(meetingId)], 'countByMeeting')
    return Number(rows[0] && rows[0].total) || 0
  }

  /** 按会议归属课题组删除全部参与人（课题组删除时级联调用，经子查询定位） */
  async deleteByGroupId(groupId) {
    const sql =
      'DELETE FROM `group_meeting_participant` WHERE meeting_id IN (SELECT id FROM `group_meeting` WHERE group_id = ?)'
    const [result] = await this._execute(sql, [Number(groupId)], 'deleteByGroupId')
    return result.affectedRows
  }
}

module.exports = new GroupMeetingParticipantRepository()
