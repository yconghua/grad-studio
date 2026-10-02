/**
 * 消息仓库（Repository Layer）—— 对应 `chat_message` 表
 *
 * 说明：消息一旦写入永不删除（撤回置 status=2 并清空内容）；
 * 用户删除时标记 sender_deleted_mark=1；双方用户都被删除时由 chatService
 * 在事务内硬删消息。本表不参与 BaseRepository 的 is_deleted 软删约定，SQL 均自实现。
 * 排序与增量锚点统一使用自增主键 id。
 */
const BaseRepository = require('./BaseRepository')

// 消息安全返回列
const SAFE_COLUMNS = [
  'id', 'session_id', 'sender_id', 'client_message_id', 'content',
  'status', 'created_at', 'recalled_at', 'sender_deleted_mark'
]

// 列名拼接
function cols(columns) {
  return columns.map((c) => `\`${c}\``).join(', ')
}

class ChatMessageRepository extends BaseRepository {
  constructor() {
    super('chat_message')
  }

  /**
   * 按主键查询消息
   * @param {number} id
   */
  async findById(id) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`chat_message\` WHERE id = ?`
    const [rows] = await this._execute(sql, [Number(id)], 'findById')
    return rows[0] || null
  }

  /**
   * 按客户端消息 ID 查重（幂等：同一发送人同一 client_message_id 只写一条）
   * @param {number} senderId
   * @param {string} clientMessageId
   */
  async findByClientId(senderId, clientMessageId) {
    const sql =
      `SELECT ${cols(SAFE_COLUMNS)} FROM \`chat_message\` WHERE sender_id = ? AND client_message_id = ?`
    const [rows] = await this._execute(sql, [Number(senderId), String(clientMessageId)], 'findByClientId')
    return rows[0] || null
  }

  /**
   * 插入消息
   * @param {{ sessionId: number, senderId: number, clientMessageId: string, content: string, status: number }} param
   * @returns {number} 消息 id
   */
  async create({ sessionId, senderId, clientMessageId, content, status }) {
    return super.create({
      session_id: Number(sessionId),
      sender_id: Number(senderId),
      client_message_id: String(clientMessageId),
      content: String(content),
      status: Number(status)
    })
  }

  /**
   * 历史分页：取 id < beforeId 的最近 limit 条（按 id 倒序取，调用方再反转展示）
   * @param {number} sessionId
   * @param {number} beforeId 更早锚点（首屏传极大值取最近 limit 条）
   * @param {number} limit
   */
  async pageHistory(sessionId, beforeId, limit) {
    const lmt = Math.max(1, parseInt(limit, 10) || 50)
    const sql =
      `SELECT ${cols(SAFE_COLUMNS)} FROM \`chat_message\` ` +
      'WHERE session_id = ? AND id < ? ORDER BY id DESC LIMIT ' + lmt
    const [rows] = await this._execute(sql, [Number(sessionId), Number(beforeId)], 'pageHistory')
    return rows
  }

  /**
   * 增量拉取：取 id > afterId 的 limit 条（按 id 升序）
   * @param {number} sessionId
   * @param {number} afterId 增量锚点（最后已拉取消息 id）
   * @param {number} limit
   */
  async increment(sessionId, afterId, limit) {
    const lmt = Math.max(1, parseInt(limit, 10) || 200)
    const sql =
      `SELECT ${cols(SAFE_COLUMNS)} FROM \`chat_message\` ` +
      'WHERE session_id = ? AND id > ? ORDER BY id ASC LIMIT ' + lmt
    const [rows] = await this._execute(sql, [Number(sessionId), Number(afterId)], 'increment')
    return rows
  }

  /**
   * 某用户全部未读消息数（未读口径：我参与会话中 id > 我的已读游标 且 非我发送 且 状态正常）
   * @param {number} userId
   */
  async countUnreadForUser(userId) {
    const sql =
      'SELECT COUNT(*) AS total FROM `chat_message` cm ' +
      'JOIN `chat_session_member` m ON m.session_id = cm.session_id AND m.user_id = ? ' +
      'WHERE cm.id > COALESCE(m.last_read_message_id, 0) AND cm.sender_id != ? AND cm.status = 1'
    const [rows] = await this._execute(sql, [Number(userId), Number(userId)], 'countUnreadForUser')
    return Number(rows[0] && rows[0].total) || 0
  }

  /**
   * 消息存活秒数（撤回窗口判断用，以数据库时钟为准，避免主进程与 MySQL 时钟偏差）
   * @param {number} id
   */
  async ageSeconds(id) {
    const sql =
      'SELECT TIMESTAMPDIFF(SECOND, created_at, NOW()) AS age FROM `chat_message` WHERE id = ?'
    const [rows] = await this._execute(sql, [Number(id)], 'ageSeconds')
    return Number(rows[0] && rows[0].age) || 0
  }

  /**
   * 撤回消息：置为已撤回、清空内容、记录撤回时间（带 status=1 条件兜底并发）
   * @param {number} id
   */
  async recall(id) {
    const sql =
      "UPDATE `chat_message` SET status = 2, content = '', recalled_at = NOW() " +
      'WHERE id = ? AND status = 1'
    const [result] = await this._execute(sql, [Number(id)], 'recall')
    return result.affectedRows
  }

  /**
   * 标记某用户发送的全部消息（删除用户事务内调用）
   * @param {number} userId
   */
  async markSenderDeleted(userId) {
    const sql =
      'UPDATE `chat_message` SET sender_deleted_mark = 1 WHERE sender_id = ? AND sender_deleted_mark = 0'
    const [result] = await this._execute(sql, [Number(userId)], 'markSenderDeleted')
    return result.affectedRows
  }

  /**
   * 物理删除某会话的全部消息（会话硬删时，事务内调用）
   * @param {number} sessionId
   */
  async deleteBySessionId(sessionId) {
    const sql = 'DELETE FROM `chat_message` WHERE session_id = ?'
    const [result] = await this._execute(sql, [Number(sessionId)], 'deleteBySessionId')
    return result.affectedRows
  }

  /**
   * 一批会话中的最大消息 id（ChatPoller 锚点：检测新消息）
   * @param {number[]} sessionIds
   */
  async maxIdOfSessions(sessionIds) {
    if (!sessionIds || sessionIds.length === 0) return 0
    const marks = sessionIds.map(() => '?').join(', ')
    const sql = `SELECT MAX(id) AS max_id FROM \`chat_message\` WHERE session_id IN (${marks})`
    const [rows] = await this._execute(sql, sessionIds, 'maxIdOfSessions')
    return Number(rows[0] && rows[0].max_id) || 0
  }

  /**
   * 一批会话中最近一条撤回消息（ChatPoller 锚点：检测撤回变化）
   * @param {number[]} sessionIds
   * @returns {{ id: number, session_id: number, recalled_at: string }|null}
   */
  async lastRecalledOfSessions(sessionIds) {
    if (!sessionIds || sessionIds.length === 0) return null
    const marks = sessionIds.map(() => '?').join(', ')
    const sql =
      'SELECT id, session_id, recalled_at FROM `chat_message` ' +
      `WHERE session_id IN (${marks}) AND recalled_at IS NOT NULL ORDER BY recalled_at DESC, id DESC LIMIT 1`
    const [rows] = await this._execute(sql, sessionIds, 'lastRecalledOfSessions')
    return rows[0] || null
  }
}

// 导出单例
module.exports = new ChatMessageRepository()
