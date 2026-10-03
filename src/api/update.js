// 应用更新接口：检查更新 / 下载 / 安装 / 状态查询 / 事件订阅
export function checkUpdate() {
  return window.api.update.check()
}
export function downloadUpdate() {
  return window.api.update.download()
}
export function installUpdate() {
  return window.api.update.install()
}
export function getUpdateState() {
  return window.api.update.getState()
}
// 订阅主进程更新事件推送（检查/下载/安装进度）；返回取消订阅函数
export function onUpdateEvent(cb) {
  return window.api.update.onEvent(cb)
}
