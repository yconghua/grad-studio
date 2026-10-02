// 前后端共享常量（渲染层薄壳）
//
// 真实定义在根目录 shared/constants.js（单一事实来源，主进程直接 require）；
// 这里只做再导出，不重复定义任何值，让渲染层拥有友好的相对导入路径（@/config/constants）。
//
// 关键：用 default import 取出 CJS module.exports，再具名导出。
// 不要写 `export { ROLE_ADMIN } from '...cjs'` —— esbuild 在 dev（unbundled）
// 单独转换 CJS 文件时只会合成 `export default`，不会合成具名导出，会报
// "does not provide an export named 'ROLE_ADMIN'"。default import 是跨
// dev / build / bundle 都稳定工作的 CJS 互操作写法。
import sharedConstants from '../../shared/constants.js'

// ===== 权限角色（四类） =====
export const ROLE_SUPER_ADMIN = sharedConstants.ROLE_SUPER_ADMIN
export const ROLE_GROUP_ADMIN = sharedConstants.ROLE_GROUP_ADMIN
export const ROLE_MENTOR = sharedConstants.ROLE_MENTOR
export const ROLE_STUDENT = sharedConstants.ROLE_STUDENT

// ===== 账号状态 =====
export const ACCOUNT_STATUS_ENABLED = sharedConstants.ACCOUNT_STATUS_ENABLED
export const ACCOUNT_STATUS_DISABLED = sharedConstants.ACCOUNT_STATUS_DISABLED

// ===== 任务状态 / 优先级 =====
export const TASK_STATUS_TODO = sharedConstants.TASK_STATUS_TODO
export const TASK_STATUS_DOING = sharedConstants.TASK_STATUS_DOING
export const TASK_STATUS_REVIEW = sharedConstants.TASK_STATUS_REVIEW
export const TASK_STATUS_DONE = sharedConstants.TASK_STATUS_DONE
export const TASK_STATUS_CANCELED = sharedConstants.TASK_STATUS_CANCELED
export const TASK_PRIORITY_LOW = sharedConstants.TASK_PRIORITY_LOW
export const TASK_PRIORITY_MEDIUM = sharedConstants.TASK_PRIORITY_MEDIUM
export const TASK_PRIORITY_HIGH = sharedConstants.TASK_PRIORITY_HIGH
export const TASK_PRIORITY_URGENT = sharedConstants.TASK_PRIORITY_URGENT

// ===== 角色默认密码 / 密码策略 =====
export const DEFAULT_PASSWORD_BY_ROLE = sharedConstants.DEFAULT_PASSWORD_BY_ROLE
export const PASSWORD_MIN_LENGTH = sharedConstants.PASSWORD_MIN_LENGTH
export const BCRYPT_ROUNDS = sharedConstants.BCRYPT_ROUNDS
export const DEFAULT_DB_PORT = sharedConstants.DEFAULT_DB_PORT
export const CONNECTION_LIMIT = sharedConstants.CONNECTION_LIMIT
