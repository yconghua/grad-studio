/**
 * 系统服务（Service Layer）—— 系统信息 / 数据库信息 / 系统参数 / 公共系统接口
 *
 * 覆盖：
 *   - 超级管理员「系统配置」：系统信息、数据库信息、系统参数增删改查；
 *   - 公共接口（所有角色）：系统简介、检查更新。
 * 系统参数 config_type 当前统一按字符串处理，字段预留（后续扩展 number/boolean/json）。
 */
const os = require('node:os')
const { getActiveConfig, acquireConn } = require('../db/connection')
const systemConfigRepository = require('../db/repositories/systemConfigRepository')
const ApiError = require('./apiError')
const appPkg = require('../../package.json')

// 应用启动时间戳：模块加载时机 ≈ 主进程启动
const STARTED_AT = Date.now()
const DEFAULT_APP_NAME = '课题组科研管理平台'

// 本地时间格式化（YYYY-MM-DD HH:mm:ss）
function formatDate(ts) {
  const d = new Date(ts)
  const pad2 = (n) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
  )
}

// 行转 DTO（字段名转驼峰）
function toParamDto(row) {
  if (!row) return null
  return {
    id: row.id,
    configKey: row.config_key,
    configValue: row.config_value,
    configType: row.config_type || 'string',
    description: row.description || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

/**
 * 系统信息（超级管理员「系统配置」块 1）
 */
async function getInfo() {
  let name = DEFAULT_APP_NAME
  try {
    const row = await systemConfigRepository.findByKey('system.name')
    if (row && row.config_value && String(row.config_value).trim()) name = String(row.config_value).trim()
  } catch (e) {
    // 数据库未连接 / 表不存在时回退默认名
  }
  return {
    name,
    version: appPkg.version,
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    serverTime: formatDate(Date.now()),
    startedAt: formatDate(STARTED_AT),
    platform: `${os.type()} ${os.release()}`,
    nodeVersion: process.versions.node,
    electronVersion: process.versions.electron
  }
}

/**
 * 数据库信息（超级管理员「系统配置」块 2）：类型 / 版本 / 连接状态 / 表数量 / 当前连接数
 */
async function getDatabaseInfo() {
  const config = getActiveConfig()
  const meta = {
    database: config && config.database ? config.database : null,
    host: config && config.host ? config.host : null
  }
  if (!config) {
    return { type: 'MySQL', connected: false, version: '', tableCount: 0, activeConnections: 0, ...meta }
  }
  let acquired = null
  try {
    // acquireConn 返回 { conn, release }，须先解构出连接再执行查询
    acquired = await acquireConn()
    const { conn } = acquired
    const [verRows] = await conn.execute('SELECT VERSION() AS v')
    const [tblRows] = await conn.execute(
      'SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE()'
    )
    const [procRows] = await conn.execute(
      "SELECT COUNT(*) AS c FROM information_schema.processlist WHERE user NOT IN ('event_scheduler')"
    )
    return {
      type: 'MySQL',
      connected: true,
      version: verRows[0].v,
      tableCount: Number(tblRows[0].c) || 0,
      activeConnections: Number(procRows[0].c) || 0,
      ...meta
    }
  } catch (err) {
    return { type: 'MySQL', connected: false, version: '', tableCount: 0, activeConnections: 0, error: err.message, ...meta }
  } finally {
    if (acquired && acquired.release) acquired.release()
  }
}

/**
 * 系统参数分页列表（超级管理员「系统配置」块 3）
 */
async function listParams({ page, keyword } = {}) {
  const result = await systemConfigRepository.pagedList({ page, keyword })
  return {
    list: result.list.map(toParamDto),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages
  }
}

/**
 * 新增系统参数：参数键唯一，类型预留字段默认 string
 */
async function createParam({ configKey, configValue, configType, description } = {}) {
  if (!configKey || !String(configKey).trim()) throw new ApiError('请输入参数键', 400)
  const key = String(configKey).trim()
  if (key.length > 100) throw new ApiError('参数键不能超过 100 个字符', 400)
  if (description !== undefined && description !== null && String(description).trim().length > 255) {
    throw new ApiError('参数描述不能超过 255 个字符', 400)
  }
  const exists = await systemConfigRepository.findByKey(key)
  if (exists) throw new ApiError('参数键已存在', 400)
  const type = configType && String(configType).trim() ? String(configType).trim() : 'string'
  const id = await systemConfigRepository.create({
    config_key: key,
    config_value: configValue == null ? '' : String(configValue),
    config_type: type,
    description: description && String(description).trim() ? String(description).trim() : null
  })
  const row = await systemConfigRepository.findById(id)
  return toParamDto(row)
}

/**
 * 编辑系统参数：参数键唯一（排除自身）；code 类型字段默认保持原值
 */
async function updateParam(id, { configKey, configValue, configType, description } = {}) {
  const idNum = Number(id)
  const row = await systemConfigRepository.findById(idNum)
  if (!row) throw new ApiError('系统参数不存在', 404)

  const data = {}
  if (configKey !== undefined) {
    if (!String(configKey).trim()) throw new ApiError('请输入参数键', 400)
    const key = String(configKey).trim()
    if (key.length > 100) throw new ApiError('参数键不能超过 100 个字符', 400)
    const exists = await systemConfigRepository.findByKey(key)
    if (exists && exists.id !== idNum) throw new ApiError('参数键已存在', 400)
    data.config_key = key
  }
  if (configValue !== undefined) data.config_value = configValue == null ? '' : String(configValue)
  if (configType !== undefined && String(configType).trim()) data.config_type = String(configType).trim()
  if (description !== undefined) {
    const desc = String(description).trim()
    if (desc.length > 255) throw new ApiError('参数描述不能超过 255 个字符', 400)
    data.description = desc || null
  }

  await systemConfigRepository.updateById(idNum, data)
  const updated = await systemConfigRepository.findById(idNum)
  return toParamDto(updated)
}

/**
 * 删除系统参数（物理删除）
 */
async function deleteParam(id) {
  const row = await systemConfigRepository.findById(Number(id))
  if (!row) throw new ApiError('系统参数不存在', 404)
  await systemConfigRepository.deleteById(Number(id))
  return true
}

/**
 * 系统简介（所有角色）：返回系统名称、版本、简介
 */
async function getIntroduction() {
  let name = DEFAULT_APP_NAME
  let introduction = ''
  try {
    const [nameRow, introRow] = await Promise.all([
      systemConfigRepository.findByKey('system.name'),
      systemConfigRepository.findByKey('system.introduction')
    ])
    if (nameRow && nameRow.config_value && String(nameRow.config_value).trim()) {
      name = String(nameRow.config_value).trim()
    }
    if (introRow && introRow.config_value) introduction = String(introRow.config_value)
  } catch (e) {
    // 数据库未连接 / 表不存在时回退默认值
  }
  return { name, version: appPkg.version, introduction }
}

/**
 * 检查更新（所有角色）：暂时返回当前版本与「已是最新版本」
 */
function checkUpdate() {
  return {
    currentVersion: appPkg.version,
    latestVersion: appPkg.version,
    upToDate: true,
    message: '当前已是最新版本'
  }
}

module.exports = {
  getInfo,
  getDatabaseInfo,
  listParams,
  createParam,
  updateParam,
  deleteParam,
  getIntroduction,
  checkUpdate
}
