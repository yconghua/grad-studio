/**
 * 导师导航配置（独立于其他角色，四个角色各自维护一份）
 * key 仅作标识，path 即路由地址，title 为菜单显示名。
 */
export const MENTOR_NAV = [
  { key: 'mentor-dashboard', path: '/mentor/dashboard', title: '工作台', icon: 'DashboardOutlined' },
  { key: 'mentor-notifications', path: '/mentor/notifications', title: '通知中心', icon: 'BellOutlined' },
  { key: 'mentor-notices', path: '/mentor/notices', title: '课题组公告', icon: 'NotificationOutlined' },
  { key: 'mentor-students', path: '/mentor/students', title: '我的学生', icon: 'UserOutlined' },
  { key: 'mentor-academic', path: '/mentor/academic', title: '学生学业档案', icon: 'FileDoneOutlined' },
  { key: 'mentor-achievements', path: '/mentor/achievements', title: '学生科研成果', icon: 'TrophyOutlined' },
  { key: 'mentor-meetings', path: '/mentor/meetings', title: '会议记录', icon: 'CalendarOutlined' },
  { key: 'mentor-tasks', path: '/mentor/tasks', title: '任务', icon: 'CheckSquareOutlined' },
  { key: 'mentor-todo', path: '/mentor/todo', title: '我的待办', icon: 'ScheduleOutlined' },
  { key: 'mentor-report', path: '/mentor/report', title: '周报批阅', icon: 'FileTextOutlined' },
  { key: 'mentor-chat', path: '/mentor/chat', title: '聊天', icon: 'MessageOutlined' }
]

// 登录后跳转的工作台
export const MENTOR_HOME = '/mentor/dashboard'
