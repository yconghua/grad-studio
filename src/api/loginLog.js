// 登录日志 API（对应 electron/preload.js loginLog 桥接，通道前缀 login-log:*）
// 仅超级管理员可调用（后端 IPC 权限闸门强制校验）。
export const listLoginLogs = (payload) => window.api.loginLog.list(payload)
export const exportLoginLogs = (payload) => window.api.loginLog.export(payload)
export const getLoginLogRetainDays = () => window.api.loginLog.getRetainDays()
export const setLoginLogRetainDays = (days) => window.api.loginLog.setRetainDays({ days })
