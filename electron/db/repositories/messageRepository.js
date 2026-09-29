/**
 * 站内消息仓库（Repository Layer）—— 对应 `message` 表
 *
 * 面向「接收人本人」的查询与已读更新在此以裸 SQL 表达。
 * 写入字段统一走 WRITE_FIELDS 白名单。
 * 导出单例：全局共用同一个仓库实例。
 */
const BaseRepository = require('./BaseRepository')
const { buildWhereClause } = require('./queryHelpers')

// 安全返回列
const SAFE_COLUMNS = [
  'id',
  'sender_id',
  'receiver_id',
  'msg_type',
  'title',
  'content',
  'status',
  'ref_type',
  'ref_id',
  'chat_message_id',
  'created_at',
  'read_at',
  'is_deleted'
]

// 写入字段白名单（不含 id / created_at / is_deleted）
const WRITE_FIELDS = [
  'sender_id',
  'receiver_id',
  'msg_type',
  'title',
  'content',
  'status',
  'ref_type',
  'ref_id',
  'chat_message_id',
  'read_at'
]

function cols(columns) {
  return columns.map((c) => `\`${c}\``).join(', ')
}

// 从输入对象中提取白名单内的可写字段：undefined 跳过
function pickWrite(data) {
  const out = {}
  for (const k of WRITE_FIELDS) {
    const v = data ? data[k] : undefined
    if (v === undefined) continue
    out[k] = v
  }
  return out
}

class MessageRepository extends BaseRepository {
  constructor() {
    super('message')
  }

  /**
   * 列出接收人的消息，按 created_at DESC，可按 status / msg_type 过滤
   * @param {{ receiverId: number, status?: string, msgType?: string }} filters
   * @returns {Object[]}
   */
  async listMine({ receiverId, status, msgType } = {}) {
    const conditions = [
      { field: 'receiver_id', op: '=', value: receiverId },
      { field: 'is_deleted', op: '=', value: 0 }
    ]
    if (status) {
      conditions.push({ field: 'status', op: '=', value: status })
    }
    if (msgType) {
      conditions.push({ field: 'msg_type', op: '=', value: msgType })
    }
    const { clause, values } = buildWhereClause(conditions)
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`message\` ${clause} ORDER BY created_at DESC`
    const [rows] = await this._execute(sql, values, 'listMine')
    return rows
  }

  /**
   * 接收人未读消息数
   * @param {number} receiverId
   * @returns {number}
   */
  async countUnread(receiverId) {
    const sql = `SELECT COUNT(*) AS total FROM \`message\` WHERE receiver_id = ? AND status = 'unread' AND is_deleted = 0`
    const [rows] = await this._execute(sql, [receiverId], 'countUnread')
    return rows[0].total
  }

  /**
   * 标记单条已读（仅当该消息属于当前接收人且仍为未读时生效）
   * @param {number} id
   * @param {number} receiverId
   * @returns {number} 受影响行数
   */
  async markRead(id, receiverId) {
    const sql = `UPDATE \`message\` SET status = 'read', read_at = NOW() WHERE id = ? AND receiver_id = ? AND status = 'unread' AND is_deleted = 0`
    const [result] = await this._execute(sql, [id, receiverId], 'markRead')
    return result.affectedRows
  }

  /**
   * 一键标记当前接收人全部未读消息为已读（单条批量 UPDATE）
   * @param {number} receiverId
   * @returns {number} 受影响行数
   */
  async markAllRead(receiverId) {
    const sql = `UPDATE \`message\` SET status = 'read', read_at = NOW() WHERE receiver_id = ? AND status = 'unread' AND is_deleted = 0`
    const [result] = await this._execute(sql, [receiverId], 'markAllRead')
    return result.affectedRows
  }

  /**
   * 按引用（公告）批量标记当前接收人的未读消息为已读（公告已读联动用）
   * @param {number} receiverId
   * @param {string} refType
   * @param {number} refId
   * @returns {number} 受影响行数
   */
  async markReadByRef(receiverId, refType, refId) {
    const sql = `UPDATE \`message\` SET status = 'read', read_at = NOW()
      WHERE receiver_id = ? AND ref_type = ? AND ref_id = ? AND status = 'unread' AND is_deleted = 0`
    const [result] = await this._execute(sql, [receiverId, refType, refId], 'markReadByRef')
    return result.affectedRows
  }

  /**
   * 取接收人未读的公告类消息引用 id 集合（「全部已读」联动公告用）
   * @param {number} receiverId
   * @returns {number[]}
   */
  async listUnreadNoticeRefs(receiverId) {
    const sql = `SELECT DISTINCT ref_id FROM \`message\`
      WHERE receiver_id = ? AND ref_type = 'notice' AND ref_id > 0 AND status = 'unread' AND is_deleted = 0`
    const [rows] = await this._execute(sql, [receiverId], 'listUnreadNoticeRefs')
    return rows.map((r) => r.ref_id)
  }

  /**
   * 按聊天消息 id 标记接收人的该条铃铛消息已读（聊天页单条已读 → 铃铛同步）
   * @param {number} receiverId
   * @param {number} chatMessageId
   * @returns {number} 受影响行数
   */
  async markReadByChatMessage(receiverId, chatMessageId) {
    const sql = `UPDATE \`message\` SET status = 'read', read_at = NOW()
      WHERE receiver_id = ? AND msg_type = 'chat' AND chat_message_id = ? AND status = 'unread' AND is_deleted = 0`
    const [result] = await this._execute(sql, [receiverId, chatMessageId], 'markReadByChatMessage')
    return result.affectedRows
  }

  /**
   * 按聊天会话标记接收人的该会话全部铃铛消息已读（聊天页进入会话 → 铃铛同步）
   * @param {number} receiverId
   * @param {number} conversationId
   * @returns {number} 受影响行数
   */
  async markReadByChatConversation(receiverId, conversationId) {
    const sql = `UPDATE \`message\` SET status = 'read', read_at = NOW()
      WHERE receiver_id = ? AND msg_type = 'chat' AND ref_type = 'chat' AND ref_id = ? AND status = 'unread' AND is_deleted = 0`
    const [result] = await this._execute(sql, [receiverId, conversationId], 'markReadByChatConversation')
    return result.affectedRows
  }

  /**
   * 按聊天消息 id 更新铃铛消息内容（聊天撤回 → 铃铛同步为「消息已撤回」）
   * @param {number} chatMessageId
   * @param {string} content
   * @returns {number} 受影响行数
   */
  async updateContentByChatMessage(chatMessageId, content) {
    const sql = `UPDATE \`message\` SET content = ?
      WHERE msg_type = 'chat' AND chat_message_id = ? AND is_deleted = 0`
    const [result] = await this._execute(sql, [content, chatMessageId], 'updateContentByChatMessage')
    return result.affectedRows
  }
}

module.exports = new MessageRepository()
