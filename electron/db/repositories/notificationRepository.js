/**
 * 通知中心仓库（Repository Layer）—— 对应 `notification` / `notification_type` 两张表
 *
 * 说明：
 *   - 通知按用户维度存储，is_deleted 为软删标记；本表不参与 BaseRepository 的
 *     is_deleted 兜底约定，SQL 均自实现（软删/硬删语义由本层显式控制）。
 *   - 级联硬删（删用户 / 删课题组）由 service 在事务内调用本层方法。
 *   - 聊天消息不进入本表（见 schemas/11_notification.sql 文件头注释）。
 */
const BaseRepository = require('./BaseRepository')

class NotificationRepository extends BaseRepository {
  constructor() {
    super('notification')
  }

  /**
   * 批量写入通知（业务模块内部调用）
   * 说明：与 groupMeetingParticipantRepository.createMany 同款写法——
   * 本库 _execute 走 mysql2 预处理，不支持 `VALUES ?` 批量扩展语法，
   * 需手拼占位符并把参数展平传入。
   * @param {Array<{recipientId:number,typeKey:string,title:string,summary:string,bizType:string,bizId:number,groupId:number|null}>} rows
   */
  async createMany(rows) {
    if (!rows || rows.length === 0) return 0
    const marks = rows.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ')
    const values = []
    for (const r of rows) {
      values.push(
        Number(r.recipientId),
        r.typeKey,
        r.title,
        r.summary || '',
        r.bizType,
        Number(r.bizId),
        r.groupId == null ? null : Number(r.groupId)
      )
    }
    const sql =
      'INSERT INTO `notification` (recipient_id, type_key, title, summary, biz_type, biz_id, group_id) ' +
      `VALUES ${marks}`
    const [result] = await this._execute(sql, values, 'createMany')
    return result.affectedRows
  }

  /**
   * 分页列表（按 id 倒序，join 类型表取展示信息）
   * @param {{ userId:number, typeKey?:string, isRead?:number, page?:number, pageSize?:number }} param
   */
  async pagedList({ userId, typeKey, isRead, page = 1, pageSize = 20 } = {}) {
    const where = ['n.recipient_id = ?', 'n.is_deleted = 0']
    const params = [Number(userId)]
    if (typeKey) {
      where.push('n.type_key = ?')
      params.push(typeKey)
    }
    if (isRead === 0 || isRead === 1) {
      where.push('n.is_read = ?')
      params.push(Number(isRead))
    }
    const whereSql = where.join(' AND ')

    const countSql = `SELECT COUNT(*) AS total FROM \`notification\` n WHERE ${whereSql}`
    const [countRows] = await this._execute(countSql, params, 'pagedList.count')
    const total = Number(countRows[0] && countRows[0].total) || 0

    const offset = (Number(page) - 1) * Number(pageSize)
    const listSql =
      'SELECT n.*, t.display_name, t.icon_key FROM `notification` n ' +
      'LEFT JOIN `notification_type` t ON t.type_key = n.type_key ' +
      `WHERE ${whereSql} ORDER BY n.id DESC LIMIT ${Number(pageSize)} OFFSET ${offset}`
    const [rows] = await this._execute(listSql, params, 'pagedList.list')

    return {
      list: rows,
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / Number(pageSize))
    }
  }

  /**
   * 当前用户未读通知数（角标 / 轮询锚点）
   * @param {number} userId
   */
  async countUnread(userId) {
    const sql =
      'SELECT COUNT(*) AS total FROM `notification` WHERE recipient_id = ? AND is_deleted = 0 AND is_read = 0'
    const [rows] = await this._execute(sql, [Number(userId)], 'countUnread')
    return Number(rows[0] && rows[0].total) || 0
  }

  /**
   * 当前用户全部未软删通知的最大 id（轮询新通知锚点）
   * @param {number} userId
   */
  async maxIdOfUser(userId) {
    const sql =
      'SELECT MAX(id) AS max_id FROM `notification` WHERE recipient_id = ? AND is_deleted = 0'
    const [rows] = await this._execute(sql, [Number(userId)], 'maxIdOfUser')
    return Number(rows[0] && rows[0].max_id) || 0
  }

  /**
   * 轮询新通知中最新的 1 条（供系统通知最小版与渲染层跳转）
   * @param {number} userId
   * @param {number} afterId 锚点：只取 id > afterId 的记录
   */
  async latestNewOfUser(userId, afterId) {
    const sql =
      'SELECT n.*, t.allow_system_notify FROM `notification` n ' +
      'LEFT JOIN `notification_type` t ON t.type_key = n.type_key ' +
      'WHERE n.recipient_id = ? AND n.id > ? AND n.is_deleted = 0 ' +
      'ORDER BY n.id DESC LIMIT 1'
    const [rows] = await this._execute(sql, [Number(userId), Number(afterId)], 'latestNewOfUser')
    return rows[0] || null
  }

  /**
   * 标记单条已读（幂等：仅未读→已读；只能标记自己的）
   * @param {number} id
   * @param {number} userId
   */
  async markRead(id, userId) {
    const sql =
      'UPDATE `notification` SET is_read = 1, read_at = NOW() ' +
      'WHERE id = ? AND recipient_id = ? AND is_read = 0'
    const [result] = await this._execute(sql, [Number(id), Number(userId)], 'markRead')
    return result.affectedRows
  }

  /**
   * 全部标记已读（只影响当前用户未软删的未读通知）
   * @param {number} userId
   */
  async markAllRead(userId) {
    const sql =
      'UPDATE `notification` SET is_read = 1, read_at = NOW() ' +
      'WHERE recipient_id = ? AND is_deleted = 0 AND is_read = 0'
    const [result] = await this._execute(sql, [Number(userId)], 'markAllRead')
    return result.affectedRows
  }

  /**
   * 删除单条（软删；只能删自己的）
   * @param {number} id
   * @param {number} userId
   */
  async softDelete(id, userId) {
    const sql =
      'UPDATE `notification` SET is_deleted = 1 WHERE id = ? AND recipient_id = ? AND is_deleted = 0'
    const [result] = await this._execute(sql, [Number(id), Number(userId)], 'softDelete')
    return result.affectedRows
  }

  /**
   * 清空已读：当前用户全部已读通知一次性软删
   * @param {number} userId
   */
  async clearRead(userId) {
    const sql =
      'UPDATE `notification` SET is_deleted = 1 ' +
      'WHERE recipient_id = ? AND is_deleted = 0 AND is_read = 1'
    const [result] = await this._execute(sql, [Number(userId)], 'clearRead')
    return result.affectedRows
  }

  /**
   * 按业务软删关联通知（删除公告/组会时调用，保留历史语义：不硬删）
   * @param {string} bizType
   * @param {number} bizId
   */
  async softDeleteByBiz(bizType, bizId) {
    const sql =
      'UPDATE `notification` SET is_deleted = 1 WHERE biz_type = ? AND biz_id = ? AND is_deleted = 0'
    const [result] = await this._execute(sql, [bizType, Number(bizId)], 'softDeleteByBiz')
    return result.affectedRows
  }

  /**
   * 硬删某用户的全部通知（删除用户事务内调用）
   * @param {number} userId
   */
  async purgeByUserDelete(userId) {
    const sql = 'DELETE FROM `notification` WHERE recipient_id = ?'
    const [result] = await this._execute(sql, [Number(userId)], 'purgeByUserDelete')
    return result.affectedRows
  }

  /**
   * 硬删某课题组的公告/组会通知（删除课题组事务内调用；聊天通知不存在，不涉及）
   * @param {number} groupId
   */
  async hardDeleteByGroup(groupId) {
    const sql =
      'DELETE FROM `notification` WHERE group_id = ? AND biz_type IN (?, ?)'
    const [result] = await this._execute(sql, [Number(groupId), 'notice', 'meeting'], 'hardDeleteByGroup')
    return result.affectedRows
  }

  /**
   * 已启用通知类型列表（列表筛选 / 项展示；按 sort_order 排序）
   */
  async listTypes() {
    const sql =
      'SELECT type_key, display_name, icon_key, allow_system_notify, sort_order ' +
      'FROM `notification_type` WHERE enabled = 1 ORDER BY sort_order ASC, id ASC'
    const [rows] = await this._execute(sql, [], 'listTypes')
    return rows
  }

  /**
   * 类型是否存在且启用（业务模块写入通知前校验；禁用类型不产生新通知）
   * @param {string} typeKey
   */
  async typeEnabled(typeKey) {
    const sql =
      'SELECT COUNT(*) AS total FROM `notification_type` WHERE type_key = ? AND enabled = 1'
    const [rows] = await this._execute(sql, [typeKey], 'typeEnabled')
    return Number(rows[0] && rows[0].total) > 0
  }
}

// 导出单例
module.exports = new NotificationRepository()
