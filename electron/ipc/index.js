/**
 * 路由层聚合入口（IPC Layer）
 *
 * 把所有按前缀拆分的路由模块统一注册到 ipcMain。
 * main.js 只需调用 registerAll(ipcMain) 即可挂载全部后端接口，
 * 新增一类路由时在下方引入并调用其 register 即可，main.js 无需改动。
 *
 * 已注册模块：
 *   auth           认证与用户管理（auth:*）
 *   sys            系统与数据库连接（sys:*）
 *   profile        用户档案（profile:*）
 *   group          课题组管理（group:*）
 *   member         组成员管理（member:*）
 *   students       导师学生关系（students:*）
 *   notice         课题组公告（notice:*）
 *   degree         学位节点与记录（degree:*）
 *   meeting        组会（meeting:*）
 *   meeting-report 组会汇报（meeting-report:*）
 *   subject        课题与成员（subject:*）
 *   task           任务与进展（task:*）
 *   research-log   科研日志（research-log:*）
 *   weekly         周报（weekly:*）
 *   achievement    科研成果与论文（achievement:* / paper:*）
 *   literature     文献与笔记（literature:* / literature-note:*）
 *   archive        科研档案（archive:*）
 *   knowledge      知识库与文件（knowledge:*）
 *   group-setting  课题组配置（group-setting:*）
 *   system-param   系统参数（system-param:*）
 *   operation-log  操作日志（operation-log:*）
 *   message        站内消息（message:*）
 *   chat           聊天（chat:*）
 *
 * 日志说明：
 *   registerAll 内部通过 withLogging 包装 ipcMain.handle，因此所有模块
 *   注册的通道都会自动输出「收到请求 → 返回结果 → 耗时」日志，
 *   无需在几十个 handler 里逐个手写 console.log，方便统一排查链路问题。
 *   敏感字段（password 等）在打印前会脱敏为 ***。
 */
const authRoutes = require('./auth')
const sysRoutes = require('./sys')
const profileRoutes = require('./profile')
const groupRoutes = require('./group')
const memberRoutes = require('./member')
const studentsRoutes = require('./students')
const noticeRoutes = require('./notice')
const degreeRoutes = require('./degree')
const meetingRoutes = require('./meeting')
const meetingReportRoutes = require('./meetingReport')
const subjectRoutes = require('./subject')
const taskRoutes = require('./task')
const researchLogRoutes = require('./researchLog')
const weeklyRoutes = require('./weekly')
const achievementRoutes = require('./achievement')
const literatureRoutes = require('./literature')
const archiveRoutes = require('./archive')
const knowledgeRoutes = require('./knowledge')
const groupSettingRoutes = require('./groupSetting')
const systemParamRoutes = require('./systemParam')
const operationLogRoutes = require('./operationLog')
const messageRoutes = require('./message')
const chatRoutes = require('./chat')
const overviewRoutes = require('./overview')
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
  authRoutes.register(logger)
  sysRoutes.register(logger)
  profileRoutes.register(logger)
  groupRoutes.register(logger)
  memberRoutes.register(logger)
  studentsRoutes.register(logger)
  noticeRoutes.register(logger)
  degreeRoutes.register(logger)
  meetingRoutes.register(logger)
  meetingReportRoutes.register(logger)
  subjectRoutes.register(logger)
  taskRoutes.register(logger)
  researchLogRoutes.register(logger)
  weeklyRoutes.register(logger)
  achievementRoutes.register(logger)
  literatureRoutes.register(logger)
  archiveRoutes.register(logger)
  knowledgeRoutes.register(logger)
  groupSettingRoutes.register(logger)
  systemParamRoutes.register(logger)
  operationLogRoutes.register(logger)
  messageRoutes.register(logger)
  chatRoutes.register(logger)
  overviewRoutes.register(logger)
  searchRoutes.register(logger)
}

module.exports = { registerAll }
