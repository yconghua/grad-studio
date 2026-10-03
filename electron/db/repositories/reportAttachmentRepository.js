/**
 * 周报附件仓库（Repository Layer）—— 对应 `report_attachment` 表
 *
 * 大字段隔离约定：列表/元数据查询一律不 SELECT file_data（LONGBLOB），
 * 只有下载时才 getWithData 单独取二进制，避免拖垮列表与连接池。
 * 删除=物理删除（释放配额与空间，与周报无软删决策一致）。
 */
const BaseRepository = require('./BaseRepository')

// 元数据列（不含 file_data）
const META_COLUMNS = ['id', 'report_id', 'user_id', 'file_name', 'file_size', 'mime_type', 'file_ext', 'created_at']

function cols(columns) {
  return columns.map((c) => `\`${c}\``).join(', ')
}

class ReportAttachmentRepository extends BaseRepository {
  constructor() {
    super('report_attachment')
  }

  // 某周报的附件元数据列表（按上传时间倒序）
  async listMetaByReport(reportId) {
    const sql = `SELECT ${cols(META_COLUMNS)} FROM \`report_attachment\` WHERE report_id = ? ORDER BY id DESC`
    const [rows] = await this._execute(sql, [Number(reportId)], 'listMetaByReport')
    return rows
  }

  // 附件元数据（不含 data）
  async getById(id) {
    const sql = `SELECT ${cols(META_COLUMNS)} FROM \`report_attachment\` WHERE id = ?`
    const [rows] = await this._execute(sql, [Number(id)], 'getById')
    return rows[0] || null
  }

  // 附件完整行（含 file_data，仅下载用）
  async getWithData(id) {
    const sql = 'SELECT * FROM `report_attachment` WHERE id = ?'
    const [rows] = await this._execute(sql, [Number(id)], 'getWithData')
    return rows[0] || null
  }

  // 插入附件（二进制直接入库）
  async create({ reportId, userId, fileName, fileSize, mimeType, fileExt, data }) {
    const sql =
      'INSERT INTO `report_attachment` (`report_id`, `user_id`, `file_name`, `file_size`, `mime_type`, `file_ext`, `file_data`) VALUES (?, ?, ?, ?, ?, ?, ?)'
    const [result] = await this._execute(
      sql,
      [Number(reportId), Number(userId), fileName, Number(fileSize), mimeType, fileExt, data],
      'create'
    )
    return result.insertId
  }

  // 物理删除附件
  async deleteById(id) {
    const sql = 'DELETE FROM `report_attachment` WHERE id = ?'
    const [result] = await this._execute(sql, [Number(id)], 'deleteById')
    return result.affectedRows
  }

  // 删除某周报全部附件（超管强制删除周报时级联清理）
  async deleteByReportId(reportId) {
    const sql = 'DELETE FROM `report_attachment` WHERE report_id = ?'
    const [result] = await this._execute(sql, [Number(reportId)], 'deleteByReportId')
    return result.affectedRows
  }

  // 学生累计附件字节数（1GB 配额校验）
  async sumSizeByUser(userId) {
    const sql = 'SELECT COALESCE(SUM(file_size), 0) AS total FROM `report_attachment` WHERE user_id = ?'
    const [rows] = await this._execute(sql, [Number(userId)], 'sumSizeByUser')
    return Number(rows[0] && rows[0].total) || 0
  }

  // 某周报附件总数与总大小（组管统计展示用）
  async statsByReport(reportId) {
    const sql =
      'SELECT COUNT(*) AS count, COALESCE(SUM(file_size), 0) AS total FROM `report_attachment` WHERE report_id = ?'
    const [rows] = await this._execute(sql, [Number(reportId)], 'statsByReport')
    const r = rows[0] || {}
    return { count: Number(r.count) || 0, total: Number(r.total) || 0 }
  }
}

module.exports = new ReportAttachmentRepository()
