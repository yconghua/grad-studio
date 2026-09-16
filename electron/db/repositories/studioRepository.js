/**
 * 工作室事务模块仓库（Repository Layer）—— 对应工作室事务导航下 7 张业务表
 *
 * 每张表通过 crudFactory 生成带「字段白名单」的通用 CRUD 实例（安全约定见 crudFactory）。
 * 「成员管理」直接复用 user 表（见 userRepository），此处不重复建模。
 */
const { createCrudRepo } = require('./crudFactory')

// 工位
const seatRepo = createCrudRepo('seat', {
  writable: ['name', 'location', 'owner_id', 'status', 'remark']
})

// 设备
const deviceRepo = createCrudRepo('device', {
  writable: [
    'name', 'code', 'category', 'model', 'location', 'status',
    'purchase_date', 'keeper_id', 'remark'
  ]
})

// 物品 / 设备借用
const borrowRecordRepo = createCrudRepo('borrow_record', {
  writable: [
    'item_name', 'device_id', 'borrower_id', 'purpose', 'borrow_date',
    'expect_return_date', 'return_date', 'status', 'remark', 'created_by'
  ]
})

// 考勤记录
const attendanceRepo = createCrudRepo('attendance', {
  writable: [
    'user_id', 'attendance_date', 'status', 'check_in_time',
    'check_out_time', 'remark', 'created_by'
  ]
})

// 卫生值日 / 值班排班
const dutyRepo = createCrudRepo('duty', {
  writable: ['type', 'duty_date', 'user_id', 'content', 'status', 'created_by']
})

// 规章制度
const regulationRepo = createCrudRepo('regulation', {
  writable: ['title', 'content', 'category', 'status', 'publish_date', 'publisher_id']
})

// 入组离组申请
const joinLeaveRepo = createCrudRepo('join_leave', {
  writable: [
    'user_id', 'type', 'reason', 'status', 'apply_date',
    'handler_id', 'handle_time', 'handle_remark'
  ]
})

module.exports = {
  seatRepo,
  deviceRepo,
  borrowRecordRepo,
  attendanceRepo,
  dutyRepo,
  regulationRepo,
  joinLeaveRepo
}
