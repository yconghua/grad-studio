// 日志与诊断（diag:*）：运行时长 / 内存 / 日志查看与导出，仅超管可用
export function getDiagInfo() {
  return window.api.diag.info()
}
export function getDiagLogs(params = {}) {
  return window.api.diag.logs(params)
}
export function exportDiagLog() {
  return window.api.diag.export()
}
export function openDiagFolder() {
  return window.api.diag.openFolder()
}
