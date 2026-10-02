/**
 * 路由层聚合入口（IPC Layer）
 *
 * 把所有按前缀拆分的路由模块统一注册到 ipcMain。
 * main.js 只需调用 registerAll(ipcMain) 即可挂载全部后端接口，
 * 新增一类路由时在下方引入并调用其 register 即可，main.js 无需改动。
 *
 * 已注册模块：
 *   auth            认证（登录/登出/当前用户/修改密码）
 *   user            用户管理（user:*，超管）+ 候选人查询
 *   group           课题组与成员（group:* / group-admin:* / mentor:*）
 *   system          系统配置与公共系统接口（system:*）
 *   sys             系统基础设施（sys:*：数据库连接管理 / 附件 / 系统信息）
 *
 * 日志说明：
 *   registerAll 内部通过 withLogging 包装 ipcMain.handle，因此所有模块
 *   注册的通道都会自动输出「收到请求 → 返回结果 → 耗时」日志，
 *   无需在几十个 handler 里逐个手写 console.log。
 *   敏感字段（password 等）在打印前会脱敏为 ***。
 */
const authRoutes = require('./auth')
const userRoutes = require('./user')
const groupRoutes = require('./group')
const noticeRoutes = require('./notice')
const meetingRoutes = require('./meeting')
const chatRoutes = require('./chat')
const notificationRoutes = require('./notification')
const systemRoutes = require('./system')
const sysRoutes = require('./sys')

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
  authRoutes.register(logger)
  userRoutes.register(logger)
  groupRoutes.register(logger)
  noticeRoutes.register(logger)
  meetingRoutes.register(logger)
  chatRoutes.register(logger)
  notificationRoutes.register(logger)
  systemRoutes.register(logger)
  sysRoutes.register(logger)
}

module.exports = { registerAll }
