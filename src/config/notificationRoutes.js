// 通知类型 → 业务路由映射（前端维护，通知中心/系统通知跳转共用）
// 规则：类型注册表只存类型标识，不存路由；不同角色访问同一业务的路由不同，
// 跳转前用当前登录角色拼出实际路由，登录角色取自会话快照。
import { ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN, ROLE_MENTOR, ROLE_STUDENT } from '../config/constants'

// 各角色下各业务类型的路由表
const ROUTE_TABLE = {
  [ROLE_SUPER_ADMIN]: { notice: '/admin/notices', meeting: '/admin/meetings' },
  [ROLE_GROUP_ADMIN]: { notice: '/group-admin/notices', meeting: '/group-admin/meetings' },
  [ROLE_MENTOR]: { notice: '/mentor/notices', meeting: '/mentor/meetings' },
  [ROLE_STUDENT]: { notice: '/student/notices', meeting: '/student/meetings' }
}

// 角色 → 路由前缀（用于通知中心自身路由兜底）
const ROLE_PREFIX = {
  [ROLE_SUPER_ADMIN]: '/admin',
  [ROLE_GROUP_ADMIN]: '/group-admin',
  [ROLE_MENTOR]: '/mentor',
  [ROLE_STUDENT]: '/student'
}

// 按登录角色取业务路由；角色表无记录时回本角色通知中心
export function pathForBiz(bizType, role) {
  const table = ROUTE_TABLE[role] || {}
  return table[bizType] || `${ROLE_PREFIX[role] || ''}/notifications`
}
