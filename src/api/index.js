// 对 preload 暴露的 window.api 做一层薄封装，便于组件调用。
// 若需要，可在此统一处理错误 / loading。
//
// 保留两组接口（平台基础设施，新业务接口待数据库与 IPC 设计后按模块补充）：
//   auth    认证与用户管理（登录 / 会话 / 改密 / 账号管理）
//   sys     系统与数据库连接（连接管理 / 版本信息 / 导出 / 附件等）

// ===== 认证与用户管理 =====
export function login(username, password) {
  return window.api.auth.login({ username, password })
}

export function logout() {
  return window.api.auth.logout()
}

export function getCurrentUser() {
  return window.api.auth.getCurrentUser()
}

export function changePassword(username, oldPassword, newPassword) {
  return window.api.auth.changePassword({ username, oldPassword, newPassword })
}

// 用户管理（超级管理员：平台账号；课题组管理员：本组成员）
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

// 批量新增用户
export function batchCreateUsers(users) {
  return window.api.auth.batchCreateUsers({ users })
}

export function updateUser(payload) {
  return window.api.auth.updateUser(payload)
}

// 读取当前登录用户自己的档案（当前用户表仅含登录必需字段）
export function getMyProfile() {
  return window.api.auth.getMyProfile()
}

export function deleteUser(id) {
  return window.api.auth.deleteUser({ id })
}

// ===== 系统与数据库连接（平台基础设施） =====
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

// 清理本地缓存（Electron 会话 / 磁盘缓存）
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

// 程序文件所在目录
export function getAppPath() {
  return window.api.sys.appPath()
}

export function openAppDir() {
  return window.api.sys.openAppDir()
}

// 导出当前库为 SQL 备份文件
export function exportDatabase() {
  return window.api.sys.exportDb()
}

// 打开开发者控制台（DevTools）
export function openDevTools() {
  return window.api.sys.openDevTools()
}

// 手动检查更新（GitHub Releases）
export function checkForUpdates() {
  return window.api.sys.checkForUpdates()
}

// 选择附件文件（弹出文件对话框）
export function pickAttachment() {
  return window.api.sys.pickAttachment()
}

// 用系统默认程序打开附件
export function openAttachment(path) {
  return window.api.sys.openAttachment({ path })
}

// 数据库连接管理（清单 / 切换 / 新增 / 删除）
export function getDbConnections() {
  return window.api.sys.dbConnections()
}

export function switchDb(id) {
  return window.api.sys.switchDb({ id })
}

export function addDb(payload) {
  return window.api.sys.addDb(payload)
}

export function deleteDb(id) {
  return window.api.sys.deleteDb({ id })
}
