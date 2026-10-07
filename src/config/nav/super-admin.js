/**
 * 超级管理员导航配置（独立于其他角色，四个角色各自维护一份）
 * key 仅作标识，path 即路由地址，title 为菜单显示名。
 */
export const SUPER_ADMIN_NAV = [
  { key: 'admin-dashboard', path: '/admin/dashboard', title: '工作台', icon: 'DashboardOutlined' },
  { key: 'admin-notifications', path: '/admin/notifications', title: '通知中心', icon: 'BellOutlined' },
  { key: 'admin-users', path: '/admin/users', title: '用户管理', icon: 'TeamOutlined' },
  { key: 'admin-academic', path: '/admin/academic', title: '学业档案管理', icon: 'FileDoneOutlined' },
  { key: 'admin-achievements', path: '/admin/achievements', title: '科研成果管理', icon: 'TrophyOutlined' },
  { key: 'admin-groups', path: '/admin/groups', title: '课题组设置', icon: 'ApartmentOutlined' },
  { key: 'admin-notices', path: '/admin/notices', title: '课题组公告管理', icon: 'NotificationOutlined' },
  { key: 'admin-meetings', path: '/admin/meetings', title: '会议记录管理', icon: 'CalendarOutlined' },
  { key: 'admin-task-overview', path: '/admin/task-overview', title: '任务总览', icon: 'CheckSquareOutlined' },
  { key: 'admin-report', path: '/admin/report', title: '周报统计', icon: 'FileTextOutlined' },
  { key: 'admin-system', path: '/admin/system', title: '系统配置', icon: 'SettingOutlined' },
  { key: 'admin-chat', path: '/admin/chat', title: '聊天', icon: 'MessageOutlined' }
]

// 登录后跳转的工作台
export const SUPER_ADMIN_HOME = '/admin/dashboard'
