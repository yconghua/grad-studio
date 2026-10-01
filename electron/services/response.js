/**
 * 统一响应结构（Service / IPC 层共用）
 *
 * 需求约定的统一响应：
 *   成功：{ code: 0, message: 'success', data: {} }
 *   失败：{ code: 400/401/403/404/500, message: 错误说明, data: null }
 * 为兼容渲染层既有判断习惯，额外附带 success 布尔字段（success === true 表示成功）。
 */

function ok(data) {
  return { success: true, code: 0, message: 'success', data: data === undefined ? null : data }
}

function fail(message, code = 400) {
  return { success: false, code, message, data: null }
}

module.exports = { ok, fail }
