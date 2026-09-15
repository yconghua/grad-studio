/**
 * 数据库初始化公共模块
 *
 * 数据库初始化的唯一实现：建库（带 IF NOT EXISTS）+ 按文件名顺序执行 schemas/ 下全部 .sql。
 * 每张表的「建表语句 + 默认数据」都放在 electron/db/schemas/ 目录的独立 .sql 文件中
 * （以 01_ / 02_ 数字前缀命名控制执行顺序），本文件不再手写任何 CREATE TABLE。
 *
 * 这样新增一张表时，只需在 schemas/ 下新建一个「NN_表名.sql」即可，主初始化代码零改动；
 * 后续改表结构也直接改对应 .sql 文件，与 repositories/（运行时 CRUD）、services/、ipc/ 完全独立。
 *
 * 版本升级（schema 同步）：版本号变化时 connectionService.runUpgradeMigration 会对所有已配置库
 * 重跑 initDatabase。此时表已存在，CREATE TABLE IF NOT EXISTS 不会重建结构——因此本模块在逐句执行
 * 之后，会解析每个 .sql 文件声明的列，与库中实际列做差集，缺失列逐个
 * ALTER TABLE ... ADD COLUMN 补齐，使「改 .sql 加列 → 升级后自动补列」真正生效。
 * 所有步骤幂等：已存在的列会被跳过，单条 ALTER 失败即抛出（上层「全部库成功才写版本号」逻辑
 * 下次启动会重试，已成功的列天然跳过），因此整体可安全重试。
 *
 * 由 connectionService.add（添加新数据库）与 connectionService.runUpgradeMigration（版本升级）调用。
 */
const fs = require('node:fs')
const path = require('node:path')
const mysql = require('mysql2/promise')

// schemas 目录：每个 .sql 文件对应一张表的建表 + 默认数据
const SCHEMAS_DIR = path.join(__dirname, 'schemas')

// ---------- 建表语句解析（供补列同步使用） ----------

// 剥离 SQL 注释（行注释 -- / 块注释 /* */），字符串字面量内的内容保留不动。
// 遵循 MySQL 规则：-- 后必须紧跟空白或行尾才算注释，避免误伤 '--' 之类字符串内容。
function stripSqlComments(sqlText) {
  let out = ''
  let inSingle = false
  let inDouble = false
  const n = sqlText.length
  for (let i = 0; i < n; i++) {
    const ch = sqlText[i]
    const next = sqlText[i + 1]
    const prev = i > 0 ? sqlText[i - 1] : ''
    if (inSingle) {
      out += ch
      if (ch === "'" && prev !== '\\') inSingle = false
      continue
    }
    if (inDouble) {
      out += ch
      if (ch === '"' && prev !== '\\') inDouble = false
      continue
    }
    if (ch === "'") {
      inSingle = true
      out += ch
      continue
    }
    if (ch === '"') {
      inDouble = true
      out += ch
      continue
    }
    if (ch === '-' && next === '-') {
      const after = sqlText[i + 2]
      if (after === undefined || /\s/.test(after)) {
        // 行注释：吞到行尾，保留换行以维持语句边界
        while (i < n && sqlText[i] !== '\n') i++
        if (i < n) out += '\n'
        continue
      }
    }
    if (ch === '/' && next === '*') {
      // 块注释：吞到 */，替换为一个空格避免拼接粘连
      i += 2
      while (i < n && !(sqlText[i] === '*' && sqlText[i + 1] === '/')) i++
      i += 2
      out += ' '
      continue
    }
    out += ch
  }
  return out
}

// 解析一段 CREATE TABLE 语句，返回 { table, columns: [{ name, def }] }。
// - table：反引号包裹的表名（去反引号）；
// - columns：顶层列定义列表；表级约束（PRIMARY KEY / UNIQUE KEY / KEY / INDEX /
//   CONSTRAINT / FOREIGN KEY）不参与补列，直接跳过。
function parseCreateTableStatement(stmt) {
  const tableMatch = stmt.match(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`([^`]+)`/i)
  if (!tableMatch) return null
  const table = tableMatch[1]

  const openIdx = stmt.indexOf('(')
  if (openIdx < 0) return { table, columns: [] }

  // 找与第一个 '(' 配对的 ')'（跳过嵌套括号与字符串字面量），即列定义区右边界。
  // 比 lastIndexOf(')') 更稳：表选项 COMMENT 等字符串里若含 ')' 不会误判右边界。
  let depth = 0
  let inSingle = false
  let inDouble = false
  let closeIdx = -1
  for (let i = openIdx; i < stmt.length; i++) {
    const ch = stmt[i]
    const prev = i > openIdx ? stmt[i - 1] : ''
    if (inSingle) {
      if (ch === "'" && prev !== '\\') inSingle = false
      continue
    }
    if (inDouble) {
      if (ch === '"' && prev !== '\\') inDouble = false
      continue
    }
    if (ch === "'") inSingle = true
    else if (ch === '"') inDouble = true
    else if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth === 0) {
        closeIdx = i
        break
      }
    }
  }
  if (closeIdx < 0) return { table, columns: [] }
  const body = stmt.slice(openIdx + 1, closeIdx)

  // 按括号深度 + 字符串状态切分顶层列段：深度为 0 且不在字符串字面量内的逗号才是分隔符。
  // 这样 VARCHAR(50) / DECIMAL(10,2) / ENUM('a','b') 内的逗号、DEFAULT 'xx,yy' 字符串逗号都不会误切。
  const segments = []
  let segStart = 0
  depth = 0
  inSingle = false
  inDouble = false
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    const prev = i > 0 ? body[i - 1] : ''
    if (inSingle) {
      if (ch === "'" && prev !== '\\') inSingle = false
      continue
    }
    if (inDouble) {
      if (ch === '"' && prev !== '\\') inDouble = false
      continue
    }
    if (ch === "'") inSingle = true
    else if (ch === '"') inDouble = true
    else if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === ',' && depth === 0) {
      const seg = body.slice(segStart, i).trim()
      if (seg) segments.push(seg)
      segStart = i + 1
    }
  }
  const last = body.slice(segStart).trim()
  if (last) segments.push(last)

  const columns = []
  for (const seg of segments) {
    // 表级约束段：跳过（不参与补列）
    if (/^(PRIMARY\s+KEY|UNIQUE\s+KEY|KEY|INDEX|CONSTRAINT|FOREIGN\s+KEY)\b/i.test(seg)) continue
    // 列定义：以反引号开头，提取列名（第一个反引号对）+ 保留完整 def 文本（含类型/默认值/注释/列级约束）
    const m = seg.match(/^`([^`]+)`/)
    if (!m) continue
    columns.push({ name: m[1], def: seg })
  }
  return { table, columns }
}

/**
 * 解析 .sql 文件文本中的全部 CREATE TABLE 语句。
 * @param {string} sqlText 单个 .sql 文件的完整文本
 * @returns {Array<{ table: string, columns: Array<{ name: string, def: string }> }>}
 */
function parseCreateTables(sqlText) {
  if (typeof sqlText !== 'string' || !sqlText.trim()) return []
  const stripped = stripSqlComments(sqlText)
  const result = []
  for (const stmt of stripped
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)) {
    if (!/^CREATE\s+TABLE\b/i.test(stmt)) continue
    const info = parseCreateTableStatement(stmt)
    if (info) result.push(info)
  }
  return result
}

// ---------- 列同步（升级迁移补列） ----------

/**
 * 对单张表做列同步：文件声明的列 与 库中实际列 做差集，缺失列逐个 ALTER ADD COLUMN。
 * 单条 ALTER 失败即抛出（上层 runUpgradeMigration 依赖「全部库成功才写版本号」，
 * 失败下次启动自动重试；已成功的列下次因已存在被跳过，天然幂等）。
 * 错误消息带上表名 / 列名 / 文件名，便于使用者定位。
 */
async function syncTableColumns(conn, tableInfo, file) {
  const { table, columns } = tableInfo
  if (!columns || columns.length === 0) return

  // 用 query（文本协议）查 information_schema：预编译 execute 在该视图上列名会返回大写原名
  // （详见 connectionService.getTablesInfo 的注释），文本协议严格跟随 AS 别名，规避该问题。
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME AS name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?`,
    [table]
  )
  const existing = new Set()
  for (const r of rows || []) {
    const n = r && (r.name || r.COLUMN_NAME || r.column_name)
    if (n) existing.add(String(n).toLowerCase())
  }

  const safeTable = '`' + table.replace(/`/g, '``') + '`'
  for (const col of columns) {
    const colName = col.name.toLowerCase()
    if (existing.has(colName)) continue
    // def 来自本仓库 schemas/*.sql 文件原文（可信）；表名反引号转义防注入。
    try {
      await conn.query(`ALTER TABLE ${safeTable} ADD COLUMN ${col.def}`)
    } catch (err) {
      const msg = err && err.message ? err.message : String(err)
      throw new Error(`为表 \`${table}\` 补列 \`${col.name}\` 失败（文件：${file}）：${msg}`)
    }
    existing.add(colName)
  }
}

// 初始化目标库：库不存在则自动创建，随后按文件名顺序执行 schemas/ 下所有 .sql
// （建表 + 种子数据），并对每个文件做列同步（已存在的表缺列时自动 ADD COLUMN 补齐）。
async function initDatabase({ host, port, user, password, database }) {
  // 先连 MySQL 服务（不指定库），用于建库
  const conn = await mysql.createConnection({ host, port, user, password })
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_general_ci`
    )
    await conn.query(`USE \`${database}\``)

    // 读取 schemas 目录下全部 .sql 文件，按文件名（数字前缀）排序后逐个执行
    const files = fs
      .readdirSync(SCHEMAS_DIR)
      .filter((f) => f.toLowerCase().endsWith('.sql'))
      .sort() // 依赖 01_ / 02_ 零填充前缀保证执行顺序

    for (const file of files) {
      const sql = fs.readFileSync(path.join(SCHEMAS_DIR, file), 'utf8')

      // 1) 现有逻辑：按分号拆成多条语句逐句执行（建表 + 幂等种子插入）。
      //    注意：若以后 .sql 含触发器 / 存储过程（内部有分号），需升级此分隔逻辑。
      const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)
      for (const stmt of statements) {
        await conn.query(stmt)
      }

      // 2) 列同步：解析本文件声明的列，与库中实际列做差集，缺失列 ALTER ADD COLUMN 补齐。
      //    新表（刚由上面 CREATE TABLE 建立）列必然齐全，不会产生 ALTER；
      //    已存在的表缺列时才补列——这就是「版本升级加列生效」的关键一步。
      for (const tableInfo of parseCreateTables(sql)) {
        await syncTableColumns(conn, tableInfo, file)
      }
    }
  } finally {
    await conn.end().catch(() => {})
  }
}

module.exports = { initDatabase, parseCreateTables }
