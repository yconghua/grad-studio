// 通知类型 → 业务路由映射（前端维护，通知中心/系统通知跳转共用）
// 规则：类型注册表只存类型标识，不存路由；不同角色访问同一业务的路由不同，
// 跳转前用当前登录角色拼出实际路由，登录角色取自会话快照。
import { ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN, ROLE_MENTOR, ROLE_STUDENT } from '../config/constants'

// 各角色下各业务类型的路由表
const ROUTE_TABLE = {
  [ROLE_SUPER_ADMIN]: { notice: '/admin/notices', meeting: '/admin/meetings', task: '/admin/task-overview', report: '/admin/report' },
  [ROLE_GROUP_ADMIN]: { notice: '/group-admin/notices', meeting: '/group-admin/meetings', task: '/group-admin/tasks', report: '/group-admin/report' },
  [ROLE_MENTOR]: { notice: '/mentor/notices', meeting: '/mentor/meetings', task: '/mentor/tasks', report: '/mentor/report' },
  [ROLE_STUDENT]: { notice: '/student/notices', meeting: '/student/meetings', task: '/student/tasks', report: '/student/report' }
}

// 角色 → 路由前缀（用于通知中心自身路由兜底）
const ROLE_PREFIX = {
  [ROLE_SUPER_ADMIN]: '/admin',
  [ROLE_GROUP_ADMIN]: '/group-admin',
  [ROLE_MENTOR]: '/mentor',
  [ROLE_STUDENT]: '/student'
}

// 按登录角色取业务路由；角色表无记录时回本角色通知中心。
// 任务类通知优先跳到任务详情页（pathForBiz(..., bizId)），无 bizId 时回落任务列表。
export function pathForBiz(bizType, role, bizId) {
  const table = ROUTE_TABLE[role] || {}
  if (bizType === 'task' && bizId != null && role !== ROLE_SUPER_ADMIN) {
    const prefix = ROLE_PREFIX[role]
    // 跳任务列表并由列表页按 open 参数自动打开新版详情弹窗（不再跳旧版详情页）
    if (prefix) return `${prefix}/tasks?open=${Number(bizId)}`
  }
  return table[bizType] || `${ROLE_PREFIX[role] || ''}/notifications`
}
