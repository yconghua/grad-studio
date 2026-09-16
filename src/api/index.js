// 对 preload 暴露的 window.api 做一层薄封装，便于组件调用。
// 若需要，可在此统一处理错误 / loading。

export function login(username, password) {
  // 拼成单个对象再传，匹配 preload 工厂「每方法至多一个 payload 对象」的约定
  return window.api.auth.login({ username, password })
}

export function logout() {
  return window.api.auth.logout()
}

export function getCurrentUser() {
  return window.api.auth.getCurrentUser()
}

export function changePassword(username, oldPassword, newPassword) {
  // 拼成单个对象再传，匹配 preload 工厂「每方法至多一个 payload 对象」的约定
  return window.api.auth.changePassword({ username, oldPassword, newPassword })
}

// 用户管理
export function listUsers() {
  return window.api.auth.listUsers()
}

// 成员列表（轻量，供下拉选人）
export function listMembers() {
  return window.api.auth.listMembers()
}

export function createUser(payload) {
  return window.api.auth.createUser(payload)
}

export function updateUser(payload) {
  return window.api.auth.updateUser(payload)
}

// 读取当前登录用户自己的完整档案
export function getMyProfile() {
  return window.api.auth.getMyProfile()
}

// 更新当前登录用户自己的档案（个人主页 → 学术档案 / 个人设置）
export function updateMyProfile(payload) {
  return window.api.auth.updateProfile(payload)
}

export function deleteUser(id) {
  // 拼成单个对象 { id } 再传，匹配 preload 工厂「每方法至多一个 payload 对象」的约定
  return window.api.auth.deleteUser({ id })
}

// 系统管理（系统名称 / 版本号 / 数据库信息）
export function getSysInfo() {
  return window.api.sys.info()
}

export function getDbInfo() {
  return window.api.sys.dbInfo()
}

// 查看数据表（当前库所有表 + 字段 + 行数）
export function getTablesInfo() {
  return window.api.sys.tablesInfo()
}

// 清理本地缓存（Electron 会话 / 磁盘缓存；localStorage 由前端自行处理）
export function clearCache() {
  return window.api.sys.clearCache()
}

// 用户数据目录（路径展示 + 在系统文件管理器中打开）
export function getUserDataPath() {
  return window.api.sys.userDataPath()
}

export function openUserDataDir() {
  return window.api.sys.openUserDataDir()
}

// 程序文件所在目录（路径展示 + 在系统文件管理器中打开）
export function getAppPath() {
  return window.api.sys.appPath()
}

export function openAppDir() {
  return window.api.sys.openAppDir()
}

// 导出当前库为 SQL 备份文件（弹出保存对话框，由主进程完成）
export function exportDatabase() {
  return window.api.sys.exportDb()
}

// 打开开发者控制台（DevTools）：独立窗口弹出，查看日志 / 网络请求与调试
export function openDevTools() {
  return window.api.sys.openDevTools()
}

// 手动检查更新（GitHub Releases）：返回当前版本 / 最新版本 / 是否有更新 / 变更说明
export function checkForUpdates() {
  return window.api.sys.checkForUpdates()
}

// 数据库连接管理（清单 / 切换 / 新增 / 删除）
export function getDbConnections() {
  return window.api.sys.dbConnections()
}

export function switchDb(id) {
  // 拼成单个对象 { id } 再传，匹配 preload 工厂「每方法至多一个 payload 对象」的约定
  return window.api.sys.switchDb({ id })
}

export function addDb(payload) {
  return window.api.sys.addDb(payload)
}

export function deleteDb(id) {
  // 拼成单个对象 { id } 再传，匹配 preload 工厂「每方法至多一个 payload 对象」的约定
  return window.api.sys.deleteDb({ id })
}

// ===== 六大业务模块 API（薄封装 window.api，便于组件统一调用） =====

// 生成某资源的「标准 CRUD 五件套」封装（group=模块名，name=资源名，对应 preload 暴露结构）
function makeCrud(group, name) {
  return {
    list: (filters) => window.api[group][name].list(filters),
    get: (id) => window.api[group][name].get({ id }),
    create: (data) => window.api[group][name].create(data),
    update: (id, data) => window.api[group][name].update({ id, ...data }),
    remove: (id) => window.api[group][name].remove({ id })
  }
}

// 科研管理：项目 / 论文 / 专利 / 科研日志 / 成果 / 经费
export const research = {
  project: makeCrud('research', 'project'),
  paper: makeCrud('research', 'paper'),
  patent: makeCrud('research', 'patent'),
  log: makeCrud('research', 'log'),
  achievement: makeCrud('research', 'achievement'),
  fund: makeCrud('research', 'fund')
}

// 工作室事务：工位 / 设备 / 借用 / 考勤 / 排班 / 制度 / 入组离组
export const studio = {
  seat: makeCrud('studio', 'seat'),
  device: makeCrud('studio', 'device'),
  borrow: makeCrud('studio', 'borrow'),
  attendance: makeCrud('studio', 'attendance'),
  duty: makeCrud('studio', 'duty'),
  regulation: makeCrud('studio', 'regulation'),
  joinLeave: makeCrud('studio', 'joinLeave'),
  returnBorrow: (id) => window.api.studio.returnBorrow({ id }),
  reviewJoinLeave: (id, approved, remark) => window.api.studio.reviewJoinLeave({ id, approved, remark })
}

// 资源中心：统一资源 / 链接 / 下载计数
export const resource = {
  item: makeCrud('resource', 'item'),
  link: makeCrud('resource', 'link'),
  download: (id) => window.api.resource.download({ id })
}

// 协同办公：组会 / 活动 / 任务 / 讨论区 / 审批
export const collab = {
  meeting: makeCrud('collab', 'meeting'),
  activity: makeCrud('collab', 'activity'),
  task: makeCrud('collab', 'task'),
  post: makeCrud('collab', 'post'),
  approval: makeCrud('collab', 'approval'),
  signup: (activityId) => window.api.collab.signup({ activityId }),
  cancelSignup: (activityId) => window.api.collab.cancelSignup({ activityId }),
  signupList: (activityId) => window.api.collab.signupList({ activityId }),
  viewPost: (id) => window.api.collab.viewPost({ id }),
  reply: (postId, content, parentId) => window.api.collab.reply({ postId, content, parentId }),
  replyList: (postId) => window.api.collab.replyList({ postId }),
  reviewApproval: (id, approved, remark) => window.api.collab.reviewApproval({ id, approved, remark })
}

// 工作台：待办 / 日程 / 公告
export const workbench = {
  todo: makeCrud('workbench', 'todo'),
  schedule: makeCrud('workbench', 'schedule'),
  notice: makeCrud('workbench', 'notice'),
  completeTodo: (id) => window.api.workbench.completeTodo({ id }),
  publishNotice: (id) => window.api.workbench.publishNotice({ id })
}

// 系统 / 个人：参数 / 操作日志 / 消息中心
export const system = {
  param: makeCrud('system', 'param'),
  getParam: (key) => window.api.system.getParam({ key }),
  setParam: (key, value, description) => window.api.system.setParam({ key, value, description }),
  listLogs: (filters) => window.api.system.listLogs(filters || {}),
  sendMessage: (payload) => window.api.system.sendMessage(payload),
  myMessages: (filters) => window.api.system.myMessages(filters || {}),
  unreadCount: () => window.api.system.unreadCount(),
  markRead: (id) => window.api.system.markRead({ id })
}
