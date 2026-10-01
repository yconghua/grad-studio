/**
 * 渲染层 API 统一出口：按业务域拆分到同目录各模块，这里只做聚合再导出。
 *
 * 页面统一从本文件引入（import { listUsers } from '@/api'），
 * 各域内部实现按 auth / user / group / member / system / db 维护。
 *
 * 统一约定：
 *   - 后端统一返回 { success, code, message, data }（成功时 success=true、code=0）；
 *   - 本模块所有函数原样返回该响应对象（success 判断由页面自行处理）。
 */
export * from './auth.js'
export * from './user.js'
export * from './group.js'
export * from './member.js'
export * from './notice.js'
export * from './meeting.js'
export * from './system.js'
export * from './db.js'
