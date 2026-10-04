/**
 * IPC 处理器封装：把服务层异常统一转成统一响应结构
 *
 * 成功 → { success: true, code: 0, message: 'success', data }
 * ApiError → { success: false, code, message }
 * 其他异常 → { success: false, code: 500, message: '服务器内部错误' }
 */
const ApiError = require('../services/apiError')
const { ok, fail } = require('../services/response')

function handler(fn) {
  return async (event, payload) => {
    try {
      return ok(await fn(event, payload))
    } catch (err) {
      if (err instanceof ApiError) {
        return fail(err.message, err.code, err.data)
      }
      console.error('[IPC] 未预期异常:', err)
      return fail('服务器内部错误，请稍后重试', 500)
    }
  }
}

module.exports = { handler }
