/**
 * 聊天仓库（Repository Layer）—— 对应 chat_conversation / chat_conversation_member / chat_message 三表
 *
 * 聊天模块数据访问统一收敛于此：会话 get-or-create、成员已读位、消息分页、
 * 未读统计、搜索与推送增量查询。业务校验（同组、身份、归属）在 chatService，
 * 本层只负责 SQL 表达与参数化绑定。
 * 导出单例：全局共用同一个仓库实例。
 */
const BaseRepository = require('./BaseRepository')

// 消息表独立仓库实例：ChatRepository 主表是 chat_conversation（会话表），
// createMessage 必须插入 chat_message 表，不能走 this.create()（否则 SQL 会把
// conversation_id 等列插到 chat_conversation 上，报 Unknown column 错误）。
const ChatMessageRepo = new BaseRepository('chat_message')

// 会话表安全列
const CONV_SAFE_COLUMNS = ['id', 'user_a', 'user_b', 'type', 'created_at', 'updated_at']

// 成员表安全列
const MEMBER_SAFE_COLUMNS = ['id', 'conversation_id', 'user_id', 'last_read_at', 'is_hidden', 'created_at', 'updated_at']

// 消息表安全列（file_path 仅限会话成员场景返回，联系人/搜索场景不暴露）
const MSG_SAFE_COLUMNS = [
  'id', 'conversation_id', 'sender_id', 'content_type', 'content',
  'file_name', 'file_path', 'file_size', 'file_mime',
  'is_recalled', 'recalled_at', 'created_at'
]

function cols(columns) {
  return columns.map((c) => `\`${c}\``).join(', ')
}

class ChatRepository extends BaseRepository {
  constructor() {
    super('chat_conversation')
  }

  /**
   * 插入一条聊天消息（事务内调用）
   * @param {Object} data 字段白名单见 WRITE 侧
   * @returns {number} 新消息 id
   */
  async createMessage(data) {
    return ChatMessageRepo.create(data)
  }

  /**
   * 按有序用户对查 1 对 1 会话（user_a 为小 id，user_b 为大 id）
   * @param {number} userA
   * @param {number} userB
   * @returns {Object|null}
   */
  async findConversationByPair(userA, userB) {
    const sql = `SELECT ${cols(CONV_SAFE_COLUMNS)} FROM \`chat_conversation\`
      WHERE \`user_a\` = ? AND \`user_b\` = ? AND \`is_deleted\` = 0`
    const [rows] = await this._execute(sql, [userA, userB], 'findConversationByPair')
    return rows[0] || null
  }

  /**
   * 创建 1 对 1 会话（调用方保证 userA < userB）
   * @param {number} userA
   * @param {number} userB
   * @returns {number} 新会话 id（唯一键冲突时由调用方捕获处理）
   */
  async createConversation(userA, userB) {
    const sql = `INSERT INTO \`chat_conversation\` (\`user_a\`, \`user_b\`) VALUES (?, ?)`
    const [result] = await this._execute(sql, [userA, userB], 'createConversation')
    return result.insertId
  }

  /**
   * 查会话成员行
   * @param {number} conversationId
   * @param {number} userId
   * @returns {Object|null}
   */
  async findMember(conversationId, userId) {
    const sql = `SELECT ${cols(MEMBER_SAFE_COLUMNS)} FROM \`chat_conversation_member\`
      WHERE \`conversation_id\` = ? AND \`user_id\` = ? AND \`is_deleted\` = 0`
    const [rows] = await this._execute(sql, [conversationId, userId], 'findMember')
    return rows[0] || null
  }

  /**
   * 插入成员行（建会话时双方各一行；已存在时静默忽略，保留原行）
   * @param {number} conversationId
   * @param {number} userId
   */
  async createMember(conversationId, userId) {
    const sql = `INSERT IGNORE INTO \`chat_conversation_member\`
      (\`conversation_id\`, \`user_id\`, \`last_read_at\`) VALUES (?, ?, NOW())`
    await this._execute(sql, [conversationId, userId], 'createMember')
  }

  /**
   * 恢复本侧被隐藏的会话（再次打开时取消删除）
   * @param {number} conversationId
   * @param {number} userId
   * @returns {number} 受影响行数
   */
  async revealMember(conversationId, userId) {
    const sql = `UPDATE \`chat_conversation_member\`
      SET \`is_hidden\` = 0, \`hidden_at\` = NULL
      WHERE \`conversation_id\` = ? AND \`user_id\` = ? AND \`is_deleted\` = 0`
    const [result] = await this._execute(sql, [conversationId, userId], 'revealMember')
    return result.affectedRows
  }

  /**
   * 本侧删除会话（隐藏，对方不受影响）
   * @param {number} conversationId
   * @param {number} userId
   * @returns {number} 受影响行数
   */
  async hideConversation(conversationId, userId) {
    const sql = `UPDATE \`chat_conversation_member\`
      SET \`is_hidden\` = 1, \`hidden_at\` = NOW()
      WHERE \`conversation_id\` = ? AND \`user_id\` = ? AND \`is_hidden\` = 0 AND \`is_deleted\` = 0`
    const [result] = await this._execute(sql, [conversationId, userId], 'hideConversation')
    return result.affectedRows
  }

  /**
   * 当前用户是否某会话成员（未软删）
   * @param {number} conversationId
   * @param {number} userId
   * @returns {boolean}
   */
  async isMember(conversationId, userId) {
    const sql = `SELECT id FROM \`chat_conversation_member\`
      WHERE \`conversation_id\` = ? AND \`user_id\` = ? AND \`is_deleted\` = 0 LIMIT 1`
    const [rows] = await this._execute(sql, [conversationId, userId], 'isMember')
    return rows.length > 0
  }

  /**
   * 取会话中某成员对面的对方信息（会话详情 / 发送前取接收者）
   * @param {number} conversationId
   * @param {number} userId
   * @returns {Object|null}
   */
  async getPeer(conversationId, userId) {
    const sql = `SELECT \`u\`.\`id\`, \`u\`.\`username\`, \`u\`.\`role\`,
        \`up\`.\`real_name\`, \`ug\`.\`role_in_group\`
      FROM \`chat_conversation_member\` AS \`om\`
      JOIN \`user\` AS \`u\` ON \`u\`.\`id\` = \`om\`.\`user_id\` AND \`u\`.\`is_deleted\` = 0
      LEFT JOIN \`user_profile\` AS \`up\` ON \`up\`.\`user_id\` = \`om\`.\`user_id\` AND \`up\`.\`is_deleted\` = 0
      LEFT JOIN \`user_group\` AS \`ug\` ON \`ug\`.\`user_id\` = \`om\`.\`user_id\` AND \`ug\`.\`status\` = 'active' AND \`ug\`.\`is_deleted\` = 0
      WHERE \`om\`.\`conversation_id\` = ? AND \`om\`.\`user_id\` <> ? AND \`om\`.\`is_deleted\` = 0
      LIMIT 1`
    const [rows] = await this._execute(sql, [conversationId, userId], 'getPeer')
    return rows[0] || null
  }

  /**
   * 取用户显示名（聊天双写铃铛 title 用：优先真实姓名，缺省回退登录账号）
   * @param {number} userId
   * @returns {Object|null}
   */
  async getDisplayName(userId) {
    const sql = `SELECT \`u\`.\`id\`, \`u\`.\`username\`, \`up\`.\`real_name\`
      FROM \`user\` AS \`u\`
      LEFT JOIN \`user_profile\` AS \`up\` ON \`up\`.\`user_id\` = \`u\`.\`id\` AND \`up\`.\`is_deleted\` = 0
      WHERE \`u\`.\`id\` = ? AND \`u\`.\`is_deleted\` = 0`
    const [rows] = await this._execute(sql, [userId], 'getDisplayName')
    return rows[0] || null
  }

  /**
   * 可聊对象：与当前用户同组、组内身份为导师/学生、在组且账号正常的成员（不含本人）
   * @param {number} userId
   * @returns {Object[]}
   */
  async listContacts(userId) {
    const sql = `SELECT DISTINCT \`u\`.\`id\`, \`u\`.\`username\`, \`u\`.\`role\`,
        \`up\`.\`real_name\`, \`ug\`.\`role_in_group\`, \`g\`.\`id\` AS \`group_id\`, \`g\`.\`name\` AS \`group_name\`
      FROM \`user_group\` AS \`ug\`
      JOIN \`user_group\` AS \`mg\` ON \`mg\`.\`group_id\` = \`ug\`.\`group_id\`
        AND \`mg\`.\`user_id\` = ? AND \`mg\`.\`status\` = 'active' AND \`mg\`.\`is_deleted\` = 0
      JOIN \`group\` AS \`g\` ON \`g\`.\`id\` = \`ug\`.\`group_id\` AND \`g\`.\`is_deleted\` = 0 AND \`g\`.\`status\` = 'active'
      JOIN \`user\` AS \`u\` ON \`u\`.\`id\` = \`ug\`.\`user_id\` AND \`u\`.\`is_deleted\` = 0 AND \`u\`.\`status\` = 'active'
      LEFT JOIN \`user_profile\` AS \`up\` ON \`up\`.\`user_id\` = \`ug\`.\`user_id\` AND \`up\`.\`is_deleted\` = 0
      WHERE \`ug\`.\`status\` = 'active' AND \`ug\`.\`is_deleted\` = 0
        AND \`ug\`.\`role_in_group\` IN ('mentor', 'student')
        AND \`u\`.\`id\` <> ?
      ORDER BY \`u\`.\`id\` ASC`
    const [rows] = await this._execute(sql, [userId, userId], 'listContacts')
    return rows
  }

  /**
   * 校验两个用户是否同组且对方为可聊身份（导师/学生）——发送 / open 前置校验
   * @param {number} userId
   * @param {number} peerId
   * @returns {Object|null} 命中则返回共同组信息，否则 null
   */
  async findSharedGroup(userId, peerId) {
    const sql = `SELECT \`g\`.\`id\`, \`g\`.\`name\`
      FROM \`user_group\` AS \`ug\`
      JOIN \`user_group\` AS \`mg\` ON \`mg\`.\`group_id\` = \`ug\`.\`group_id\`
        AND \`mg\`.\`user_id\` = ? AND \`mg\`.\`status\` = 'active' AND \`mg\`.\`is_deleted\` = 0
      JOIN \`group\` AS \`g\` ON \`g\`.\`id\` = \`ug\`.\`group_id\` AND \`g\`.\`is_deleted\` = 0 AND \`g\`.\`status\` = 'active'
      JOIN \`user\` AS \`u\` ON \`u\`.\`id\` = \`ug\`.\`user_id\` AND \`u\`.\`is_deleted\` = 0 AND \`u\`.\`status\` = 'active'
      WHERE \`ug\`.\`user_id\` = ? AND \`ug\`.\`status\` = 'active' AND \`ug\`.\`is_deleted\` = 0
        AND \`ug\`.\`role_in_group\` IN ('mentor', 'student')
      LIMIT 1`
    // 注意：SQL 只有 2 个占位符，只能传 2 个参数。
    // mysql2 的 execute()（服务端预编译）对「参数多于占位符」会静默返回 0 行（文本协议 query 才忽略多余参数），
    // 之前误传 3 个参数导致同组校验永远失败。
    const [rows] = await this._execute(sql, [userId, peerId], 'findSharedGroup')
    return rows[0] || null
  }

  /**
   * 我的会话列表：含对方信息、最后一条消息、未读数，按最后活动时间倒序
   * @param {number} userId
   * @returns {Object[]}
   */
  async listConversations(userId) {
    const sql = `SELECT \`c\`.\`id\`, \`c\`.\`updated_at\`,
        \`om\`.\`user_id\` AS \`peer_id\`,
        \`u\`.\`username\` AS \`peer_username\`, \`u\`.\`role\` AS \`peer_role\`,
        \`up\`.\`real_name\` AS \`peer_real_name\`,
        \`m\`.\`last_read_at\`,
        \`lm\`.\`id\` AS \`last_msg_id\`, \`lm\`.\`sender_id\` AS \`last_sender_id\`,
        \`lm\`.\`content_type\` AS \`last_content_type\`, \`lm\`.\`content\` AS \`last_content\`,
        \`lm\`.\`file_name\` AS \`last_file_name\`, \`lm\`.\`is_recalled\` AS \`last_is_recalled\`,
        \`lm\`.\`created_at\` AS \`last_msg_at\`,
        (SELECT COUNT(*) FROM \`chat_message\` AS \`cm\`
           WHERE \`cm\`.\`conversation_id\` = \`c\`.\`id\` AND \`cm\`.\`sender_id\` <> ?
             AND \`cm\`.\`is_recalled\` = 0 AND \`cm\`.\`is_deleted\` = 0
             AND \`cm\`.\`created_at\` > COALESCE(\`m\`.\`last_read_at\`, \`c\`.\`created_at\`)) AS \`unread\`
      FROM \`chat_conversation\` AS \`c\`
      JOIN \`chat_conversation_member\` AS \`m\`
        ON \`m\`.\`conversation_id\` = \`c\`.\`id\` AND \`m\`.\`user_id\` = ? AND \`m\`.\`is_hidden\` = 0 AND \`m\`.\`is_deleted\` = 0
      JOIN \`chat_conversation_member\` AS \`om\`
        ON \`om\`.\`conversation_id\` = \`c\`.\`id\` AND \`om\`.\`user_id\` <> ? AND \`om\`.\`is_deleted\` = 0
      JOIN \`user\` AS \`u\` ON \`u\`.\`id\` = \`om\`.\`user_id\` AND \`u\`.\`is_deleted\` = 0
      LEFT JOIN \`user_profile\` AS \`up\` ON \`up\`.\`user_id\` = \`om\`.\`user_id\` AND \`up\`.\`is_deleted\` = 0
      LEFT JOIN \`chat_message\` AS \`lm\` ON \`lm\`.\`id\` = (
        SELECT MAX(\`id\`) FROM \`chat_message\` WHERE \`conversation_id\` = \`c\`.\`id\` AND \`is_deleted\` = 0
      )
      WHERE \`c\`.\`is_deleted\` = 0
      ORDER BY \`c\`.\`updated_at\` DESC`
    const [rows] = await this._execute(sql, [userId, userId, userId], 'listConversations')
    return rows
  }

  /**
   * 分页拉取会话消息（倒序取 before_id 之前的一页，返回后由上层反转成升序展示）
   * @param {number} conversationId
   * @param {number} beforeId 0 表示从最新开始
   * @param {number} limit
   * @returns {Object[]}
   */
  async listMessages(conversationId, beforeId, limit) {
    // LIMIT 不能走占位符：mysql2 execute() 服务端预编译在 MySQL 5.7 对 LIMIT ? 报
    // "Incorrect arguments to mysqld_stmt_execute"，必须内联数字（已强制数值化 + 范围裁剪，无注入面）。
    const safeLimit = Math.min(Math.max(Math.floor(Number(limit)) || 30, 1), 100)
    const sql = `SELECT ${cols(MSG_SAFE_COLUMNS)} FROM \`chat_message\`
      WHERE \`conversation_id\` = ? AND \`is_deleted\` = 0
        ${beforeId > 0 ? 'AND `id` < ?' : ''}
      ORDER BY \`id\` DESC
      LIMIT ${safeLimit}`
    const params = beforeId > 0 ? [conversationId, beforeId] : [conversationId]
    const [rows] = await this._execute(sql, params, 'listMessages')
    return rows
  }

  /**
   * 按 id 查消息（发送者撤回校验 / 详情用）
   * @param {number} id
   * @returns {Object|null}
   */
  async getMessageById(id) {
    const sql = `SELECT ${cols(MSG_SAFE_COLUMNS)} FROM \`chat_message\` WHERE \`id\` = ? AND \`is_deleted\` = 0`
    const [rows] = await this._execute(sql, [id], 'getMessageById')
    return rows[0] || null
  }

  /**
   * 标记消息撤回
   * @param {number} id
   * @returns {number} 受影响行数
   */
  async recallMessage(id) {
    const sql = `UPDATE \`chat_message\` SET \`is_recalled\` = 1, \`recalled_at\` = NOW()
      WHERE \`id\` = ? AND \`is_recalled\` = 0 AND \`is_deleted\` = 0`
    const [result] = await this._execute(sql, [id], 'recallMessage')
    return result.affectedRows
  }

  /**
   * 更新会话最后活动时间（发送 / 撤回等写操作后调用，驱动会话列表排序）
   * @param {number} conversationId
   */
  async touchConversation(conversationId) {
    const sql = `UPDATE \`chat_conversation\` SET \`updated_at\` = NOW() WHERE \`id\` = ? AND \`is_deleted\` = 0`
    await this._execute(sql, [conversationId], 'touchConversation')
  }

  /**
   * 更新会话成员已读位置为「会话内最新消息时间」（避免 NOW() 早于并发插入消息的漏读窗口）
   * @param {number} conversationId
   * @param {number} userId
   * @returns {number} 受影响行数
   */
  async markRead(conversationId, userId) {
    const sql = `UPDATE \`chat_conversation_member\`
      SET \`last_read_at\` = (
        SELECT MAX(\`created_at\`) FROM \`chat_message\` WHERE \`conversation_id\` = ? AND \`is_deleted\` = 0
      )
      WHERE \`conversation_id\` = ? AND \`user_id\` = ? AND \`is_deleted\` = 0`
    const [result] = await this._execute(sql, [conversationId, conversationId, userId], 'markRead')
    return result.affectedRows
  }

  /**
   * 全部会话已读位置同步（铃铛「全部已读」联动）
   * @param {number} userId
   */
  async markAllRead(userId) {
    const sql = `UPDATE \`chat_conversation_member\` AS \`m\`
      JOIN \`chat_conversation\` AS \`c\` ON \`c\`.\`id\` = \`m\`.\`conversation_id\` AND \`c\`.\`is_deleted\` = 0
      SET \`m\`.\`last_read_at\` = COALESCE(
        (SELECT MAX(\`created_at\`) FROM \`chat_message\` WHERE \`conversation_id\` = \`m\`.\`conversation_id\` AND \`is_deleted\` = 0),
        NOW()
      )
      WHERE \`m\`.\`user_id\` = ? AND \`m\`.\`is_hidden\` = 0 AND \`m\`.\`is_deleted\` = 0`
    await this._execute(sql, [userId], 'markAllRead')
  }

  /**
   * 我的聊天未读总数（菜单角标）
   * @param {number} userId
   * @returns {number}
   */
  async countUnread(userId) {
    const sql = `SELECT COUNT(*) AS \`total\`
      FROM \`chat_message\` AS \`cm\`
      JOIN \`chat_conversation\` AS \`c\` ON \`c\`.\`id\` = \`cm\`.\`conversation_id\` AND \`c\`.\`is_deleted\` = 0
      JOIN \`chat_conversation_member\` AS \`m\`
        ON \`m\`.\`conversation_id\` = \`cm\`.\`conversation_id\` AND \`m\`.\`user_id\` = ?
        AND \`m\`.\`is_hidden\` = 0 AND \`m\`.\`is_deleted\` = 0
      WHERE \`cm\`.\`sender_id\` <> ? AND \`cm\`.\`is_recalled\` = 0 AND \`cm\`.\`is_deleted\` = 0
        AND \`cm\`.\`created_at\` > COALESCE(\`m\`.\`last_read_at\`, \`c\`.\`created_at\`)`
    const [rows] = await this._execute(sql, [userId, userId], 'countUnread')
    return rows[0].total
  }

  /**
   * 推送增量查询：发给当前用户的、id 大于游标的新消息（排除已隐藏会话）
   * @param {number} userId
   * @param {number} afterId
   * @param {number} limit
   * @returns {Object[]}
   */
  async listNewMessagesForUser(userId, afterId, limit) {
    const safeLimit = Math.min(Math.max(Math.floor(Number(limit)) || 20, 1), 100)
    const sql = `SELECT \`cm\`.\`id\`, \`cm\`.\`conversation_id\`, \`cm\`.\`sender_id\`,
        \`cm\`.\`content_type\`, \`cm\`.\`content\`, \`cm\`.\`file_name\`, \`cm\`.\`file_size\`, \`cm\`.\`file_mime\`,
        \`cm\`.\`is_recalled\`, \`cm\`.\`created_at\`,
        \`m\`.\`user_id\` AS \`receiver_id\`, \`m\`.\`last_read_at\`
      FROM \`chat_message\` AS \`cm\`
      JOIN \`chat_conversation_member\` AS \`m\`
        ON \`m\`.\`conversation_id\` = \`cm\`.\`conversation_id\` AND \`m\`.\`user_id\` = ?
        AND \`m\`.\`is_hidden\` = 0 AND \`m\`.\`is_deleted\` = 0
      WHERE \`cm\`.\`id\` > ? AND \`cm\`.\`sender_id\` <> ? AND \`cm\`.\`is_recalled\` = 0 AND \`cm\`.\`is_deleted\` = 0
      ORDER BY \`cm\`.\`id\` ASC
      LIMIT ${safeLimit}`
    const [rows] = await this._execute(sql, [userId, afterId, userId], 'listNewMessagesForUser')
    return rows
  }

  /**
   * 搜索我参与（未隐藏）会话中的消息：匹配文本内容或附件文件名，不含撤回消息
   * @param {number} userId
   * @param {string} keyword
   * @param {number} limit
   * @returns {Object[]}
   */
  async searchMessages(userId, keyword, limit) {
    const safeLimit = Math.min(Math.max(Math.floor(Number(limit)) || 50, 1), 50)
    const sql = `SELECT \`cm\`.\`id\`, \`cm\`.\`conversation_id\`, \`cm\`.\`sender_id\`,
        \`cm\`.\`content_type\`, \`cm\`.\`content\`, \`cm\`.\`file_name\`, \`cm\`.\`is_recalled\`, \`cm\`.\`created_at\`,
        \`u\`.\`username\` AS \`sender_username\`, \`up\`.\`real_name\` AS \`sender_real_name\`,
        \`c\`.\`updated_at\`
      FROM \`chat_message\` AS \`cm\`
      JOIN \`chat_conversation_member\` AS \`m\`
        ON \`m\`.\`conversation_id\` = \`cm\`.\`conversation_id\` AND \`m\`.\`user_id\` = ?
        AND \`m\`.\`is_hidden\` = 0 AND \`m\`.\`is_deleted\` = 0
      JOIN \`chat_conversation\` AS \`c\` ON \`c\`.\`id\` = \`cm\`.\`conversation_id\` AND \`c\`.\`is_deleted\` = 0
      JOIN \`user\` AS \`u\` ON \`u\`.\`id\` = \`cm\`.\`sender_id\` AND \`u\`.\`is_deleted\` = 0
      LEFT JOIN \`user_profile\` AS \`up\` ON \`up\`.\`user_id\` = \`cm\`.\`sender_id\` AND \`up\`.\`is_deleted\` = 0
      WHERE \`cm\`.\`is_deleted\` = 0 AND \`cm\`.\`is_recalled\` = 0
        AND (\`cm\`.\`content\` LIKE ? OR \`cm\`.\`file_name\` LIKE ?)
      ORDER BY \`cm\`.\`id\` DESC
      LIMIT ${safeLimit}`
    const like = `%${keyword}%`
    const [rows] = await this._execute(sql, [userId, like, like], 'searchMessages')
    return rows
  }

  /**
   * 会话内未读数（单会话，列表页进入会话后角标用）
   * @param {number} conversationId
   * @param {number} userId
   * @returns {number}
   */
  async countUnreadInConversation(conversationId, userId) {
    const sql = `SELECT COUNT(*) AS \`total\`
      FROM \`chat_message\` AS \`cm\`
      JOIN \`chat_conversation\` AS \`c\` ON \`c\`.\`id\` = \`cm\`.\`conversation_id\` AND \`c\`.\`is_deleted\` = 0
      JOIN \`chat_conversation_member\` AS \`m\`
        ON \`m\`.\`conversation_id\` = \`cm\`.\`conversation_id\` AND \`m\`.\`user_id\` = ?
        AND \`m\`.\`is_deleted\` = 0
      WHERE \`cm\`.\`conversation_id\` = ? AND \`cm\`.\`sender_id\` <> ?
        AND \`cm\`.\`is_recalled\` = 0 AND \`cm\`.\`is_deleted\` = 0
        AND \`cm\`.\`created_at\` > COALESCE(\`m\`.\`last_read_at\`, \`c\`.\`created_at\`)`
    const [rows] = await this._execute(sql, [userId, conversationId, userId], 'countUnreadInConversation')
    return rows[0].total
  }

  /**
   * 当前聊天消息最大 id（推送游标初始化用：只推启动之后的新消息）
   * @returns {number}
   */
  async maxMessageId() {
    const sql = `SELECT MAX(\`id\`) AS \`max_id\` FROM \`chat_message\` WHERE \`is_deleted\` = 0`
    const [rows] = await this._execute(sql, [], 'maxMessageId')
    return rows[0].max_id || 0
  }
}

module.exports = new ChatRepository()
