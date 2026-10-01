/**
 * 学生导航配置（独立于其他角色，四个角色各自维护一份）
 * key 仅作标识，path 即路由地址，title 为菜单显示名。
 */
export const STUDENT_NAV = [
  { key: 'student-dashboard', path: '/student/dashboard', title: '工作台' }
]

// 登录后跳转的工作台
export const STUDENT_HOME = '/student/dashboard'
