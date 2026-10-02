/**
 * 导师导航配置（独立于其他角色，四个角色各自维护一份）
 * key 仅作标识，path 即路由地址，title 为菜单显示名。
 */
export const MENTOR_NAV = [
  { key: 'mentor-dashboard', path: '/mentor/dashboard', title: '工作台' },
  { key: 'mentor-notifications', path: '/mentor/notifications', title: '通知中心' },
  { key: 'mentor-students', path: '/mentor/students', title: '我的学生' },
  { key: 'mentor-notices', path: '/mentor/notices', title: '课题组公告' },
  { key: 'mentor-meetings', path: '/mentor/meetings', title: '会议记录' },
  { key: 'mentor-tasks', path: '/mentor/tasks', title: '任务' },
  { key: 'mentor-chat', path: '/mentor/chat', title: '聊天' }
]

// 登录后跳转的工作台
export const MENTOR_HOME = '/mentor/dashboard'
