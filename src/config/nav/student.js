/**
 * 学生导航配置（独立于其他角色，四个角色各自维护一份）
 * key 仅作标识，path 即路由地址，title 为菜单显示名。
 */
export const STUDENT_NAV = [
  { key: 'student-dashboard', path: '/student/dashboard', title: '工作台' },
  { key: 'student-notes', path: '/student/notes', title: '我的笔记' },
  { key: 'student-notifications', path: '/student/notifications', title: '通知中心' },
  { key: 'student-notices', path: '/student/notices', title: '课题组公告' },
  { key: 'student-meetings', path: '/student/meetings', title: '会议记录' },
  { key: 'student-tasks', path: '/student/tasks', title: '我的任务' },
  { key: 'student-chat', path: '/student/chat', title: '聊天' }
]

// 登录后跳转的工作台
export const STUDENT_HOME = '/student/dashboard'
