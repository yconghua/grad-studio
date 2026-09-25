/**
 * 系统 / 个人模块仓库（Repository Layer）—— 对应系统设置（日志审计 / 系统参数）与个人主页（消息中心）
 *
 * 每张表通过 crudFactory 生成带「字段白名单」的通用 CRUD 实例（安全约定见 crudFactory）。
 * operation_log 只追加、不更新不删除（见 schemas/27_operation_log.sql），因此 Service 层只用 create 与 list。
 */
const { createCrudRepo } = require('./crudFactory')

// 操作日志（审计追溯）
const operationLogRepo = createCrudRepo('operation_log', {
  writable: ['user_id', 'username', 'action', 'target_table', 'target_id', 'detail']
})

// 系统参数
const systemParamRepo = createCrudRepo('system_param', {
  writable: ['param_key', 'param_value', 'description']
})

// 消息中心
const messageRepo = createCrudRepo('message', {
  writable: ['receiver_id', 'sender_id', 'title', 'content', 'type', 'biz_type', 'biz_id', 'status', 'read_at']
})

// 用户通知偏好（订阅规则：哪类事件收站内 / 桌面通知）
const notificationPrefRepo = createCrudRepo('user_notification_pref', {
  writable: ['user_id', 'event_type', 'inapp_enabled', 'desktop_enabled']
})

module.exports = { operationLogRepo, systemParamRepo, messageRepo, notificationPrefRepo }
