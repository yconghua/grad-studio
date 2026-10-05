/**
 * 学生导航配置（独立于其他角色，四个角色各自维护一份）
 * key 仅作标识，path 即路由地址，title 为菜单显示名。
 */
export const STUDENT_NAV = [
  { key: 'student-dashboard', path: '/student/dashboard', title: '工作台', icon: 'DashboardOutlined' },
  { key: 'student-notifications', path: '/student/notifications', title: '通知中心', icon: 'BellOutlined' },
  { key: 'student-notices', path: '/student/notices', title: '课题组公告', icon: 'NotificationOutlined' },
  { key: 'student-meetings', path: '/student/meetings', title: '会议记录', icon: 'CalendarOutlined' },
  { key: 'student-tasks', path: '/student/tasks', title: '我的任务', icon: 'CheckSquareOutlined' },
  { key: 'student-notes', path: '/student/notes', title: '我的笔记', icon: 'EditOutlined' },
  { key: 'student-report', path: '/student/report', title: '我的周报', icon: 'FileTextOutlined' },
  { key: 'student-chat', path: '/student/chat', title: '聊天', icon: 'MessageOutlined' }
]

// 登录后跳转的工作台
export const STUDENT_HOME = '/student/dashboard'
