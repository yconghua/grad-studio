/**
 * 科研成果附件仓库（Repository Layer）—— 对应 `achievement_attachment` 表
 *
 * 与周报附件同模式：大字段隔离（列表/元数据不 SELECT file_data），
 * 仅下载时 getWithData 取二进制；删除 = 物理删除（释放空间）。
 * 级联按成果归属（achievement_id）定位——导师/超管代填上传的附件
 * 上传者不是学生本人，删学生/删成果时必须按所属成果清附件。
 */
const BaseRepository = require('./BaseRepository')

// 元数据列（不含 file_data）
const META_COLUMNS = ['id', 'achievement_id', 'user_id', 'file_name', 'file_size', 'mime_type', 'file_ext', 'created_at']

function cols(columns) {
  return columns.map((c) => `\`${c}\``).join(', ')
}

class AchievementAttachmentRepository extends BaseRepository {
  constructor() {
    super('achievement_attachment')
  }

  // 某成果的附件元数据列表（按上传时间倒序）
  async listMetaByAchievement(achievementId) {
    const sql = `SELECT ${cols(META_COLUMNS)} FROM \`achievement_attachment\` WHERE achievement_id = ? ORDER BY id DESC`
    const [rows] = await this._execute(sql, [Number(achievementId)], 'listMetaByAchievement')
    return rows
  }

  // 附件元数据（不含 data）
  async getById(id) {
    const sql = `SELECT ${cols(META_COLUMNS)} FROM \`achievement_attachment\` WHERE id = ?`
    const [rows] = await this._execute(sql, [Number(id)], 'getById')
    return rows[0] || null
  }

  // 附件完整行（含 file_data，仅下载用）
  async getWithData(id) {
    const sql = 'SELECT * FROM `achievement_attachment` WHERE id = ?'
    const [rows] = await this._execute(sql, [Number(id)], 'getWithData')
    return rows[0] || null
  }

  // 插入附件（二进制直接入库）
  async create({ achievementId, userId, fileName, fileSize, mimeType, fileExt, data }) {
    const sql =
      'INSERT INTO `achievement_attachment` (`achievement_id`, `user_id`, `file_name`, `file_size`, `mime_type`, `file_ext`, `file_data`) VALUES (?, ?, ?, ?, ?, ?, ?)'
    const [result] = await this._execute(
      sql,
      [Number(achievementId), Number(userId), fileName, Number(fileSize), mimeType, fileExt, data],
      'create'
    )
    return result.insertId
  }

  // 物理删除附件
  async deleteById(id) {
    const sql = 'DELETE FROM `achievement_attachment` WHERE id = ?'
    const [result] = await this._execute(sql, [Number(id)], 'deleteById')
    return result.affectedRows
  }

  // 删除某成果全部附件（删除成果事务内级联清理）
  async deleteByAchievementId(achievementId) {
    const sql = 'DELETE FROM `achievement_attachment` WHERE achievement_id = ?'
    const [result] = await this._execute(sql, [Number(achievementId)], 'deleteByAchievementId')
    return result.affectedRows
  }

  // 删除某学生全部成果的附件（删除用户事务内级联清理，按成果归属定位）
  async deleteByUser(userId) {
    const sql =
      'DELETE FROM `achievement_attachment` WHERE achievement_id IN (SELECT id FROM `achievements` WHERE user_id = ?)'
    const [result] = await this._execute(sql, [Number(userId)], 'deleteByUser')
    return result.affectedRows
  }

  // 学生累计附件字节数（1GB 配额校验；与周报附件各自独立统计）
  async sumSizeByUser(userId) {
    const sql = 'SELECT COALESCE(SUM(file_size), 0) AS total FROM `achievement_attachment` WHERE user_id = ?'
    const [rows] = await this._execute(sql, [Number(userId)], 'sumSizeByUser')
    return Number(rows[0] && rows[0].total) || 0
  }
}

module.exports = new AchievementAttachmentRepository()
