/**
 * 课题组管理员导航配置（独立于其他角色，四个角色各自维护一份）
 * key 仅作标识，path 即路由地址，title 为菜单显示名。
 */
export const GROUP_ADMIN_NAV = [
  { key: 'group-admin-dashboard', path: '/group-admin/dashboard', title: '工作台' },
  { key: 'group-admin-group', path: '/group-admin/group', title: '课题组设置' },
  { key: 'group-admin-members', path: '/group-admin/members', title: '课题组成员' },
  { key: 'group-admin-notices', path: '/group-admin/notices', title: '本组公告管理' },
  { key: 'group-admin-meetings', path: '/group-admin/meetings', title: '本组会议管理' }
]

// 登录后跳转的工作台
export const GROUP_ADMIN_HOME = '/group-admin/dashboard'
