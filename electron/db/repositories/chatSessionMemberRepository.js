/**
 * 会话成员仓库（Repository Layer）—— 对应 `chat_session_member` 表
 *
 * 说明：成员记录不硬删，用户删除时仅打标记（is_user_deleted=1）；
 * 双方用户都被删除时由 chatService 在事务内硬删成员记录。
 * 本表不参与 BaseRepository 的 is_deleted 软删约定，SQL 均自实现。
 */
const BaseRepository = require('./BaseRepository')

class ChatSessionMemberRepository extends BaseRepository {
  constructor() {
    super('chat_session_member')
  }

  /**
   * 按会话 + 用户查成员记录
   * @param {number} sessionId
   * @param {number} userId
   */
  async findBySessionAndUser(sessionId, userId) {
    const sql =
      'SELECT * FROM `chat_session_member` WHERE session_id = ? AND user_id = ?'
    const [rows] = await this._execute(sql, [Number(sessionId), Number(userId)], 'findBySessionAndUser')
    return rows[0] || null
  }

  /**
   * 查会话中对方的成员记录（会话仅两人，user_id != 当前用户即对方）
   * @param {number} sessionId
   * @param {number} userId
   */
  async getPeerMember(sessionId, userId) {
    const sql =
      'SELECT * FROM `chat_session_member` WHERE session_id = ? AND user_id != ? LIMIT 1'
    const [rows] = await this._execute(sql, [Number(sessionId), Number(userId)], 'getPeerMember')
    return rows[0] || null
  }

  /**
   * 创建成员记录
   * @param {{ sessionId: number, userId: number }} param
   * @returns {number} 成员记录 id
   */
  async create({ sessionId, userId }) {
    return super.create({ session_id: Number(sessionId), user_id: Number(userId) })
  }

  /**
   * 更新已读游标（单调递增：仅当新游标更大才写入，防旧窗口回退覆盖）
   * @param {number} sessionId
   * @param {number} userId
   * @param {number} lastReadId
   * @param {string} time YYYY-MM-DD HH:mm:ss
   */
  async updateLastRead(sessionId, userId, lastReadId, time) {
    const sql =
      'UPDATE `chat_session_member` SET last_read_message_id = ?, last_read_time = ? ' +
      'WHERE session_id = ? AND user_id = ? AND (last_read_message_id IS NULL OR last_read_message_id < ?)'
    const [result] = await this._execute(
      sql,
      [Number(lastReadId), time, Number(sessionId), Number(userId), Number(lastReadId)],
      'updateLastRead'
    )
    return result.affectedRows
  }

  /**
   * 标记某用户的全部成员记录为已删除（删除用户事务内调用）
   * @param {number} userId
   */
  async markUserDeleted(userId) {
    const sql =
      'UPDATE `chat_session_member` SET is_user_deleted = 1 WHERE user_id = ? AND is_user_deleted = 0'
    const [result] = await this._execute(sql, [Number(userId)], 'markUserDeleted')
    return result.affectedRows
  }

  /**
   * 某用户参与的会话列表（会话 + 我的已读游标），供轮询与删除判定
   * @param {number} userId
   */
  async listSessionsOfUser(userId) {
    const sql =
      'SELECT session_id, last_read_message_id FROM `chat_session_member` WHERE user_id = ?'
    const [rows] = await this._execute(sql, [Number(userId)], 'listSessionsOfUser')
    return rows
  }

  /**
   * 会话中已标记删除的成员数（双方都删判定：达到 2 即硬删会话）
   * @param {number} sessionId
   */
  async countDeletedMembers(sessionId) {
    const sql =
      'SELECT COUNT(*) AS total FROM `chat_session_member` WHERE session_id = ? AND is_user_deleted = 1'
    const [rows] = await this._execute(sql, [Number(sessionId)], 'countDeletedMembers')
    return Number(rows[0] && rows[0].total) || 0
  }

  /**
   * 某用户参与的会话数（删除前影响提示用）
   * @param {number} userId
   */
  async countSessionsOfUser(userId) {
    const sql =
      'SELECT COUNT(*) AS total FROM `chat_session_member` WHERE user_id = ?'
    const [rows] = await this._execute(sql, [Number(userId)], 'countSessionsOfUser')
    return Number(rows[0] && rows[0].total) || 0
  }

  /**
   * 物理删除某会话的全部成员记录（会话硬删时，事务内调用）
   * @param {number} sessionId
   */
  async deleteBySessionId(sessionId) {
    const sql = 'DELETE FROM `chat_session_member` WHERE session_id = ?'
    const [result] = await this._execute(sql, [Number(sessionId)], 'deleteBySessionId')
    return result.affectedRows
  }
}

// 导出单例
module.exports = new ChatSessionMemberRepository()
