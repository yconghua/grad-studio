/**
 * 工作室事务服务（Service Layer）—— 工位 / 设备 / 借用 / 考勤 / 排班 / 制度 / 入组离组
 *
 * 除「物品借用」「入组离组」有额外流转（归还、审核）外，其余均为标准 CRUD。
 * 「成员管理」复用 authService（user 表），不在本服务建模。
 */
const {
  seatRepo,
  deviceRepo,
  borrowRecordRepo,
  attendanceRepo,
  dutyRepo,
  regulationRepo,
  joinLeaveRepo
} = require('../db/repositories/studioRepository')
const { createCrudService } = require('./crudService')
const permission = require('./permission')
const logService = require('./logService')
const systemService = require('./systemService')
const {
  BORROW_STATUS_RETURNED,
  JOIN_LEAVE_STATUS_APPROVED,
  JOIN_LEAVE_STATUS_REJECTED
} = require('../../shared/constants')

// 当前日期字符串（YYYY-MM-DD），用于 DATE 类型字段，规避 mysql2 严格模式下 DATE 列收时间串报错
function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

const studio = {
  // 工位：管理类写操作
  seat: createCrudService(seatRepo, { label: '工位', write: 'manager' }),
  // 设备：管理类写操作
  device: createCrudService(deviceRepo, { label: '设备', write: 'manager' }),
  // 物品借用：成员可登记（借用人 borrower_id 由前端选，登记人 created_by 后端回填）
  borrowRecord: createCrudService(borrowRecordRepo, { label: '借用', write: 'member', creatorField: 'created_by' }),
  // 考勤：管理类写操作（导师记录）
  attendance: createCrudService(attendanceRepo, { label: '考勤', write: 'manager', creatorField: 'created_by' }),
  // 卫生排班：管理类写操作
  duty: createCrudService(dutyRepo, { label: '排班', write: 'manager', creatorField: 'created_by' }),
  // 规章制度：管理类写操作（发布人回填当前用户）
  regulation: createCrudService(regulationRepo, { label: '制度', write: 'manager', creatorField: 'publisher_id' }),
  // 入组离组：成员发起申请（申请人=当前用户），审核走下方 reviewJoinLeave
  joinLeave: createCrudService(joinLeaveRepo, { label: '入组离组申请', write: 'member', creatorField: 'user_id' }),

  /**
   * 归还物品 / 设备：把借用记录置为「已归还」并写归还日期。
   * 借用人本人或管理角色均可操作。
   */
  async returnBorrow(id) {
    if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
    if (id === null || id === undefined) return { success: false, message: '缺少记录标识' }
    try {
      const exist = await borrowRecordRepo.get(id)
      if (!exist) return { success: false, message: '借用记录不存在' }
      if (exist.status === BORROW_STATUS_RETURNED) return { success: false, message: '该记录已归还' }
      // 借用人本人或管理角色可归还；否则禁止
      const me = permission.currentUserId()
      const isManager = permission.isManager()
      if (exist.borrower_id !== me && !isManager) return { success: false, message: '无权限：只能归还自己的借用' }
      await borrowRecordRepo.update(id, { status: BORROW_STATUS_RETURNED, return_date: todayStr() })
      logService.record('update', 'borrow_record', id, { action: 'return' })
      return { success: true, message: '已归还' }
    } catch (err) {
      console.error('[borrowRecord.return] 数据库异常:', err)
      return { success: false, message: '归还失败' }
    }
  },

  /**
   * 审核入组离组申请：仅导师 / 管理员可审。
   * @param {number} id 申请 id
   * @param {boolean} approved 是否通过
   * @param {string} remark 审核意见
   */
  async reviewJoinLeave(id, approved, remark) {
    if (!permission.isManager()) return { success: false, message: '无权限：仅导师或管理员可审核' }
    if (id === null || id === undefined) return { success: false, message: '缺少申请标识' }
    try {
      const exist = await joinLeaveRepo.get(id)
      if (!exist) return { success: false, message: '申请不存在' }
      if (exist.status !== 'pending') return { success: false, message: '该申请已处理，不可重复审核' }
      await joinLeaveRepo.update(id, {
        status: approved ? JOIN_LEAVE_STATUS_APPROVED : JOIN_LEAVE_STATUS_REJECTED,
        handler_id: permission.currentUserId(),
        handle_time: new Date(),
        handle_remark: remark || ''
      })
      logService.record('update', 'join_leave', id, { approved })
      // 审核结果自动通知申请人（站内消息 + 桌面通知按接收人偏好过滤）
      try {
        await systemService.notify({
          receiver_id: exist.user_id,
          sender_id: permission.currentUserId(),
          title: approved ? '入组/离组申请已通过' : '入组/离组申请已驳回',
          content: `你的${exist.type === 'leave' ? '离组' : '入组'}申请「${exist.reason || '（无说明）'}」已${approved ? '通过' : '驳回'}。${remark ? `审核意见：${remark}` : ''}`,
          type: 'join_leave',
          biz_type: 'join_leave',
          biz_id: id
        })
      } catch (e) {
        console.error('[joinLeave.review] 写通知失败:', e)
      }
      return { success: true, message: approved ? '已通过' : '已驳回' }
    } catch (err) {
      console.error('[joinLeave.review] 数据库异常:', err)
      return { success: false, message: '审核失败' }
    }
  }
}

// 仅管理员可写守卫（工位 / 设备）：导师 / 学生均不可新增、编辑、删除，仅可查看
function wrapAdminWrite(service, label) {
  const guard = () => {
    if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
    if (!permission.isAdmin()) return { success: false, message: `无权限：仅管理员可操作${label}` }
    return null
  }
  const _create = service.create
  const _update = service.update
  const _remove = service.remove
  service.create = async (p) => {
    const denied = guard()
    if (denied) return denied
    return _create(p)
  }
  service.update = async (id, p) => {
    const denied = guard()
    if (denied) return denied
    return _update(id, p)
  }
  service.remove = async (id) => {
    const denied = guard()
    if (denied) return denied
    return _remove(id)
  }
  return service
}

wrapAdminWrite(studio.seat, '工位')
wrapAdminWrite(studio.device, '设备')

// 物品借用列表：管理员看全部；其他角色（导师/学生）只看自己借的
const _borrowList = studio.borrowRecord.list
studio.borrowRecord.list = async (filters = {}) => {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isAdmin()) {
    filters.borrower_id = permission.currentUserId()
  }
  return _borrowList(filters)
}

// ========== P0 权限收紧：借用 / 入组离组 归属校验（非管理员只能操作自己的） ==========

// 借用记录更新：仅借用人本人 / 登记人本人 / 管理员
const _borrowUpdate = studio.borrowRecord.update
studio.borrowRecord.update = async (id, payload) => {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (id === null || id === undefined) return { success: false, message: '缺少借用标识' }
  try {
    const row = await borrowRecordRepo.get(id)
    if (!row) return { success: false, message: '借用记录不存在' }
    const me = permission.currentUserId()
    if (!permission.isAdmin() && Number(row.borrower_id) !== Number(me) && Number(row.created_by) !== Number(me)) {
      return { success: false, message: '无权限：只能修改自己的借用记录' }
    }
  } catch (e) {
    console.error('[borrowRecord.update] 校验失败:', e)
    return { success: false, message: '更新失败' }
  }
  return _borrowUpdate(id, payload)
}

// 借用记录删除：仅借用人本人 / 登记人本人 / 管理员
const _borrowRemove = studio.borrowRecord.remove
studio.borrowRecord.remove = async (id) => {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (id === null || id === undefined) return { success: false, message: '缺少借用标识' }
  try {
    const row = await borrowRecordRepo.get(id)
    if (!row) return { success: false, message: '借用记录不存在' }
    const me = permission.currentUserId()
    if (!permission.isAdmin() && Number(row.borrower_id) !== Number(me) && Number(row.created_by) !== Number(me)) {
      return { success: false, message: '无权限：只能删除自己的借用记录' }
    }
  } catch (e) {
    console.error('[borrowRecord.remove] 校验失败:', e)
    return { success: false, message: '删除失败' }
  }
  return _borrowRemove(id)
}

// 入组离组列表：学生只看自己的申请；导师 / 管理员看全部（导师要审核）
const _joinLeaveList = studio.joinLeave.list
studio.joinLeave.list = async (filters = {}) => {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (!permission.isManager()) {
    filters.user_id = permission.currentUserId()
  }
  return _joinLeaveList(filters)
}

// 入组离组更新：仅申请人本人或管理员
const _joinLeaveUpdate = studio.joinLeave.update
studio.joinLeave.update = async (id, payload) => {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (id === null || id === undefined) return { success: false, message: '缺少申请标识' }
  try {
    const row = await joinLeaveRepo.get(id)
    if (!row) return { success: false, message: '申请不存在' }
    if (!permission.isAdmin() && Number(row.user_id) !== Number(permission.currentUserId())) {
      return { success: false, message: '无权限：只能修改自己的申请' }
    }
  } catch (e) {
    console.error('[joinLeave.update] 校验失败:', e)
    return { success: false, message: '更新失败' }
  }
  return _joinLeaveUpdate(id, payload)
}

// 入组离组撤销（删除）：仅申请人本人或管理员（导师审核走 reviewJoinLeave）
const _joinLeaveRemove = studio.joinLeave.remove
studio.joinLeave.remove = async (id) => {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (id === null || id === undefined) return { success: false, message: '缺少申请标识' }
  try {
    const row = await joinLeaveRepo.get(id)
    if (!row) return { success: false, message: '申请不存在' }
    if (!permission.isAdmin() && Number(row.user_id) !== Number(permission.currentUserId())) {
      return { success: false, message: '无权限：只能撤销自己的申请' }
    }
  } catch (e) {
    console.error('[joinLeave.remove] 校验失败:', e)
    return { success: false, message: '删除失败' }
  }
  return _joinLeaveRemove(id)
}

module.exports = studio
