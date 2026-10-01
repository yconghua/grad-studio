/**
 * 业务异常类型（Service Layer）
 *
 * 业务规则校验失败时抛出，由 IPC 层统一转成 { success:false, code, message } 返回前端。
 * code 与统一响应规范一致：400 参数错误 / 401 未登录 / 403 无权限 / 404 数据不存在 / 500 服务器错误。
 */
class ApiError extends Error {
  constructor(message, code = 400) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

module.exports = ApiError
