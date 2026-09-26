/**
 * 路由层聚合入口（IPC Layer）
 *
 * 把所有按前缀拆分的路由模块（auth / sys ...）统一注册到 ipcMain。
 * main.js 只需调用 registerAll(ipcMain) 即可挂载全部后端接口，
 * 新增一类路由时在下方引入并调用其 register 即可，main.js 无需改动。
 *
 * 日志说明：
 *   registerAll 内部通过 withLogging 包装 ipcMain.handle，因此所有模块
 *   （auth / research / studio / resource / collab / workbench / system）
 *   注册的通道都会自动输出「收到请求 → 返回结果 → 耗时」日志，
 *   无需在几十个 handler 里逐个手写 console.log，方便统一排查链路问题。
 *   敏感字段（password 等）在打印前会脱敏为 ***。
 */
const authRoutes = require('./auth')
const sysRoutes = require('./sys')
const researchRoutes = require('./research')
const studioRoutes = require('./studio')
const resourceRoutes = require('./resource')
const collabRoutes = require('./collab')
const workbenchRoutes = require('./workbench')
const systemRoutes = require('./system')
const searchRoutes = require('./search')

// 敏感字段脱敏：递归替换密码类字段，避免日志泄露明文密码
function sanitize(value) {
  if (value == null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(sanitize)
  const out = {}
  for (const k of Object.keys(value)) {
    if (/password|pwd/i.test(k)) out[k] = '***'
    else out[k] = sanitize(value[k])
  }
  return out
}

// 包装 ipcMain：拦截 handle 注册，给每个通道包一层「请求/响应/耗时」日志
function withLogging(ipcMain) {
  return new Proxy(ipcMain, {
    get(target, prop, receiver) {
      if (prop === 'handle') {
        return (channel, fn) => {
          target.handle(channel, async (event, payload) => {
            const t0 = Date.now()
            console.log(`[IPC→] ${channel}`, sanitize(payload))
            try {
              const res = await fn(event, payload)
              const status = res && res.success === false ? 'FAIL' : 'OK'
              console.log(`[IPC←] ${channel} ${status} ${Date.now() - t0}ms`)
              return res
            } catch (err) {
              console.error(`[IPC✗] ${channel} 未预期异常 (${Date.now() - t0}ms)`, err)
              throw err
            }
          })
        }
      }
      return Reflect.get(target, prop, receiver)
    }
  })
}

// 注册全部 IPC 路由（统一走带日志的包装）
function registerAll(ipcMain) {
  const logger = withLogging(ipcMain)
  authRoutes.register(logger) // 认证路由（auth:* 前缀）
  sysRoutes.register(logger) // 系统 / 数据库路由（sys:* 前缀）
  researchRoutes.register(logger) // 科研管理（research:* 前缀）
  studioRoutes.register(logger) // 工作室事务（studio:* 前缀）
  resourceRoutes.register(logger) // 资源中心（resource:* 前缀）
  collabRoutes.register(logger) // 协同办公（collab:* 前缀）
  workbenchRoutes.register(logger) // 工作台（workbench:* 前缀）
  systemRoutes.register(logger) // 系统 / 个人（system:* 前缀）
  searchRoutes.register(logger) // 全局搜索（search:* 前缀）
}

module.exports = { registerAll }
