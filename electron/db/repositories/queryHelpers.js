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
function buildWhereClause(conditions = []) {
  const clauses = []
  const values = []
  for (const c of conditions) {
    const { field, op = '=', value } = c
    // undefined 的值视为「不参与过滤」，直接跳过
    if (value === undefined) continue

    if (op === 'IN') {
      // IN 集合必须非空数组，否则跳过该条件
      if (!Array.isArray(value) || value.length === 0) continue
      const placeholders = value.map(() => '?').join(', ')
      clauses.push(`\`${field}\` IN (${placeholders})`)
      values.push(...value)
    } else if (op === 'IS NULL' || op === 'IS NOT NULL') {
      // 空值判断不需要值
      clauses.push(`\`${field}\` ${op}`)
    } else {
      clauses.push(`\`${field}\` ${op} ?`)
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

module.exports = { buildWhereClause, buildUpdateSet }
