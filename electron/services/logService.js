/**
 * 操作日志服务（Service Layer，独立模块）
 *
 * 把「写入操作日志」抽成独立模块，供 crudService（通用 CRUD 服务）与各业务 Service 复用，
 * 避免 crudService ↔ systemService 之间形成循环依赖。
 *
 * record 为「尽力而为」：写入失败只记控制台，绝不影响主业务流程。
 * operation_log 只追加、不更新不删除（见 schemas/27_operation_log.sql）。
 */
const { operationLogRepo } = require('../db/repositories/systemRepository')
const permission = require('./permission')

/**
 * 记录一条操作日志。
 * @param {string} action 动作（create / update / delete / login / logout 等）
 * @param {string} target_table 目标表名（可空）
 * @param {number} target_id 目标记录 id（可空）
 * @param {object} detail 详情（会 JSON 序列化，可空）
 */
async function record(action, target_table, target_id, detail) {
  try {
    await operationLogRepo.create({
      user_id: permission.currentUserId(),
      username: permission.currentUsername(),
      action,
      target_table: target_table || null,
      target_id: target_id === undefined || target_id === null ? null : target_id,
      detail: detail ? JSON.stringify(detail) : null
    })
  } catch (e) {
    console.error('[logService.record] 写入失败:', e)
  }
}

module.exports = { record }
