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
 *   notification 通知中心（全平台，含主进程实时推送订阅）        → notification:*
 *   system    系统配置与公共系统接口                           → system:*
 *   sys       系统基础设施：数据库连接管理 / 附件 / 系统信息    → sys:*
 *
 * 调用统一由 createInvoke 工厂封装，消除每个方法重复的箭头函数样板：
 *   - 约定：每个方法至多向主进程发送「一个 payload 对象」（无参方法发送 undefined）。
 */
const { contextBridge, ipcRenderer } = require('electron')

// 敏感字段脱敏：打印 payload 前把密码类字段替换为 ***；二进制类型只打字节数摘要
function sanitize(value) {
  if (value == null || typeof value !== 'object') return value
  if (value instanceof ArrayBuffer) return { __binary: value.byteLength }
  if (ArrayBuffer.isView(value)) return { __binary: value.byteLength }
  if (Array.isArray(value)) return value.map(sanitize)
  const out = {}
  for (const k of Object.keys(value)) {
    if (/password|pwd/i.test(k)) out[k] = '***'
    else out[k] = sanitize(value[k])
  }
  return out
}

// 把渲染层的 Vue 响应式 Proxy / 特殊对象脱壳为结构化克隆可传递的普通对象，
// 否则 ipcRenderer.invoke 会抛 "An object could not be cloned"。
// 二进制类型（ArrayBuffer / TypedArray / DataView）原样保留：Electron 的
// 结构化克隆原生支持直接传输，JSON 序列化会把二进制内容丢掉（变成 {}）。
function toPlain(value) {
  if (value === undefined || value === null) return value
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return value
  if (typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(toPlain)
  const out = {}
  for (const k of Object.keys(value)) out[k] = toPlain(value[k])
  return out
}

// 工厂：把「某个 IPC 通道」固化成一个函数，调用时把唯一 payload 透传给主进程。
// logPayload=false 的通道只打印调用摘要，不打印 payload 全文（如批量导入的行数据）。
// logResult=false 的通道不打印返回结果（如含解密密码的记住我回读）。
const createInvoke = (channel, { logPayload = true, logResult = true } = {}) => async (payload) => {
  const t0 = Date.now()
  if (logPayload) console.log(`[API→] ${channel}`, sanitize(payload))
  else console.log(`[API→] ${channel} (payload 不打印)`)
  try {
    const res = await ipcRenderer.invoke(channel, toPlain(payload))
    const status = res && res.success === false ? 'FAIL' : 'OK'
    if (logResult) console.log(`[API←] ${channel} ${status} ${Date.now() - t0}ms`, res)
    else console.log(`[API←] ${channel} ${status} ${Date.now() - t0}ms`)
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
    getCaptcha: createInvoke('auth:captcha'),
    getScanQr: createInvoke('auth:scan-qr'),
    scanStatus: createInvoke('auth:scan-status'),
    scanCancel: createInvoke('auth:scan-cancel'),
    logout: createInvoke('auth:logout'),
    // 记住我：remember 会经 sanitize 对密码脱敏；remembered 返回含解密密码，不打印结果
    remember: createInvoke('auth:remember'),
    remembered: createInvoke('auth:remembered', { logResult: false }),
    forget: createInvoke('auth:forget'),
    getCurrentUser: createInvoke('auth:get-current-user'),
    changePassword: createInvoke('auth:change-password'),
    switchAccount: createInvoke('auth:switch-account'),
    ticketStatus: createInvoke('auth:ticket-status')
  },
  // 用户管理（对应 ipc/user.js，通道前缀 user:*）
  user: {
    list: createInvoke('user:list'),
    create: createInvoke('user:create'),
    detail: createInvoke('user:detail'),
    getByUsername: createInvoke('user:get-by-username'),
    updateAccount: createInvoke('user:update-account'),
    updateProfile: createInvoke('user:update-profile'),
    updateOwnProfile: createInvoke('user:update-own-profile'),
    resetPassword: createInvoke('user:reset-password'),
    batchStatus: createInvoke('user:batch-status'),
    batchDelete: createInvoke('user:batch-delete'),
    batchCreate: createInvoke('user:batch-create', { logPayload: false }),
    usernames: createInvoke('user:usernames'),
    userNos: createInvoke('user:user-nos'),
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
    get: createInvoke('notice:get'),
    create: createInvoke('notice:create'),
    update: createInvoke('notice:update'),
    remove: createInvoke('notice:delete'),
    top: createInvoke('notice:top'),
    readStats: createInvoke('notice:read-stats'),
    readSelf: createInvoke('notice:read-self'),
    readAll: createInvoke('notice:read-all'),
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
  // 通知中心（对应 ipc/notification.js，通道前缀 notification:*）
  notification: {
    list: createInvoke('notification:list'),
    unreadCount: createInvoke('notification:unread-count'),
    markRead: createInvoke('notification:mark-read'),
    markAllRead: createInvoke('notification:mark-all-read'),
    delete: createInvoke('notification:delete'),
    clearRead: createInvoke('notification:clear-read'),
    listTypes: createInvoke('notification:list-types'),
    // 主进程实时推送订阅（notificationPoller 发现新通知/未读变化时触发）；返回取消订阅函数
    onEvent: (cb) => {
      const listener = (_evt, data) => cb(data)
      ipcRenderer.on('notification:event', listener)
      return () => ipcRenderer.removeListener('notification:event', listener)
    }
  },
  // 全局搜索（对应 ipc/search.js，通道前缀 search:*）
  search: {
    global: createInvoke('search:global')
  },
  // 任务模块（对应 ipc/task.js，通道前缀 task:*）
  task: {
    create: createInvoke('task:create'),
    list: createInvoke('task:list'),
    detail: createInvoke('task:detail'),
    update: createInvoke('task:update'),
    remove: createInvoke('task:delete'),
    restore: createInvoke('task:restore'),
    addParticipants: createInvoke('task:add-participants'),
    removeParticipant: createInvoke('task:remove-participant'),
    participantOptions: createInvoke('task:participant-options'),
    submitProgress: createInvoke('task:submit-progress'),
    complete: createInvoke('task:complete'),
    verify: createInvoke('task:verify'),
    cancel: createInvoke('task:cancel'),
    reopen: createInvoke('task:reopen'),
    dynamics: createInvoke('task:dynamics'),
    stats: createInvoke('task:stats'),
    summary: createInvoke('task:summary')
  },
  // 学生私人笔记（对应 ipc/note.js，通道前缀 note:*）
  note: {
    list: createInvoke('note:list'),
    get: createInvoke('note:get'),
    create: createInvoke('note:create'),
    update: createInvoke('note:update'),
    remove: createInvoke('note:delete'),
    restore: createInvoke('note:restore'),
    purge: createInvoke('note:purge'),
    export: createInvoke('note:export')
  },
  // 周报模块（对应 ipc/report.js，通道前缀 report:*）
  report: {
    myWeek: createInvoke('report:my-week'),
    create: createInvoke('report:create'),
    saveDraft: createInvoke('report:save-draft'),
    submit: createInvoke('report:submit'),
    withdrawSubmit: createInvoke('report:withdraw-submit'),
    listMine: createInvoke('report:list-mine'),
    listToReview: createInvoke('report:list-to-review'),
    review: createInvoke('report:review'),
    unreview: createInvoke('report:unreview'),
    get: createInvoke('report:get'),
    listGroup: createInvoke('report:list-group'),
    addAttachment: createInvoke('report:attachment-add'),
    listAttachments: createInvoke('report:attachment-list'),
    deleteAttachment: createInvoke('report:attachment-delete'),
    downloadAttachment: createInvoke('report:attachment-download'),
    attachmentQuota: createInvoke('report:attachment-quota'),
    listTemplates: createInvoke('report:template-list'),
    saveTemplate: createInvoke('report:template-save'),
    listHolidays: createInvoke('report:holiday-list'),
    upsertHoliday: createInvoke('report:holiday-upsert'),
    removeHoliday: createInvoke('report:holiday-remove'),
    stats: createInvoke('report:stats'),
    remind: createInvoke('report:remind'),
    purge: createInvoke('report:purge'),
    listMeta: createInvoke('report:list-meta')
  },
  // 超管任务总览（对应 ipc/taskOverview.js，通道前缀 task-overview:*）
  taskOverview: {
    list: createInvoke('task-overview:list'),
    detail: createInvoke('task-overview:detail'),
    stats: createInvoke('task-overview:stats')
  },
  // 系统配置与公共系统接口（对应 ipc/system.js，通道前缀 system:*）
  system: {
    info: createInvoke('system:info'),
    database: createInvoke('system:database'),
    paramsList: createInvoke('system:params-list'),
    paramsCreate: createInvoke('system:params-create'),
    paramsUpdate: createInvoke('system:params-update'),
    paramsDelete: createInvoke('system:params-delete'),
    introduction: createInvoke('system:introduction')
  },
  // 应用更新（对应 ipc/update.js，通道前缀 update:*）
  update: {
    check: createInvoke('update:check'),
    download: createInvoke('update:download'),
    install: createInvoke('update:install'),
    getState: createInvoke('update:get-state'),
    // 主进程更新事件推送订阅（检查/下载/安装进度）；返回取消订阅函数
    onEvent: (cb) => {
      const listener = (_evt, data) => cb(data)
      ipcRenderer.on('update:event', listener)
      return () => ipcRenderer.removeListener('update:event', listener)
    }
  },
  // 系统基础设施（对应 ipc/sys.js，通道前缀 sys:*）
  sys: {
    info: createInvoke('sys:info'),
    getPublicInfo: createInvoke('sys:get-public-info'),
    dbInfo: createInvoke('sys:db-info'),
    dbStatus: createInvoke('sys:db-status'),
    tablesInfo: createInvoke('sys:tables-info'),
    dbConnections: createInvoke('sys:db-connections'),
    switchDb: createInvoke('sys:switch-db'),
    addDb: createInvoke('sys:add-db'),
    importDb: createInvoke('sys:import-db'),
    exportDbTemplate: createInvoke('sys:export-db-template'),
    deleteDb: createInvoke('sys:delete-db'),
    updateDb: createInvoke('sys:update-db'),
    exportDb: createInvoke('sys:export-db'),
    pickAttachment: createInvoke('sys:pick-attachment'),
    openAttachment: createInvoke('sys:open-attachment'),
    openDevConsole: createInvoke('sys:open-dev-console'),
    openAppFolder: createInvoke('sys:open-app-folder'),
    openDataFolder: createInvoke('sys:open-data-folder'),
    clearCache: createInvoke('sys:clear-cache'),
    uninstallAvailable: createInvoke('sys:uninstall-available'),
    uninstallApp: createInvoke('sys:uninstall-app'),
    getAutoLaunch: createInvoke('sys:get-auto-launch'),
    setAutoLaunch: createInvoke('sys:set-auto-launch'),
    // 业务数据版本变化订阅（dataVersionService 轮询发现库变动时触发）；返回取消订阅函数
    onDbChanged: (cb) => {
      const listener = () => cb()
      ipcRenderer.on('db:changed', listener)
      return () => ipcRenderer.removeListener('db:changed', listener)
    },
    // 数据库连接状态变化订阅（dbStatusService 探测发现连通/断开时触发）；返回取消订阅函数
    onDbStatusChanged: (cb) => {
      const listener = (_evt, data) => cb(data)
      ipcRenderer.on('db:status-changed', listener)
      return () => ipcRenderer.removeListener('db:status-changed', listener)
    },
    // 托盘菜单点击「数据库：未连接（点击配置）」时触发；返回取消订阅函数
    onTrayOpenDbConfig: (cb) => {
      const listener = () => cb()
      ipcRenderer.on('tray:open-db-config', listener)
      return () => ipcRenderer.removeListener('tray:open-db-config', listener)
    }
  },
  // 窗口控制（对应 ipc/win.js，通道前缀 win:*）：无边框窗口标题栏按钮用
  window: {
    minimize: createInvoke('win:minimize'),
    maximize: createInvoke('win:maximize'),
    isMaximized: createInvoke('win:is-maximized'),
    close: createInvoke('win:close'),
    // 最大化状态变化订阅（主进程 maximize/unmaximize 时触发）；返回取消订阅函数
    onMaximizedChanged: (cb) => {
      const listener = (_evt, data) => cb(data)
      ipcRenderer.on('win:maximized-changed', listener)
      return () => ipcRenderer.removeListener('win:maximized-changed', listener)
    }
  },
  // 日志与诊断（对应 ipc/diag.js，通道前缀 diag:*）：仅超管可用
  diag: {
    info: createInvoke('diag:info'),
    logs: createInvoke('diag:logs'),
    export: createInvoke('diag:export'),
    openFolder: createInvoke('diag:open-folder')
  }
})
