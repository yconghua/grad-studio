// 系统配置与公共系统接口：系统信息、数据库信息、系统参数、系统简介
export function getSystemInfo() {
  return window.api.system.info()
}
export function getDatabaseInfo() {
  return window.api.system.database()
}
export function listParams(params = {}) {
  return window.api.system.paramsList(params)
}
export function createParam(data = {}) {
  return window.api.system.paramsCreate(data)
}
export function updateParam(id, data = {}) {
  return window.api.system.paramsUpdate({ id, data })
}
export function deleteParam(id) {
  return window.api.system.paramsDelete({ id })
}
export function getIntroduction() {
  return window.api.system.introduction()
}
