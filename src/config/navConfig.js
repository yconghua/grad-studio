// 导航配置（单一数据源：左侧菜单 + 角色权限数组 + Ant Design Vue 图标名）
//
// 权限模型：
//   系统侧边导航采用「动态权限渲染」机制，共四类角色：
//     super_admin 超级管理员（平台运维） / group_admin 课题组管理员 / mentor 导师 / student 学生
//   每个菜单项绑定独立「角色权限数组」roles，前端遍历 navItems 按当前登录角色过滤渲染；
//   后端接口层同时做角色鉴权，防止通过直接访问路由越权查看数据（前后端双重保障）。
//
// 菜单排布原则：先通知、后业务，高频在前、低频在后。
//   - 课题组公告紧跟工作台（组管 / 导师 / 学生进入系统第一眼即可看到组内重要通知）；
//   - 超级管理员为平台运维角色，仅展示平台级管控菜单，不参与课题组内业务。
//
// 图标说明：icon 字段为 Ant Design Vue 图标名（字符串），渲染层按名解析为图标组件；
//   依赖 @ant-design/icons-vue 安装后自动生效，未安装时布局组件回退显示占位符。

import {
  ROLE_SUPER_ADMIN,
  ROLE_GROUP_ADMIN,
  ROLE_MENTOR,
  ROLE_STUDENT
} from './constants'

/**
 * 左侧菜单（平铺一级菜单，数组顺序即渲染顺序）。
 * roles：该项对哪些角色可见；null / 缺省 = 全部四类角色可见。
 * 各角色过滤后的菜单顺序与角色描述完全一致：
 *   - 超级管理员：工作台 / 用户管理 / 课题组管理 / 系统配置 / 系统操作日志 / 帮助文档
 *   - 课题组管理员：工作台 / 课题组公告 / 成员管理 / 学位节点管理 / 组会管理 / 课题管理 / 任务管理 / 科研成果 / 课题组知识库 / 课题组设置
 *   - 导师：工作台 / 课题组公告 / 我的学生 / 学位节点管理 / 组会管理 / 课题管理 / 任务管理 / 科研成果 / 课题组知识库
 *   - 学生：工作台 / 课题组公告 / 组会管理 / 科研记录 / 课题与任务 / 科研成果 / 文献与笔记 / 科研档案 / 课题组知识库 / AI科研助手
 */
export const navItems = [
  // ===== 全角色通用（高频前置） =====
  { key: 'workbench', title: '工作台', icon: 'DashboardOutlined', roles: null },
  // 课题组公告：组管 / 导师 / 学生可见（超管为平台运维角色，不参与组内业务）；
  // 组管拥有新增/编辑/删除/置顶，导师与学生仅查看（前端按角色控制操作按钮）
  { key: 'notice', title: '课题组公告', icon: 'NotificationOutlined', roles: [ROLE_GROUP_ADMIN, ROLE_MENTOR, ROLE_STUDENT] },

  // ===== 课题组管理员专属 =====
  { key: 'member', title: '成员管理', icon: 'TeamOutlined', roles: [ROLE_GROUP_ADMIN] },
  { key: 'settings', title: '课题组设置', icon: 'SettingOutlined', roles: [ROLE_GROUP_ADMIN] },

  // ===== 导师专属 =====
  { key: 'students', title: '我的学生', icon: 'UserSwitchOutlined', roles: [ROLE_MENTOR] },

  // ===== 课题组管理员 + 导师（组内管理角色） =====
  { key: 'degree', title: '学位节点管理', icon: 'ScheduleOutlined', roles: [ROLE_GROUP_ADMIN, ROLE_MENTOR] },
  { key: 'subject', title: '课题管理', icon: 'ExperimentOutlined', roles: [ROLE_GROUP_ADMIN, ROLE_MENTOR] },
  { key: 'task', title: '任务管理', icon: 'CheckSquareOutlined', roles: [ROLE_GROUP_ADMIN, ROLE_MENTOR] },

  // ===== 学生专属 =====
  { key: 'research-record', title: '科研记录', icon: 'EditOutlined', roles: [ROLE_STUDENT] },
  { key: 'my-work', title: '课题与任务', icon: 'ProjectOutlined', roles: [ROLE_STUDENT] },
  { key: 'literature', title: '文献与笔记', icon: 'ReadOutlined', roles: [ROLE_STUDENT] },
  { key: 'archive', title: '科研档案', icon: 'FolderOpenOutlined', roles: [ROLE_STUDENT] },
  { key: 'ai-assistant', title: 'AI科研助手', icon: 'RobotOutlined', roles: [ROLE_STUDENT] },

  // ===== 组管 / 导师 / 学生（组内业务，超管不参与） =====
  { key: 'meeting', title: '组会管理', icon: 'CalendarOutlined', roles: [ROLE_GROUP_ADMIN, ROLE_MENTOR, ROLE_STUDENT] },
  { key: 'achievement', title: '科研成果', icon: 'TrophyOutlined', roles: [ROLE_GROUP_ADMIN, ROLE_MENTOR, ROLE_STUDENT] },
  { key: 'knowledge', title: '课题组知识库', icon: 'BookOutlined', roles: [ROLE_GROUP_ADMIN, ROLE_MENTOR, ROLE_STUDENT] },

  // ===== 超级管理员专属（平台运维，无课题组内业务） =====
  { key: 'platform-users', title: '用户管理', icon: 'UserOutlined', roles: [ROLE_SUPER_ADMIN] },
  { key: 'platform-groups', title: '课题组管理', icon: 'ApartmentOutlined', roles: [ROLE_SUPER_ADMIN] },
  { key: 'platform-overview', title: '数据总览', icon: 'DatabaseOutlined', roles: [ROLE_SUPER_ADMIN] },
  { key: 'platform-config', title: '系统配置', icon: 'ControlOutlined', roles: [ROLE_SUPER_ADMIN] },
  { key: 'platform-logs', title: '系统操作日志', icon: 'FileSearchOutlined', roles: [ROLE_SUPER_ADMIN] },
  { key: 'platform-help', title: '帮助文档', icon: 'QuestionCircleOutlined', roles: [ROLE_SUPER_ADMIN] }
]

// 判断某项（roles 数组或 null）对指定角色是否可见
export function isRoleAllowed(roles, role) {
  if (!roles || !Array.isArray(roles) || roles.length === 0) return true
  return roles.includes(role)
}

// 当前角色可见的菜单（按 navItems 数组顺序过滤）
export function visibleNavItems(role) {
  return navItems.filter((item) => isRoleAllowed(item.roles, role))
}

// 默认首页路径（工作台：所有角色均有）
export const defaultNavPath = '/workbench'
