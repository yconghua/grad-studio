/**
 * 预加载脚本
 *
 * 在主进程与渲染层之间架桥：通过 contextBridge 把全部业务模块的 API
 * 暴露到 window.api，渲染层拿不到 ipcRenderer 本体，安全性更高。
 *
 * 已暴露模块：
 *   auth           认证与用户管理
 *   sys            系统与数据库连接
 *   profile        用户档案
 *   group          课题组管理
 *   member         组成员管理
 *   students       导师学生关系
 *   notice         课题组公告
 *   degree         学位节点与记录
 *   meeting        组会
 *   meetingReport  组会汇报
 *   subject        课题与成员
 *   task           任务与进展
 *   researchLog    科研日志
 *   weekly         周报
 *   achievement    科研成果
 *   paper          论文投稿跟踪
 *   literature     文献库
 *   literatureNote 文献笔记
 *   archive        科研档案
 *   knowledge      知识库
 *   groupSetting   课题组配置
 *   systemParam    系统参数
 *   operationLog   操作日志
 *   message        站内消息
 *   chat           聊天（chat:*，含 chat:push 实时推送订阅）
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

// 工厂：把「某个 IPC 通道」固化成一个函数，调用时把唯一 payload 透传给主进程。
const createInvoke = (channel) => async (payload) => {
  const t0 = Date.now()
  console.log(`[API→] ${channel}`, sanitize(payload))
  try {
    const res = await ipcRenderer.invoke(channel, payload)
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
    changePassword: createInvoke('auth:change-password'),
    listUsers: createInvoke('auth:list-users'),
    listMembers: createInvoke('auth:list-members'),
    createUser: createInvoke('auth:create-user'),
    batchCreateUsers: createInvoke('auth:batch-create-users'),
    updateUser: createInvoke('auth:update-user'),
    getMyProfile: createInvoke('auth:get-my-profile'),
    deleteUser: createInvoke('auth:delete-user')
  },
  // 系统相关（对应 ipc/sys.js，通道前缀 sys:*）
  sys: {
    info: createInvoke('sys:info'),
    getPublicInfo: createInvoke('sys:get-public-info'),
    dbInfo: createInvoke('sys:db-info'),
    tablesInfo: createInvoke('sys:tables-info'),
    dbConnections: createInvoke('sys:db-connections'),
    switchDb: createInvoke('sys:switch-db'),
    addDb: createInvoke('sys:add-db'),
    deleteDb: createInvoke('sys:delete-db'),
    clearCache: createInvoke('sys:clear-cache'),
    userDataPath: createInvoke('sys:user-data-path'),
    openUserDataDir: createInvoke('sys:open-user-data-dir'),
    appPath: createInvoke('sys:app-path'),
    openAppDir: createInvoke('sys:open-app-dir'),
    exportDb: createInvoke('sys:export-db'),
    openDevTools: createInvoke('sys:open-devtools'),
    checkForUpdates: createInvoke('sys:check-update'),
    openExternal: createInvoke('sys:open-external'),
    pickAttachment: createInvoke('sys:pick-attachment'),
    openAttachment: createInvoke('sys:open-attachment')
  },
  // 用户档案（profile:*）
  profile: {
    get: createInvoke('profile:get'),
    update: createInvoke('profile:update')
  },
  // 课题组管理（group:*）
  group: {
    list: createInvoke('group:list'),
    listMine: createInvoke('group:listMine'),
    create: createInvoke('group:create'),
    update: createInvoke('group:update'),
    remove: createInvoke('group:remove')
  },
  // 组成员管理（member:*）
  member: {
    list: createInvoke('member:list'),
    add: createInvoke('member:add'),
    update: createInvoke('member:update'),
    remove: createInvoke('member:remove')
  },
  // 导师学生关系（students:*）
  students: {
    list: createInvoke('students:list'),
    listGroupStudents: createInvoke('students:list-group-students'),
    listAvailable: createInvoke('students:list-available'),
    myMentor: createInvoke('students:my-mentor'),
    bind: createInvoke('students:bind'),
    unbind: createInvoke('students:unbind')
  },
  // 课题组公告（notice:*）
  notice: {
    list: createInvoke('notice:list'),
    unreadCount: createInvoke('notice:unread-count'),
    markRead: createInvoke('notice:mark-read'),
    create: createInvoke('notice:create'),
    update: createInvoke('notice:update'),
    remove: createInvoke('notice:remove')
  },
  // 学位节点与记录（degree:*）
  degree: {
    listNodes: createInvoke('degree:list-nodes'),
    saveNode: createInvoke('degree:save-node'),
    removeNode: createInvoke('degree:remove-node'),
    listRecords: createInvoke('degree:list-records'),
    saveRecord: createInvoke('degree:save-record')
  },
  // 组会（meeting:*）
  meeting: {
    list: createInvoke('meeting:list'),
    create: createInvoke('meeting:create'),
    update: createInvoke('meeting:update'),
    remove: createInvoke('meeting:remove')
  },
  // 组会汇报（meeting-report:*）
  meetingReport: {
    list: createInvoke('meeting-report:list'),
    submit: createInvoke('meeting-report:submit'),
    review: createInvoke('meeting-report:review')
  },
  // 课题与成员（subject:*）
  subject: {
    list: createInvoke('subject:list'),
    create: createInvoke('subject:create'),
    update: createInvoke('subject:update'),
    remove: createInvoke('subject:remove'),
    listMembers: createInvoke('subject:list-members'),
    addMember: createInvoke('subject:add-member'),
    removeMember: createInvoke('subject:remove-member')
  },
  // 任务与进展（task:*）
  task: {
    list: createInvoke('task:list'),
    create: createInvoke('task:create'),
    update: createInvoke('task:update'),
    remove: createInvoke('task:remove'),
    listMine: createInvoke('task:list-mine'),
    progressSubmit: createInvoke('task:progress-submit'),
    listProgress: createInvoke('task:list-progress')
  },
  // 科研日志（research-log:*）
  researchLog: {
    listMine: createInvoke('research-log:list-mine'),
    create: createInvoke('research-log:create'),
    update: createInvoke('research-log:update'),
    remove: createInvoke('research-log:remove')
  },
  // 周报（weekly:*）
  weekly: {
    listMine: createInvoke('weekly:list-mine'),
    create: createInvoke('weekly:create'),
    update: createInvoke('weekly:update'),
    submit: createInvoke('weekly:submit'),
    review: createInvoke('weekly:review'),
    listAll: createInvoke('weekly:list-all')
  },
  // 科研成果（achievement:*）
  achievement: {
    listMine: createInvoke('achievement:list-mine'),
    create: createInvoke('achievement:create'),
    update: createInvoke('achievement:update'),
    remove: createInvoke('achievement:remove'),
    review: createInvoke('achievement:review'),
    listAll: createInvoke('achievement:list-all')
  },
  // 论文投稿跟踪（paper:*）
  paper: {
    list: createInvoke('paper:list'),
    create: createInvoke('paper:create'),
    update: createInvoke('paper:update'),
    remove: createInvoke('paper:remove')
  },
  // 文献库（literature:*）
  literature: {
    listMine: createInvoke('literature:list-mine'),
    create: createInvoke('literature:create'),
    update: createInvoke('literature:update'),
    remove: createInvoke('literature:remove')
  },
  // 文献笔记（literature-note:*）
  literatureNote: {
    list: createInvoke('literature-note:list'),
    create: createInvoke('literature-note:create'),
    update: createInvoke('literature-note:update'),
    remove: createInvoke('literature-note:remove')
  },
  // 科研档案（archive:*）
  archive: {
    list: createInvoke('archive:list'),
    create: createInvoke('archive:create'),
    remove: createInvoke('archive:remove'),
    export: createInvoke('archive:export')
  },
  // 知识库（knowledge:*）
  knowledge: {
    list: createInvoke('knowledge:list'),
    create: createInvoke('knowledge:create'),
    update: createInvoke('knowledge:update'),
    remove: createInvoke('knowledge:remove'),
    listFiles: createInvoke('knowledge:list-files'),
    uploadFile: createInvoke('knowledge:upload-file'),
    removeFile: createInvoke('knowledge:remove-file')
  },
  // 课题组配置（group-setting:*）
  groupSetting: {
    get: createInvoke('group-setting:get'),
    update: createInvoke('group-setting:update')
  },
  // 系统参数（system-param:*）
  systemParam: {
    list: createInvoke('system-param:list'),
    save: createInvoke('system-param:save'),
    remove: createInvoke('system-param:remove')
  },
  // 操作日志（operation-log:*）
  operationLog: {
    list: createInvoke('operation-log:list')
  },
  // 站内消息（message:*）
  message: {
    listMine: createInvoke('message:list-mine'),
    unreadCount: createInvoke('message:unread-count'),
    markRead: createInvoke('message:mark-read'),
    markAllRead: createInvoke('message:mark-all-read')
  },
  // 聊天（chat:*，独立于 message:*；onPush 订阅主进程实时推送）
  chat: {
    listContacts: createInvoke('chat:list-contacts'),
    listConversations: createInvoke('chat:list-conversations'),
    open: createInvoke('chat:open'),
    listMessages: createInvoke('chat:list-messages'),
    send: createInvoke('chat:send'),
    recall: createInvoke('chat:recall'),
    markRead: createInvoke('chat:mark-read'),
    deleteConversation: createInvoke('chat:delete-conversation'),
    search: createInvoke('chat:search'),
    unreadTotal: createInvoke('chat:unread-total'),
    attachmentPreview: createInvoke('chat:attachment-preview'),
    // 订阅主进程推送（chat:push）：返回取消订阅函数
    onPush: (callback) => {
      if (typeof callback !== 'function') return () => {}
      const listener = (_evt, payload) => callback(payload)
      ipcRenderer.on('chat:push', listener)
      return () => ipcRenderer.removeListener('chat:push', listener)
    }
  },
  // 数据总览（overview:*，仅超级管理员）
  overview: {
    groups: createInvoke('overview:groups'),
    groupDetail: createInvoke('overview:group-detail'),
    users: createInvoke('overview:users'),
    userDetail: createInvoke('overview:user-detail'),
    listTables: createInvoke('overview:list-tables'),
    tableData: createInvoke('overview:table-data')
  },
  // 全局搜索（search:*，按角色限定可见范围）
  search: {
    global: createInvoke('search:global')
  }
})
