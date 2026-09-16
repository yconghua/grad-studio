/**
 * 路由层聚合入口（IPC Layer）
 *
 * 把所有按前缀拆分的路由模块（auth / sys ...）统一注册到 ipcMain。
 * main.js 只需调用 registerAll(ipcMain) 即可挂载全部后端接口，
 * 新增一类路由时在下方引入并调用其 register 即可，main.js 无需改动。
 */
const authRoutes = require('./auth')
const sysRoutes = require('./sys')
const researchRoutes = require('./research')
const studioRoutes = require('./studio')
const resourceRoutes = require('./resource')
const collabRoutes = require('./collab')
const workbenchRoutes = require('./workbench')
const systemRoutes = require('./system')

// 注册全部 IPC 路由
function registerAll(ipcMain) {
  authRoutes.register(ipcMain) // 认证路由（auth:* 前缀）
  sysRoutes.register(ipcMain) // 系统 / 数据库路由（sys:* 前缀）
  researchRoutes.register(ipcMain) // 科研管理（research:* 前缀）
  studioRoutes.register(ipcMain) // 工作室事务（studio:* 前缀）
  resourceRoutes.register(ipcMain) // 资源中心（resource:* 前缀）
  collabRoutes.register(ipcMain) // 协同办公（collab:* 前缀）
  workbenchRoutes.register(ipcMain) // 工作台（workbench:* 前缀）
  systemRoutes.register(ipcMain) // 系统 / 个人（system:* 前缀）
}

module.exports = { registerAll }
