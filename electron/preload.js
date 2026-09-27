/**
 * 预加载脚本
 *
 * 在主进程与渲染层之间架桥：通过 contextBridge 把「认证 / 系统」的 API
 * 暴露到 window.api，渲染层拿不到 ipcRenderer 本体，安全性更高。
 *
 * 仅暴露平台基础设施通道：
 *   auth    认证与用户管理（auth:*）
 *   sys     系统与数据库连接（sys:*）
 * 新业务模块的 IPC 通道待数据库与接口设计后按模块补充。
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
    pickAttachment: createInvoke('sys:pick-attachment'),
    openAttachment: createInvoke('sys:open-attachment')
  }
})
