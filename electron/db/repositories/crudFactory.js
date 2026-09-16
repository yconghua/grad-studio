/**
 * 通用 CRUD 工厂（Repository Layer 复用）
 *
 * 为「结构相似、只需标准增删改查 + 字段白名单」的业务表一键生成数据访问对象，
 * 避免为每张表复制粘贴高度雷同的 CRUD 样板（本次新增 28 张业务表，逐一手写重复度极高）。
 *
 * 安全约定（与 userRepository 同款原则）：
 *   - writable 白名单：create / update 仅接受白名单内的字段，前端夹带的非法列名
 *     （如 id、created_at 或任意注入列）一律被丢弃，杜绝 SQL 注入与越权写；
 *   - 所有「值」经 ? 占位符传参；field / op / orderBy 等 SQL 片段来自模块代码（可信），
 *     绝不直接拼接前端传入的字符串；
 *   - 复杂业务（联表查询、事务等）在各自模块 Repository / Service 中补充，不在这里堆砌。
 */
const BaseRepository = require('./BaseRepository')
const { buildWhereClause } = require('./queryHelpers')

// 把 filters 对象（字段->值）转成 buildWhereClause 的 conditions：
//   - 数组值 → IN；
//   - 对象值 { op, value } → 自定义比较符（如 { op: 'LIKE', value: '%xx%' }）；
//   - 其余 → 等值比较。
// undefined / null 视为「不参与筛选」。
function toConditions(filters) {
  const conditions = []
  for (const [field, value] of Object.entries(filters || {})) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      conditions.push({ field, op: 'IN', value })
    } else if (typeof value === 'object') {
      conditions.push({ field, op: value.op || '=', value: value.value })
    } else {
      conditions.push({ field, value })
    }
  }
  return conditions
}

/**
 * @param {string} tableName 表名
 * @param {{ writable?: string[] }} opts writable：可写字段白名单（缺省表示不限制）
 */
function createCrudRepo(tableName, opts = {}) {
  const base = new BaseRepository(tableName)
  const writableSet = opts.writable && opts.writable.length ? new Set(opts.writable) : null

  // 白名单过滤：仅保留可写字段，值为 undefined 的跳过
  function pick(data) {
    const out = {}
    for (const k of Object.keys(data || {})) {
      if (data[k] === undefined) continue
      if (writableSet && !writableSet.has(k)) continue
      out[k] = data[k]
    }
    return out
  }

  return {
    tableName,

    /**
     * 列表查询（等值 / IN / 自定义 op 筛选 + 排序 + 分页）
     * @param {Object} filters 字段->值（数组=IN；对象 {op,value}=自定义比较符）
     * @param {string} orderBy 排序（模块内可信字符串），默认 'id DESC'
     * @param {number|null} limit 条数上限
     * @param {number} offset 偏移
     */
    async list(filters = {}, orderBy = 'id DESC', limit = null, offset = 0) {
      const { clause, values } = buildWhereClause(toConditions(filters))
      const { conn, release } = await base._acquire()
      try {
        let sql = `SELECT * FROM \`${tableName}\` ${clause}`
        if (orderBy) sql += ` ORDER BY ${orderBy}`
        if (limit != null) sql += ` LIMIT ${Number(limit)} OFFSET ${Number(offset)}`
        const [rows] = await conn.execute(sql, values)
        return rows
      } finally {
        release()
      }
    },

    // 按主键查询单条（无则 null）
    async get(id) {
      return base.findById(id)
    },

    // 新增（白名单过滤），返回自增主键 id
    async create(data) {
      return base.create(pick(data))
    },

    // 按主键增量更新（白名单过滤），返回受影响行数
    async update(id, data) {
      return base.update(id, pick(data))
    },

    // 按主键删除，返回受影响行数
    async remove(id) {
      return base.delete(id)
    },

    // 计数（供统计 / 校验使用）
    async count(filters = {}) {
      const { clause, values } = buildWhereClause(toConditions(filters))
      const { conn, release } = await base._acquire()
      try {
        const [rows] = await conn.execute(`SELECT COUNT(*) AS cnt FROM \`${tableName}\` ${clause}`, values)
        return Number(rows[0].cnt)
      } finally {
        release()
      }
    },

    // 原子自增某数值字段（如浏览量 / 下载量），field 由模块代码传入（可信）
    async increment(id, field, delta = 1) {
      const { conn, release } = await base._acquire()
      try {
        const [result] = await conn.execute(
          `UPDATE \`${tableName}\` SET \`${field}\` = \`${field}\` + ? WHERE id = ?`,
          [delta, id]
        )
        return result.affectedRows
      } finally {
        release()
      }
    }
  }
}

module.exports = { createCrudRepo }
