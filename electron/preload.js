/**
 * 预加载脚本
 *
 * 在主进程与渲染层之间架桥：通过 contextBridge 把「认证 / 系统 / 六大业务模块」的 API
 * 暴露到 window.api，渲染层拿不到 ipcRenderer 本体，安全性更高。
 *
 * 调用统一由 createInvoke 工厂封装，消除每个方法重复的箭头函数样板：
 *   - 约定：每个方法至多向主进程发送「一个 payload 对象」（无参方法发送 undefined）；
 *   - 标准 CRUD 资源用 crudApi 一行生成五件套（list / get / create / update / remove）；
 *   - 后续若要统一加日志、错误处理、超时等，只改 createInvoke 一处即可。
 */
const { contextBridge, ipcRenderer } = require('electron')

// 工厂：把「某个 IPC 通道」固化成一个函数，调用时把唯一 payload 透传给主进程。
const createInvoke = (channel) => (payload) => ipcRenderer.invoke(channel, payload)

// 生成某资源的「标准 CRUD 五件套」，通道命名 `<prefix>:<动作>`（与 ipc/crudRouter 一致）
const crudApi = (prefix) => ({
  list: createInvoke(`${prefix}:list`),
  get: createInvoke(`${prefix}:get`),
  create: createInvoke(`${prefix}:create`),
  update: createInvoke(`${prefix}:update`),
  remove: createInvoke(`${prefix}:remove`)
})

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
    updateUser: createInvoke('auth:update-user'),
    getMyProfile: createInvoke('auth:get-my-profile'),
    updateProfile: createInvoke('auth:update-profile'),
    deleteUser: createInvoke('auth:delete-user')
  },
  // 系统相关（对应 ipc/sys.js，通道前缀 sys:*）
  sys: {
    info: createInvoke('sys:info'),
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
    checkForUpdates: createInvoke('sys:check-update')
  },
  // 科研管理（对应 ipc/research.js，通道前缀 research:*）
  research: {
    project: crudApi('research:project'),
    paper: crudApi('research:paper'),
    patent: crudApi('research:patent'),
    log: crudApi('research:log'),
    achievement: crudApi('research:achievement'),
    fund: crudApi('research:fund'),
    milestone: crudApi('research:milestone')
  },
  // 工作室事务（对应 ipc/studio.js，通道前缀 studio:*）
  studio: {
    seat: crudApi('studio:seat'),
    device: crudApi('studio:device'),
    borrow: crudApi('studio:borrow'),
    attendance: crudApi('studio:attendance'),
    duty: crudApi('studio:duty'),
    regulation: crudApi('studio:regulation'),
    joinLeave: crudApi('studio:join-leave'),
    returnBorrow: createInvoke('studio:borrow:return'),
    reviewJoinLeave: createInvoke('studio:join-leave:review')
  },
  // 资源中心（对应 ipc/resource.js，通道前缀 resource:*）
  resource: {
    item: crudApi('resource:item'),
    link: crudApi('resource:link'),
    download: createInvoke('resource:download')
  },
  // 协同办公（对应 ipc/collab.js，通道前缀 collab:*）
  collab: {
    meeting: crudApi('collab:meeting'),
    activity: crudApi('collab:activity'),
    task: crudApi('collab:task'),
    post: crudApi('collab:post'),
    approval: crudApi('collab:approval'),
    weeklyReport: crudApi('collab:weekly-report'),
    meetingAgenda: crudApi('collab:meeting-agenda'),
    meetingRead: crudApi('collab:meeting-read'),
    signup: createInvoke('collab:signup'),
    cancelSignup: createInvoke('collab:signup-cancel'),
    signupList: createInvoke('collab:signup-list'),
    viewPost: createInvoke('collab:post-view'),
    reply: createInvoke('collab:reply'),
    replyList: createInvoke('collab:reply-list'),
    reviewApproval: createInvoke('collab:approval-review'),
    reviewReport: createInvoke('collab:weekly-report-review'),
    reportToTask: createInvoke('collab:weekly-report-to-task'),
    markMeetingRead: createInvoke('collab:meeting-read-mark'),
    meetingReadList: createInvoke('collab:meeting-read-list')
  },
  // 工作台（对应 ipc/workbench.js，通道前缀 workbench:*）
  workbench: {
    todo: crudApi('workbench:todo'),
    schedule: crudApi('workbench:schedule'),
    notice: crudApi('workbench:notice'),
    completeTodo: createInvoke('workbench:todo-complete'),
    publishNotice: createInvoke('workbench:notice-publish')
  },
  // 系统 / 个人（对应 ipc/system.js，通道前缀 system:*）
  system: {
    param: crudApi('system:param'),
    getParam: createInvoke('system:param-get'),
    setParam: createInvoke('system:param-set'),
    listLogs: createInvoke('system:log-list'),
    sendMessage: createInvoke('system:message-send'),
    myMessages: createInvoke('system:message-mine'),
    unreadCount: createInvoke('system:message-unread'),
    markRead: createInvoke('system:message-read')
  }
})
