/**
 * 查询辅助函数（Repository 层共用）
 *
 * 解决两个裸 SQL 的典型痛点：
 *   1. 动态条件拼接（buildWhereClause）——避免手写一堆 WHERE a=? AND b=?；
 *   2. 增量更新拼接（buildUpdateSet）——只更新传入的字段，跳过未传字段。
 *
 * 安全约定：
 *   - 所有「值」一律通过 ? 占位符 + values 数组传参，杜绝 SQL 注入；
 *   - field / 列名直接拼进 SQL 字符串，因此 field 必须是「开发者代码里可信的列名」，
 *     绝不能把前端传入的字段名直接塞进来，否则存在注入风险。
 */

/**
 * 动态条件拼接。
 * @param {Array<{field:string, op?:string, value?:any}>} conditions
 *        field：列名（可信）；op：比较符，默认 '='，支持 '=' 'LIKE' '>' '<' 'IN' 'IS NULL' 'IS NOT NULL'；
 *        value：比较值（IN 时为数组；IS NULL / IS NOT NULL 时忽略 value）。
 * @returns {{ clause: string, values: any[] }} clause 形如 "WHERE `a` = ? AND `b` LIKE ?"，无条件下为空串
 */
function buildWhereClause(conditions = [], tablePrefix) {
  const clauses = []
  const values = []
  for (const c of conditions) {
    const { field, op = '=', value } = c
    // undefined 的值视为「不参与过滤」，直接跳过
    if (value === undefined) continue

    // 联表场景可传表别名前缀（如 'u'），列名渲染为 `u`.`field`
    const col = tablePrefix ? `\`${tablePrefix}\`.\`${field}\`` : `\`${field}\``
    if (op === 'IN') {
      // IN 集合必须非空数组，否则跳过该条件
      if (!Array.isArray(value) || value.length === 0) continue
      const placeholders = value.map(() => '?').join(', ')
      clauses.push(`${col} IN (${placeholders})`)
      values.push(...value)
    } else if (op === 'IS NULL' || op === 'IS NOT NULL') {
      // 空值判断不需要值
      clauses.push(`${col} ${op}`)
    } else {
      clauses.push(`${col} ${op} ?`)
      values.push(value)
    }
  }
  return {
    clause: clauses.length ? 'WHERE ' + clauses.join(' AND ') : '',
    values
  }
}

/**
 * 增量更新拼接：仅对「非 undefined」的字段生成 SET 片段。
 * @param {Object} data 字段->值 映射（值为 undefined 的字段被忽略，不会被覆盖为 NULL）
 * @returns {{ clause: string, values: any[] }} clause 形如 "`a` = ?, `b` = ?"
 */
function buildUpdateSet(data = {}) {
  const sets = []
  const values = []
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue
    sets.push(`\`${k}\` = ?`)
    values.push(v)
  }
  return { clause: sets.join(', '), values }
}

// ===== 分页统一规则 =====
// 所有列表统一每页 8 条（pageSize 固定，不接受前端自定义），返回页码从 1 开始。
// 个别「全量下拉」场景可显式传 pageSize 覆盖（如超管按组核查的组列表）。
const PAGE_SIZE = 8

/**
 * 规范化分页参数。
 * @param {number|string} [page] 页码，默认 1
 * @param {number|string} [pageSize] 每页条数，默认 PAGE_SIZE（仅全量场景显式覆盖）
 * @returns {{ page: number, pageSize: number, limit: number, offset: number }}
 */
function normalizePage(page, pageSize) {
  const p = Math.max(1, parseInt(page, 10) || 1)
  const size = Math.min(200, Math.max(1, parseInt(pageSize, 10) || PAGE_SIZE))
  return { page: p, pageSize: size, limit: size, offset: (p - 1) * size }
}

/**
 * 组装分页响应结构。
 * @param {number} total 总条数
 * @param {number} page 当前页码
 * @param {number} pageSize 每页条数
 * @returns {{ total: number, page: number, pageSize: number, totalPages: number }}
 */
function buildPageMeta(total, page, pageSize) {
  return {
    total,
    page,
    pageSize,
    totalPages: total ? Math.ceil(total / pageSize) : 0
  }
}

/**
 * 组装 ORDER BY 片段（列表后端排序统一收口）。
 * @param {Object} [filters] 查询参数（可含 sortField / sortOrder）
 * @param {Object} [sortMap] 语义字段名 → 可信 SQL 片段映射（开发者写死，不接受前端列名）
 * @param {string} [defaultOrderBy] 无排序参数时的默认排序片段（如 'n.is_top DESC, n.publish_time DESC'）
 * @returns {string} 'ORDER BY ...'；filters 无有效排序且未给默认时返回空串
 */
function buildOrderBy(filters = {}, sortMap = {}, defaultOrderBy = '') {
  const field = filters && filters.sortField
  const order = filters && filters.sortOrder
  if (field && Object.prototype.hasOwnProperty.call(sortMap, field)) {
    // 排序方向白名单：非 desc 一律按升序；sortField 不在映射内时忽略
    const dir = order === 'desc' ? 'DESC' : 'ASC'
    return `ORDER BY ${sortMap[field]} ${dir}`
  }
  return defaultOrderBy ? `ORDER BY ${defaultOrderBy}` : ''
}

module.exports = { buildWhereClause, buildUpdateSet, buildOrderBy, PAGE_SIZE, normalizePage, buildPageMeta }
