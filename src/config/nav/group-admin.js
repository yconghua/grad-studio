/**
 * 课题组管理员导航配置（独立于其他角色，四个角色各自维护一份）
 * key 仅作标识，path 即路由地址，title 为菜单显示名。
 */
export const GROUP_ADMIN_NAV = [
  { key: 'group-admin-dashboard', path: '/group-admin/dashboard', title: '工作台', icon: 'DashboardOutlined' },
  { key: 'group-admin-notifications', path: '/group-admin/notifications', title: '通知中心', icon: 'BellOutlined' },
  { key: 'group-admin-group', path: '/group-admin/group', title: '课题组设置', icon: 'ApartmentOutlined' },
  { key: 'group-admin-members', path: '/group-admin/members', title: '课题组成员', icon: 'TeamOutlined' },
  { key: 'group-admin-academic', path: '/group-admin/academic', title: '本组学业档案管理', icon: 'FileDoneOutlined' },
  { key: 'group-admin-achievements', path: '/group-admin/achievements', title: '本组科研成果管理', icon: 'TrophyOutlined' },
  { key: 'group-admin-notices', path: '/group-admin/notices', title: '本组公告管理', icon: 'NotificationOutlined' },
  { key: 'group-admin-meetings', path: '/group-admin/meetings', title: '本组会议管理', icon: 'CalendarOutlined' },
  { key: 'group-admin-tasks', path: '/group-admin/tasks', title: '本组任务管理', icon: 'CheckSquareOutlined' },
  { key: 'group-admin-todo-overview', path: '/group-admin/todo-overview', title: '待办总览', icon: 'ScheduleOutlined' },
  { key: 'group-admin-report', path: '/group-admin/report', title: '组内周报', icon: 'FileTextOutlined' },
  { key: 'group-admin-chat', path: '/group-admin/chat', title: '聊天', icon: 'MessageOutlined' }
]

// 登录后跳转的工作台
export const GROUP_ADMIN_HOME = '/group-admin/dashboard'
