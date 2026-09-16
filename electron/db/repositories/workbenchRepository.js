/**
 * 工作台模块仓库（Repository Layer）—— 对应工作台导航下 3 张业务表
 *
 * 每张表通过 crudFactory 生成带「字段白名单」的通用 CRUD 实例（安全约定见 crudFactory）。
 */
const { createCrudRepo } = require('./crudFactory')

// 个人待办
const todoRepo = createCrudRepo('todo', {
  writable: ['title', 'description', 'user_id', 'priority', 'status', 'due_date', 'done_at']
})

// 日程安排
const scheduleRepo = createCrudRepo('schedule', {
  writable: [
    'title', 'type', 'user_id', 'start_time', 'end_time', 'location', 'description'
  ]
})

// 通知公告
const noticeRepo = createCrudRepo('notice', {
  writable: ['title', 'content', 'type', 'status', 'publisher_id', 'published_at']
})

module.exports = { todoRepo, scheduleRepo, noticeRepo }
