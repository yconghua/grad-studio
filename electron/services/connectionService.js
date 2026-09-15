/**
 * 连接服务（Service Layer）—— 数据库连接配置的纯业务逻辑
 *
 * 职责：
 *   1. 连接清单的加载 / 持久化（userData 目录下的 db-connections.json，天然不进版本库）；
 *   2. 连接配置的增 / 删 / 切换（CRUD）与启动注入连接层（setActiveConfig）；
 *   3. 连接探活（SELECT 1）；
 *   4. 数据表信息查询（getTablesInfo）与整库备份导出（exportDatabase，流式写文件）。
 *
 * 本服务只处理「连接本身」的业务，不编写任何 user 表的业务 SQL——
 * 那些在 authService 中。上层（ipc/sys.js）只调用这里暴露的方法。
 */
const fs = require('node:fs')
const path = require('node:path')
const mysql = require('mysql2/promise')
const { app } = require('electron')
// 数据库初始化公共模块（建库 + user 表 + 默认管理员），供「新增连接」自动初始化
const { initDatabase } = require('../db/create_new_database')
// 连接层：统一管理连接池；本服务只通过它切换活跃连接，不直接建池
const { setActiveConfig, getActiveConfig, acquireConn } = require('../db/connection')
// 前后端共享常量（默认端口等），单一事实来源，避免硬编码
const { DEFAULT_DB_PORT } = require('../../shared/constants')
// 应用版本号来自 package.json（与 ipc/sys.js 的 sys:info 同源），用于升级迁移检测
const appPkg = require('../../package.json')

// 连接清单持久化路径：优先放到用户数据目录，electron 未完全就绪时回退到项目目录
function connsPath() {
  try {
    return path.join(app.getPath('userData'), 'db-connections.json')
  } catch (e) {
    return path.join(__dirname, '..', 'db-connections.json')
  }
}

// 内存中的连接清单（启动时加载，运行时增删改后写回磁盘）
let connections = null
// 当前生效的 mysql2 连接配置（注入连接层，供 sys:db-info 读取元信息）
let activeConfig = null

// 加载连接清单：只读用户已保存的连接（userData/db-connections.json）。
// 不再内置任何默认连接：文件缺失 / 内容无效时返回空清单，由用户通过「添加数据库」自行配置。
function loadConnections() {
  let savedData = null
  try {
    const p = connsPath()
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8')
      savedData = JSON.parse(raw)
      // 基本校验：必须包含 list 且为数组
      if (!savedData || !Array.isArray(savedData.list)) {
        savedData = null
      }
    }
  } catch (e) {
    console.error('[connectionService] 读取已保存连接文件失败:', e)
    savedData = null
  }

  // 无已保存数据：空清单，等用户添加
  if (!savedData) {
    return { list: [], active: null }
  }

  // active 指针：优先取已保存值，失效或缺失则回退到第一个连接
  let activeId = null
  if (savedData.active) {
    const exists = savedData.list.some((c) => c.id === savedData.active)
    if (exists) activeId = savedData.active
  }
  if (!activeId && savedData.list.length > 0) {
    activeId = savedData.list[0].id
  }

  return { list: savedData.list.map((c) => ({ ...c })), active: activeId }
}

// 写回连接清单（失败仅记录，不阻断流程）
function saveConnections(data) {
  try {
    fs.writeFileSync(connsPath(), JSON.stringify(data || connections, null, 2))
  } catch (e) {
    console.error('[connectionService] 写入失败:', e)
  }
}

// 应用状态持久化路径（与连接清单平级，记录“上次版本”用于升级迁移检测）
function statePath() {
  try {
    return path.join(app.getPath('userData'), 'app-state.json')
  } catch (e) {
    return path.join(__dirname, '..', 'app-state.json')
  }
}

// 读取上次记录的版本；缺失或内容损坏返回 null
function loadState() {
  try {
    const p = statePath()
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'))
      if (data && typeof data.lastAppVersion === 'string') return data
    }
  } catch (e) {
    console.error('[connectionService] 读取状态失败:', e)
  }
  return null
}

// 写回当前版本（升级迁移完成后调用，保证“每个版本号只触发一次”）
function saveState(version) {
  try {
    fs.writeFileSync(statePath(), JSON.stringify({ lastAppVersion: version }, null, 2))
  } catch (e) {
    console.error('[connectionService] 写入状态失败:', e)
  }
}

// 取「当前生效」连接对象：connections.active 指向的，缺失则取第一个
function getActiveConn() {
  const c = connections.list.find((x) => x.id === connections.active)
  return c || connections.list[0]
}

// 将连接对象转换为 mysql2 连接配置（统一 dateStrings，让时间字段返回字符串）
function buildConfig(conn) {
  return {
    host: conn.host,
    port: Number(conn.port) || DEFAULT_DB_PORT,
    user: conn.user,
    password: conn.password,
    database: conn.database,
    dateStrings: true
  }
}

/**
 * 启动初始化：加载清单 + 构建当前生效配置 + 注入连接层。
 * 须在 app ready 之后调用（app.getPath 依赖 ready 状态）。
 * 没有任何已保存连接时，连接层置空（pool=null），登录页会提示「未配置数据库」，
 * 用户添加第一个连接后自动成为当前生效连接。
 * 若应用版本较上次启动发生变化，则在后台对所有“已配置数据库”重跑
 * schemas/ 下的 SQL（建库 / 建表 / 种子，幂等），作为一次升级迁移；
 * 迁移在后台执行，不阻塞窗口创建，且每个版本号只会触发一次。
 * 由 main.js 在窗口创建前调用一次。
 */
function init() {
  connections = loadConnections()
  const activeConn = getActiveConn()
  if (activeConn) {
    activeConfig = buildConfig(activeConn)
    setActiveConfig(activeConfig) // 建立连接池，handler 不再各自建连
  } else {
    // 没有可用连接：连接池置空，等用户在「添加数据库」时建立
    activeConfig = null
    setActiveConfig(null)
  }
  // 版本升级检测：变了才迁移，且跑完写回版本 → 只触发一次
  const current = appPkg.version
  const state = loadState()
  if (!state || state.lastAppVersion !== current) {
    runUpgradeMigration(current)
  }
  return { success: true }
}

/**
 * 升级迁移：对所有已配置库逐个重跑 initDatabase（幂等）。
 * 在后台执行，不阻塞 init 返回与窗口创建。
 * 逐库容错：单库失败仅记录，不影响其他库与整体启动。
 */
async function runUpgradeMigration(current) {
  console.log('[connectionService] 检测到版本变化，开始升级迁移...')
  const results = []
  for (const conn of connections.list) {
    try {
      await initDatabase(conn)
      results.push({ id: conn.id, name: conn.name, ok: true })
      console.log('[connectionService] 迁移完成：' + conn.name)
    } catch (err) {
      results.push({
        id: conn.id,
        name: conn.name,
        ok: false,
        message: err && err.message ? err.message : String(err)
      })
      console.error('[connectionService] 迁移失败 ' + conn.name + ':', err)
    }
  }
  // 只有"全部成功"才写回版本号：任一库失败都不写，下次启动会自动重试
  // （schemas/*.sql 全部幂等，重试不会产生重复数据/报错）
  const failed = results.filter((r) => !r.ok)
  if (failed.length === 0) {
    saveState(current)
    console.log('[connectionService] 升级迁移全部完成')
  } else {
    console.warn(
      '[connectionService] 升级迁移存在 ' +
        failed.length +
        ' 个库失败，本次不记录版本号，下次启动将自动重试：' +
        failed.map((f) => f.name).join('、')
    )
  }
}

// 探活：建一条临时连接执行 SELECT 1，成功返回 ok，失败返回原因（失败也安全关闭连接）
async function ping(cfg) {
  let conn
  try {
    conn = await mysql.createConnection(cfg)
    await conn.execute('SELECT 1')
    return { ok: true }
  } catch (e) {
    return { ok: false, message: e && e.message ? e.message : '连接失败' }
  } finally {
    if (conn) await conn.end().catch(() => {})
  }
}

// 返回当前生效连接的元信息（不含密码），供 sys:db-info 展示；未配置时返回空值
function getActiveMeta() {
  if (!activeConfig) return { host: '', user: '', port: null, database: '' }
  const cfg = activeConfig
  return { host: cfg.host, user: cfg.user, port: cfg.port, database: cfg.database }
}

/**
 * 查看数据表：返回当前库所有表 + 每张表的字段（名 / 类型 / 主键标记）与精确行数。
 * 用 query()（文本协议）而非 execute()（预编译）：information_schema 视图在
 * 预编译模式下列名会返回视图原始大写名（如 TABLE_NAME），导致行对象取不到小写别名
 * 从而把 undefined 传给绑定参数触发 mysql2 报错；文本协议严格跟随 AS 别名，规避该问题。
 * 表名来自 information_schema 且按反引号转义，避免注入。
 */
async function getTablesInfo() {
  let acquired = null
  try {
    acquired = await acquireConn()
    const { conn, release } = acquired
    // 1) 表清单（按表名排序）
    const [tables] = await conn.query(
      `SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY name`
    )
    const list = []
    for (const row of tables) {
      // 兼容列名大小写（部分 MySQL / MariaDB 返回 TABLE_NAME）
      const tableName = row && (row.name || row.NAME || row.table_name || row.TABLE_NAME)
      if (typeof tableName !== 'string' || !tableName) continue
      // 2) 字段（名称 + 类型 + 键标记，按定义顺序）
      const [cols] = await conn.query(
        `SELECT column_name AS name, column_type AS type, column_key AS k
         FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ?
         ORDER BY ordinal_position`,
        [tableName]
      )
      // 3) 精确行数（每表一次 COUNT）
      const safeName = '`' + tableName.replace(/`/g, '``') + '`'
      const [cnt] = await conn.query(`SELECT COUNT(*) AS cnt FROM ${safeName}`)
      list.push({
        name: tableName,
        count: Number(cnt[0].cnt),
        columns: cols.map((c) => ({
          name: c.name || c.column_name,
          type: c.type || c.column_type,
          key: c.k || c.column_key
        }))
      })
    }
    release()
    return { success: true, tables: list }
  } catch (err) {
    if (acquired && acquired.release) acquired.release()
    return { success: false, message: err && err.message ? err.message : '查询失败' }
  }
}

// 个位数补零
function pad2(n) {
  return String(n).padStart(2, '0')
}

// 等待写入流完成并关闭（处理 finish / error 回调）
// streamError：导出期间已捕获到的流错误（方案 A 空窗期修复的载体）。
// 传入非空说明流已出错，直接以该错误拒绝，避免对已错误/已销毁的流再调 end() 二次抛异常。
function closeStream(stream, streamError) {
  return new Promise((resolve, reject) => {
    if (streamError) return reject(streamError)
    stream.once('error', reject)
    stream.on('finish', resolve)
    stream.end()
  })
}

/**
 * 导出当前库为 SQL 备份文件（表结构 + 全量数据）。
 * - InnoDB 一致性快照读：导出期间读到同一版本数据（MyISAM 等引擎自动退化）；
 * - 分批查询（每批 500 行）+ 流式写文件，大库不撑爆内存；
 * - 值统一用 mysql2 的 escape 转义（字符串 / 日期 / 二进制均安全）。
 * filePath 由调用方（ipc 层弹出保存对话框后）传入。
 * 返回 { success, path, database, tables, rows, bytes }；失败 { success:false, message }。
 */
async function exportDatabase(filePath) {
  let acquired = null
  let stream = null
  // 方案 A：创建流后立即挂 error 监听，捕获异步写入错误（磁盘满/权限拒绝/文件被占用），
  // 堵住「创建流 → closeStream 挂监听」之间的空窗期，避免 ERR_UNHANDLED_ERROR 崩主进程
  let streamError = null
  // 方案 B：先写临时文件，全部写完后 rename 到目标路径；失败只清理临时文件，目标文件不被污染
  const tmpPath = filePath ? filePath + '.tmp' : null
  let totalRows = 0
  let totalBytes = 0
  try {
    if (!filePath) return { success: false, message: '未指定保存路径' }
    acquired = await acquireConn()
    const { conn, release } = acquired
    const dbName = (activeConfig && activeConfig.database) || ''

    // 1) 表清单（按名排序，与「查看数据表」一致）
    const [tables] = await conn.query(
      `SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY name`
    )
    const tableNames = tables
      .map((r) => r && (r.name || r.NAME || r.table_name || r.TABLE_NAME))
      .filter((n) => typeof n === 'string' && n.length > 0)
    if (!tableNames.length) {
      return { success: false, message: '当前库没有任何表，无需备份' }
    }

    // 一致性快照读
    await conn.beginTransaction()

    // 2) 文件头
    const now = new Date()
    const timeText =
      `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ` +
      `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`
    const head = [
      '-- ============================================================',
      '-- grad-studio 数据库备份',
      `-- 数据库：${dbName}`,
      `-- 导出时间：${timeText}`,
      `-- 表数量：${tableNames.length}`,
      '-- 本文件由「系统管理 → 导出数据库备份」生成，',
      '-- 可用 mysql 客户端或恢复工具执行导入',
      '-- ============================================================',
      '',
      'SET NAMES utf8mb4;',
      'SET FOREIGN_KEY_CHECKS = 0;',
      ''
    ].join('\n')

    stream = fs.createWriteStream(tmpPath, { encoding: 'utf8' })
    // 创建即挂 error 监听（方案 A）：写入失败是异步 emit 'error'，必须先有监听才能被捕获
    stream.on('error', (e) => {
      streamError = e
    })
    stream.write(head)
    totalBytes += Buffer.byteLength(head)

    // 3) 逐表导出：建表语句 + 分批 INSERT
    const BATCH = 500
    for (const name of tableNames) {
      const safeName = '`' + name.replace(/`/g, '``') + '`'
      // 3.1 表结构
      const [ddlRows] = await conn.query(`SHOW CREATE TABLE ${safeName}`)
      const ddlRow = ddlRows[0] || {}
      const ddl = ddlRow['Create Table'] || ddlRow['CREATE TABLE'] || ''
      const ddlBlock =
        [
          '',
          '-- ----------------------------',
          `-- 表结构：${name}`,
          '-- ----------------------------',
          `DROP TABLE IF EXISTS ${safeName};`,
          ddl ? ddl + ';' : '-- （无法获取建表语句）',
          ''
        ].join('\n') + '\n'
      stream.write(ddlBlock)
      totalBytes += Buffer.byteLength(ddlBlock)

      // 3.2 数据：每批 500 行，生成完整 INSERT 语句
      let offset = 0
      let cols = ''
      while (true) {
        const [rows] = await conn.query(`SELECT * FROM ${safeName} LIMIT ${BATCH} OFFSET ${offset}`)
        if (!rows.length) break
        if (!cols) {
          cols = Object.keys(rows[0])
            .map((c) => '`' + c.replace(/`/g, '``') + '`')
            .join(', ')
          const headBlock = ['', `-- 数据：${name}`, ''].join('\n')
          stream.write(headBlock)
          totalBytes += Buffer.byteLength(headBlock)
        }
        const lines = rows.map((r) => {
          const values = Object.values(r)
            .map((v) => conn.escape(v))
            .join(', ')
          return '(' + values + ')'
        })
        const dataBlock = `INSERT INTO ${safeName} (${cols}) VALUES\n${lines.join(',\n')};\n`
        stream.write(dataBlock)
        totalBytes += Buffer.byteLength(dataBlock)
        totalRows += rows.length
        if (rows.length < BATCH) break
        offset += BATCH
      }
    }

    // 4) 收尾 + 落盘
    const tail = '\nSET FOREIGN_KEY_CHECKS = 1;\n'
    stream.write(tail)
    totalBytes += Buffer.byteLength(tail)
    // 等待流写完并关闭；若期间已捕获到 streamError，closeStream 会直接以其拒绝
    await closeStream(stream, streamError)
    stream = null
    // 方案 B：临时文件写完后原子替换目标文件（rename 失败也不会污染目标路径）
    await fs.promises.rename(tmpPath, filePath)
    await conn.commit()

    return {
      success: true,
      path: filePath,
      database: dbName,
      tables: tableNames.length,
      rows: totalRows,
      bytes: totalBytes
    }
  } catch (err) {
    // 回滚未提交事务 + 清理半成品文件，避免留下损坏的备份
    if (acquired && acquired.conn) {
      try {
        await acquired.conn.rollback()
      } catch (e) {}
    }
    // 坑 1：流已出错（streamError）时不再 closeStream——对已错误/已销毁的流 end() 会二次抛异常；
    // 未出错才正常收尾，把缓冲数据刷完后再统一清理
    try {
      if (stream && !streamError) await closeStream(stream, streamError)
    } catch (e) {}
    // 方案 B：只清理临时文件（真正的半成品）——rename 成功前目标文件从未被本次导出写入，
    // 目标路径上只可能是用户预存在的旧备份，绝不能在导出失败时删除（F1 数据丢失风险）
    try {
      if (tmpPath && fs.existsSync(tmpPath)) await fs.promises.unlink(tmpPath)
    } catch (e) {}
    console.error('[connectionService] 导出数据库失败:', err)
    return { success: false, message: err && err.message ? err.message : '导出失败' }
  } finally {
    if (acquired && acquired.release) acquired.release()
  }
}

// 返回连接清单（脱敏：不含 password，仅用 hasPassword 标记），以及当前生效 id，供前端展示 / 切换
function list() {
  const list = connections.list.map((c) => ({
    id: c.id,
    name: c.name,
    host: c.host,
    port: c.port,
    database: c.database,
    hasPassword: !!c.password
  }))
  return { active: connections.active, list }
}

// 切换当前生效连接：先探活，成功才生效并持久化 + 注入连接层
async function switchConnection(id) {
  const target = connections.list.find((x) => x.id === id)
  if (!target) return { success: false, message: '未找到该连接' }
  const cfg = buildConfig(target)
  const test = await ping(cfg)
  if (!test.ok) return { success: false, message: '连接失败：' + test.message }
  connections.active = id
  activeConfig = cfg
  setActiveConfig(cfg) // 关键：让连接池绑定到新连接
  saveConnections()
  return { success: true, message: '已切换到「' + target.name + '」' }
}

// 新增连接：先连库自动初始化（建库 + 建表 + 默认管理员），成功才写入清单
async function add(payload) {
  const { name, host, port, user, password, database } = payload || {}
  if (!name || !host || !user || !database) {
    return { success: false, message: '请填写名称、主机、账号与数据库名' }
  }
  if (!/^[A-Za-z0-9_]+$/.test(database)) {
    return { success: false, message: '数据库名仅支持字母、数字、下划线' }
  }
  const id = 'user-' + Date.now()
  const conn = { id, name, host, port: Number(port) || DEFAULT_DB_PORT, user, password: password || '', database }
  // 自动初始化：库不存在会先建库，再建 user 表、插入默认管理员 admin/admin123
  try {
    await initDatabase(conn)
  } catch (err) {
    return {
      success: false,
      message: '初始化失败（请确认账号可连接且有建库/建表权限）：' + (err && err.message ? err.message : err)
    }
  }
  connections.list.push(conn)
  // 第一个连接：自动设为当前生效连接（无默认连接后，首次添加即可直接使用）
  if (!connections.active) {
    connections.active = conn.id
    activeConfig = buildConfig(conn)
    setActiveConfig(activeConfig)
  }
  saveConnections()
  return { success: true, id, message: '已添加连接「' + name + '」，并完成初始化' }
}

// 删除连接：在用需先切换、至少保留一个（后端兜底）
async function remove(id) {
  const target = connections.list.find((x) => x.id === id)
  if (!target) return { success: false, message: '未找到该连接' }
  if (connections.list.length <= 1) {
    return { success: false, message: '至少保留一个连接，无法删除' }
  }
  if (id === connections.active) {
    return { success: false, message: '请先切换到其他连接再删除' }
  }
  connections.list = connections.list.filter((x) => x.id !== id)
  saveConnections()
  return { success: true, message: '已删除连接「' + target.name + '」' }
}

module.exports = {
  init,
  ping,
  getActiveMeta,
  getActiveConfig, // 透传连接层当前配置（sys:db-info 探活时用）
  getTablesInfo,
  exportDatabase,
  list,
  switchConnection,
  add,
  remove
}
