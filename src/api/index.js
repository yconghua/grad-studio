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

export function createUser(payload) {
  return window.api.auth.createUser(payload)
}

export function updateUser(payload) {
  return window.api.auth.updateUser(payload)
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
