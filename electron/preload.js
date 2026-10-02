/**
 * 预加载脚本
 *
 * 在主进程与渲染层之间架桥：通过 contextBridge 把全部业务模块的 API
 * 暴露到 window.api，渲染层拿不到 ipcRenderer 本体，安全性更高。
 *
 * 已暴露模块（与 electron/ipc/ 下各路由模块一一对应）：
 *   auth      认证（登录 / 登出 / 当前用户 / 修改密码）        → auth:*
 *   user      用户管理（超管）+ 候选人查询                     → user:*
 *   group     课题组管理（超管）                               → group:*
 *   groupAdmin 课题组管理员：本课题组设置与成员管理             → group-admin:*
 *   mentor    导师：我的学生                                   → mentor:*
 *   notice    课题组公告                                       → notice:*
 *   meeting   课题组组会                                       → meeting:*
 *   chat      一对一聊天（全平台，含主进程实时推送订阅）         → chat:*
 *   system    系统配置与公共系统接口                           → system:*
 *   sys       系统基础设施：数据库连接管理 / 附件 / 系统信息    → sys:*
 *
 * 调用统一由 createInvoke 工厂封装，消除每个方法重复的箭头函数样板：
 *   - 约定：每个方法至多向主进程发送「一个 payload 对象」（无参方法发送 undefined）。
 */
const { contextBridge, ipcRenderer } = require('electron')

// 敏感字段脱敏：打印 payload 前把密码类字段替换为 ***
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

// 把渲染层的 Vue 响应式 Proxy / 特殊对象脱壳为结构化克隆可传递的普通对象，
// 否则 ipcRenderer.invoke 会抛 "An object could not be cloned"
function toPlain(value) {
  if (value === undefined || value === null) return value
  return JSON.parse(JSON.stringify(value))
}

// 工厂：把「某个 IPC 通道」固化成一个函数，调用时把唯一 payload 透传给主进程。
// logPayload=false 的通道只打印调用摘要，不打印 payload 全文（如批量导入的行数据）。
const createInvoke = (channel, { logPayload = true } = {}) => async (payload) => {
  const t0 = Date.now()
  if (logPayload) console.log(`[API→] ${channel}`, sanitize(payload))
  else console.log(`[API→] ${channel} (payload 不打印)`)
  try {
    const res = await ipcRenderer.invoke(channel, toPlain(payload))
    const status = res && res.success === false ? 'FAIL' : 'OK'
    console.log(`[API←] ${channel} ${status} ${Date.now() - t0}ms`, res)
    return res
  } catch (err) {
    console.error(`[API✗] ${channel} 调用异常 (${Date.now() - t0}ms)`, err)
    throw err
  }
}

contextBridge.exposeInMainWorld('api', {
  // 认证相关（对应 ipc/auth.js，通道前缀 auth:*）
  auth: {
    login: createInvoke('auth:login'),
    logout: createInvoke('auth:logout'),
    getCurrentUser: createInvoke('auth:get-current-user'),
    changePassword: createInvoke('auth:change-password')
  },
  // 用户管理（对应 ipc/user.js，通道前缀 user:*）
  user: {
    list: createInvoke('user:list'),
    create: createInvoke('user:create'),
    detail: createInvoke('user:detail'),
    updateAccount: createInvoke('user:update-account'),
    updateProfile: createInvoke('user:update-profile'),
    updateOwnProfile: createInvoke('user:update-own-profile'),
    resetPassword: createInvoke('user:reset-password'),
    batchStatus: createInvoke('user:batch-status'),
    batchDelete: createInvoke('user:batch-delete'),
    batchCreate: createInvoke('user:batch-create', { logPayload: false }),
    usernames: createInvoke('user:usernames'),
    downloadCsvTemplate: createInvoke('user:download-csv-template'),
    delete: createInvoke('user:delete'),
    candidates: createInvoke('user:candidates')
  },
  // 课题组管理（对应 ipc/group.js，通道前缀 group:*）
  group: {
    list: createInvoke('group:list'),
    create: createInvoke('group:create'),
    detail: createInvoke('group:detail'),
    update: createInvoke('group:update'),
    delete: createInvoke('group:delete'),
    membersList: createInvoke('group:members-list'),
    membersAdd: createInvoke('group:members-add'),
    memberRemove: createInvoke('group:member-remove'),
    membersBatchRemove: createInvoke('group:members-batch-remove'),
    membersBatchAssignMentor: createInvoke('group:members-batch-assign-mentor'),
    setStudentMentor: createInvoke('group:set-student-mentor'),
    memberStats: createInvoke('group:member-stats')
  },
  // 课题组管理员：本课题组（group-admin:*）
  groupAdmin: {
    getOwn: createInvoke('group-admin:get-own'),
    updateOwn: createInvoke('group-admin:update-own'),
    membersList: createInvoke('group-admin:members-list'),
    membersAdd: createInvoke('group-admin:members-add'),
    memberRemove: createInvoke('group-admin:member-remove'),
    membersBatchRemove: createInvoke('group-admin:members-batch-remove'),
    membersBatchAssignMentor: createInvoke('group-admin:members-batch-assign-mentor'),
    studentsList: createInvoke('group-admin:students-list'),
    setStudentMentor: createInvoke('group-admin:set-student-mentor')
  },
  // 导师：我的学生（mentor:*）
  mentor: {
    studentsList: createInvoke('mentor:students-list')
  },
  // 课题组公告（对应 ipc/notice.js，通道前缀 notice:*）
  notice: {
    list: createInvoke('notice:list'),
    create: createInvoke('notice:create'),
    update: createInvoke('notice:update'),
    remove: createInvoke('notice:delete'),
    top: createInvoke('notice:top'),
    readStats: createInvoke('notice:read-stats'),
    readSelf: createInvoke('notice:read-self'),
    unreadCount: createInvoke('notice:unread-count')
  },
  // 课题组组会（对应 ipc/meeting.js，通道前缀 meeting:*）
  meeting: {
    list: createInvoke('meeting:list'),
    myDrafts: createInvoke('meeting:my-drafts'),
    groupDrafts: createInvoke('meeting:group-drafts'),
    detail: createInvoke('meeting:detail'),
    create: createInvoke('meeting:create'),
    update: createInvoke('meeting:update'),
    publish: createInvoke('meeting:publish'),
    publishAsNotice: createInvoke('meeting:publish-as-notice'),
    remove: createInvoke('meeting:delete'),
    archive: createInvoke('meeting:archive'),
    stats: createInvoke('meeting:stats'),
    memberOptions: createInvoke('meeting:member-options'),
    recent: createInvoke('meeting:recent')
  },
  // 一对一聊天（对应 ipc/chat.js，通道前缀 chat:*）
  chat: {
    openOrCreate: createInvoke('chat:open-or-create'),
    listSessions: createInvoke('chat:list-sessions'),
    getHistory: createInvoke('chat:get-history'),
    getIncrement: createInvoke('chat:get-increment'),
    sendMessage: createInvoke('chat:send-message'),
    markRead: createInvoke('chat:mark-read'),
    unreadCount: createInvoke('chat:unread-count'),
    recallMessage: createInvoke('chat:recall-message'),
    userOptions: createInvoke('chat:user-options'),
    countSessions: createInvoke('chat:count-sessions'),
    // 主进程实时推送订阅（chatPoller 发现新消息/撤回时触发）；返回取消订阅函数
    onEvent: (cb) => {
      const listener = (_evt, data) => cb(data)
      ipcRenderer.on('chat:event', listener)
      return () => ipcRenderer.removeListener('chat:event', listener)
    }
  },
  // 系统配置与公共系统接口（对应 ipc/system.js，通道前缀 system:*）
  system: {
    info: createInvoke('system:info'),
    database: createInvoke('system:database'),
    paramsList: createInvoke('system:params-list'),
    paramsCreate: createInvoke('system:params-create'),
    paramsUpdate: createInvoke('system:params-update'),
    paramsDelete: createInvoke('system:params-delete'),
    introduction: createInvoke('system:introduction'),
    checkUpdate: createInvoke('system:check-update')
  },
  // 系统基础设施（对应 ipc/sys.js，通道前缀 sys:*）
  sys: {
    info: createInvoke('sys:info'),
    getPublicInfo: createInvoke('sys:get-public-info'),
    dbInfo: createInvoke('sys:db-info'),
    tablesInfo: createInvoke('sys:tables-info'),
    dbConnections: createInvoke('sys:db-connections'),
    switchDb: createInvoke('sys:switch-db'),
    addDb: createInvoke('sys:add-db'),
    deleteDb: createInvoke('sys:delete-db'),
    exportDb: createInvoke('sys:export-db'),
    pickAttachment: createInvoke('sys:pick-attachment'),
    openAttachment: createInvoke('sys:open-attachment'),
    openDevConsole: createInvoke('sys:open-dev-console'),
    openAppFolder: createInvoke('sys:open-app-folder'),
    openDataFolder: createInvoke('sys:open-data-folder'),
    clearCache: createInvoke('sys:clear-cache')
  }
})
