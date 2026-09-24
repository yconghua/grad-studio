/**
 * 连接层（Connection Layer）
 *
 * 职责：
 *   1. 管理 MySQL 连接池（Pool），避免每个请求都新建/销毁连接；
 *   2. 基于 Node.js 内置 AsyncLocalStorage 实现「事务上下文」，
 *      让事务连接能在 Service 层透明传递给 Repository，而不必层层传参；
 *   3. 提供 setActiveConfig / getActiveConfig，支持运行时切换活跃数据库连接
 *      （切换时销毁旧池、按新配置重建池）。
 *
 * 上层（Repository / Service）只调用 acquireConn() 与 runTransaction()，
 * 不直接接触 mysql2 的连接创建细节。
 */
const mysql = require('mysql2/promise')
const { AsyncLocalStorage } = require('node:async_hooks')
// 前后端共享常量（连接池上限等），单一事实来源，避免硬编码
const { CONNECTION_LIMIT } = require('../../shared/constants')

// 事务上下文存储：runTransaction 执行期间，store 中挂入当前事务连接
const txStorage = new AsyncLocalStorage()

// 当前活跃连接池（随 setActiveConfig 重建）
let pool = null
// 当前活跃连接配置（供需要时读取 host/user/database 等元信息）
let activeConfig = null

// 根据连接配置创建连接池（复用 main.js 的 dateStrings 设定，保证时间字段返回字符串）
function createPool(config) {
  return mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: CONNECTION_LIMIT
  })
}

/**
 * 设置 / 切换活跃连接：销毁旧池（若有），按新配置重建池。
 * 由 main.js 启动时与「切换连接」时调用。
 * config 为 null 表示「未配置任何数据库连接」：连接池置空，
 * 之后所有数据库操作会抛出明确错误（由上层转成友好提示）。
 */
function setActiveConfig(config) {
  if (pool) {
    // 异步关闭旧池，不阻塞当前流程；忽略关闭过程中的异常
    pool.end().catch((e) => console.error('[DB-CONN] 关闭旧连接池失败:', e))
    console.log('[DB-CONN] 已销毁旧连接池')
  }
  activeConfig = config
  pool = config ? createPool(config) : null
  if (config) {
    console.log(
      `[DB-CONN] 连接池已建立 → host=${config.host} port=${config.port} database=${config.database} user=${config.user} limit=${CONNECTION_LIMIT}`
    )
  } else {
    console.warn('[DB-CONN] 连接池已清空（当前未配置任何数据库连接）')
  }
}

// 读取当前活跃连接配置（如 sys:db-info 展示用）
function getActiveConfig() {
  return activeConfig
}

/**
 * 获取一个可用连接。
 *   - 若处于 runTransaction 上下文内：返回事务连接（调用方无需释放，由事务管理器负责）；
 *   - 否则：从连接池取一条连接，调用方用完需调用返回的 release() 归还。
 * 返回结构：{ conn, release }
 */
async function acquireConn() {
  const store = txStorage.getStore()
  if (store && store.conn) {
    // 事务内：复用同一连接，release 为空操作（不可由 Repository 释放）
    return { conn: store.conn, release: () => {} }
  }
  if (!pool) {
    // 未配置任何数据库连接（用户还没在「添加数据库」里添加）
    console.error('[DB-CONN] acquireConn 失败：未配置数据库连接（请先在系统设置中添加数据库）')
    throw new Error('未配置数据库连接，请先添加数据库连接')
  }
  try {
    const conn = await pool.getConnection()
    // 非事务：归还连接到池
    return { conn, release: () => conn.release() }
  } catch (err) {
    console.error('[DB-CONN] 从连接池获取连接失败:', err)
    throw err
  }
}

/**
 * 在事务上下文中执行 fn。
 * fn 内部所有 Repository 调用会通过 acquireConn() 自动拿到同一事务连接，
 * 对 Repository 完全透明（无需把连接当参数传入）。
 * 成功自动 commit，异常自动 rollback 并向上抛出。
 */
async function runTransaction(fn) {
  if (!pool) {
    console.error('[DB-TX] 启动事务失败：未配置数据库连接（请先添加数据库连接）')
    throw new Error('未配置数据库连接，请先添加数据库连接')
  }
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    // 把事务连接挂入上下文，fn 及其内部 await 链均可取到
    console.log('[DB-TX] 事务开始')
    const result = await txStorage.run({ conn }, fn)
    await conn.commit()
    console.log('[DB-TX] 事务提交成功')
    return result
  } catch (err) {
    await conn.rollback().catch(() => {})
    console.error('[DB-TX] 事务回滚:', err)
    throw err
  } finally {
    // 无论成功失败，事务连接都由这里统一释放
    conn.release()
  }
}

module.exports = {
  setActiveConfig,
  getActiveConfig,
  acquireConn,
  runTransaction
}
