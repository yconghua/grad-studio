/**
 * 知识库文件仓库（Repository Layer）—— 对应 `knowledge_file` 表
 *
 * 继承 BaseRepository 获得通用 CRUD；按节点列文件、批量软删除在裸 SQL 中表达。
 * 写入字段统一走 WRITE_FIELDS 白名单。
 * 导出单例：全局共用同一个仓库实例。
 */
const BaseRepository = require('./BaseRepository')

// 安全返回列
const SAFE_COLUMNS = [
  'id',
  'knowledge_id',
  'group_id',
  'title',
  'file_path',
  'file_size',
  'file_type',
  'uploaded_by',
  'download_count',
  'status',
  'created_at',
  'updated_at'
]

// 写入字段白名单（不含 id / created_at / updated_at / is_deleted）
const WRITE_FIELDS = [
  'knowledge_id',
  'group_id',
  'title',
  'file_path',
  'file_size',
  'file_type',
  'uploaded_by',
  'status'
]

function cols(columns) {
  return columns.map((c) => `\`${c}\``).join(', ')
}

// 从输入对象中提取白名单内的可写字段：undefined 与空字符串跳过
function pickWrite(data) {
  const out = {}
  for (const k of WRITE_FIELDS) {
    const v = data ? data[k] : undefined
    if (v === undefined) continue
    if (typeof v === 'string' && v.trim() === '') continue
    out[k] = v
  }
  return out
}

class KnowledgeFileRepository extends BaseRepository {
  constructor() {
    super('knowledge_file')
  }

  /**
   * 按知识库节点列出文件（新上传的在前）
   * @param {number} knowledgeId
   * @returns {Object[]}
   */
  async listByKnowledgeId(knowledgeId) {
    const sql = `SELECT ${cols(SAFE_COLUMNS)} FROM \`knowledge_file\` WHERE knowledge_id = ? AND is_deleted = 0 ORDER BY id DESC`
    const [rows] = await this._execute(sql, [knowledgeId], 'listByKnowledgeId')
    return rows
  }

  /**
   * 新增文件记录（白名单过滤后写入）
   * @param {Object} data
   * @returns {number} 新记录 id
   */
  async createFile(data) {
    return this.create(pickWrite(data))
  }

  /**
   * 软删除某知识库节点下的全部文件记录（删除节点时联动调用）
   * @param {number} knowledgeId
   * @returns {number} 受影响行数
   */
  async softDeleteByKnowledgeId(knowledgeId) {
    const sql = `UPDATE \`knowledge_file\` SET is_deleted = 1 WHERE knowledge_id = ? AND is_deleted = 0`
    const [result] = await this._execute(sql, [knowledgeId], 'softDeleteByKnowledgeId')
    return result.affectedRows
  }
}

module.exports = new KnowledgeFileRepository()
