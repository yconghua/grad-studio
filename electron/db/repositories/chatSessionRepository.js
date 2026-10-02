/**
 * 会话仓库（Repository Layer）—— 对应 `chat_session` 表
 *
 * 说明：会话永久保留，本表不参与 BaseRepository 的 is_deleted 软删约定，
 * 删除（双方用户都被删时）为物理删除，由 chatService 在事务内调用。
 * 列表查询 LEFT JOIN users 取对方信息，对方用户被物理删除后 peer 行置空，
 * 会话仍保留展示（发送人显示「已删除用户」）。
 */
const BaseRepository = require('./BaseRepository')

// 列名拼接（JOIN 后带 s. 前缀，避免 id 等列名歧义）
function cols(columns) {
  return columns.map((c) => `s.\`${c}\``).join(', ')
}

// 会话安全返回列
const SAFE_COLUMNS = ['id', 'user_low', 'user_high', 'last_message_id', 'last_message_time', 'created_at', 'updated_at']

class ChatSessionRepository extends BaseRepository {
  constructor() {
    super('chat_session')
  }

  /**
   * 按主键查询会话
   * @param {number} id
   */
  async findById(id) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`chat_session\` s WHERE s.id = ?`
    const [rows] = await this._execute(sql, [Number(id)], 'findById')
    return rows[0] || null
  }

  /**
   * 按用户对查询会话（user_low < user_high）
   * @param {number} low
   * @param {number} high
   */
  async findByUserPair(low, high) {
    const sql =
      `SELECT ${cols(SAFE_COLUMNS)} FROM \`chat_session\` s WHERE s.user_low = ? AND s.user_high = ?`
    const [rows] = await this._execute(sql, [Number(low), Number(high)], 'findByUserPair')
    return rows[0] || null
  }

  /**
   * 创建会话（调用方须先保证 user_low < user_high）
   * @param {{ userLow: number, userHigh: number }} param
   * @returns {number} 会话 id
   */
  async create({ userLow, userHigh }) {
    return this._create({ user_low: Number(userLow), user_high: Number(userHigh) })
  }

  // 插入（沿用 BaseRepository 的清洗与日志）
  async _create(data) {
    return super.create(data)
  }

  /**
   * 更新会话最后一条消息（发消息同一事务内调用）
   * @param {number} sessionId
   * @param {number} messageId
   * @param {string} time YYYY-MM-DD HH:mm:ss
   */
  async updateLastMessage(sessionId, messageId, time) {
    const sql = 'UPDATE `chat_session` SET last_message_id = ?, last_message_time = ? WHERE id = ?'
    const [result] = await this._execute(sql, [Number(messageId), time, Number(sessionId)], 'updateLastMessage')
    return result.affectedRows
  }

  /**
   * 我的会话列表：会话 + 对方用户信息 + 对方删除标记 + 未读数。
   * 对方被物理删除后 users 行消失，peer 信息置空，但对方成员记录仍在
   * （is_user_deleted=1），据此展示「已删除用户」。
   * 未读口径：id > 我的已读游标 且 非我发送 且 状态正常。
   * @param {number} userId
   */
  async listByUser(userId) {
    const uid = Number(userId)
    const sql =
      `SELECT ${cols(SAFE_COLUMNS)}, ` +
      'o.id AS peer_id, o.username AS peer_username, o.real_name AS peer_real_name, ' +
      'om.is_user_deleted AS peer_deleted, m.last_read_message_id AS my_last_read_id, ' +
      '(SELECT COUNT(*) FROM `chat_message` cm ' +
      '  WHERE cm.session_id = s.id AND cm.id > COALESCE(m.last_read_message_id, 0) ' +
      '    AND cm.sender_id != ? AND cm.status = 1) AS unread_count ' +
      'FROM `chat_session` s ' +
      'JOIN `chat_session_member` m ON m.session_id = s.id AND m.user_id = ? ' +
      'LEFT JOIN `chat_session_member` om ON om.session_id = s.id AND om.user_id != ? ' +
      'LEFT JOIN `users` o ON o.id = om.user_id ' +
      'ORDER BY s.last_message_time DESC, s.id DESC'
    const [rows] = await this._execute(sql, [uid, uid, uid], 'listByUser')
    return rows
  }

  /**
   * 物理删除会话（双方用户都被删除时，事务内调用）
   * @param {number} sessionId
   */
  async deleteById(sessionId) {
    const sql = 'DELETE FROM `chat_session` WHERE id = ?'
    const [result] = await this._execute(sql, [Number(sessionId)], 'deleteById')
    return result.affectedRows
  }
}

// 导出单例
module.exports = new ChatSessionRepository()
