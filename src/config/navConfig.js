// 导航配置（单一数据源：左侧一级大导航 + 二级小导航 + 个人主页导航）
//
// - navGroups：左侧导航。每个一级大导航（group）包含若干二级小导航（children）。
//   一级大导航 key 作为路由父路径段（如 workbench → /workbench），
//   二级小导航 key 作为子路径段（如 overview → /workbench/overview）。
// - profileNavItems：个人主页（右上角入口）内部的导航项，路径为 /profile/<key>。
// - roles 权限字段：一级导航 / 二级导航均可选填，缺省表示「所有角色可见」；
//   填写后仅列出的角色可见。二级导航未填时继承所属一级导航的 roles。
//   角色取值见 shared/constants.js（ROLE_STUDENT / ROLE_MENTOR / ROLE_ADMIN）。
//
// 想调整菜单，只改本文件即可；页面组件在 router/index.js 中统一指向占位页，
// 后续接入真实页面时再按 key 映射对应组件。

import { ROLE_ADMIN, ROLE_MENTOR, ROLE_STUDENT } from './constants'

// 左侧一级大导航 + 二级小导航
export const navGroups = [
  {
    key: 'workbench',
    title: '工作台',
    children: [
      { key: 'todo', title: '待办事项' },
      { key: 'schedule', title: '日程安排' },
      { key: 'notice', title: '通知公告' },
      { key: 'shortcuts', title: '快捷入口' }
    ]
  },
  {
    key: 'research',
    title: '科研管理',
    children: [
      { key: 'project', title: '项目管理' },
      { key: 'paper', title: '论文著作' },
      { key: 'patent', title: '专利软著' },
      { key: 'subject', title: '课题申报' },
      { key: 'log', title: '科研日志' },
      { key: 'achievement', title: '成果登记' },
      { key: 'graduation', title: '毕业进度' },
      { key: 'fund', title: '经费管理', roles: [ROLE_MENTOR, ROLE_ADMIN] }
    ]
  },
  {
    key: 'studio',
    title: '工作室事务',
    children: [
      { key: 'member', title: '成员管理', roles: [ROLE_MENTOR, ROLE_ADMIN] },
      { key: 'seat', title: '工位管理', roles: [ROLE_MENTOR, ROLE_ADMIN] },
      { key: 'device', title: '设备管理' },
      { key: 'attendance', title: '考勤值班' },
      { key: 'duty', title: '卫生排班' },
      { key: 'regulation', title: '规章制度' },
      { key: 'join-leave', title: '入组离组', roles: [ROLE_MENTOR, ROLE_ADMIN] },
      { key: 'borrow', title: '物品借用' }
    ]
  },
  {
    key: 'resource',
    title: '资源中心',
    children: [
      { key: 'doc', title: '文档库' },
      { key: 'dataset', title: '数据集' },
      { key: 'code', title: '代码库' },
      { key: 'tool', title: '软件工具' },
      { key: 'template', title: '模板中心' },
      { key: 'drive', title: '共享网盘' },
      { key: 'link', title: '常用链接' }
    ]
  },
  {
    key: 'collaboration',
    title: '协同办公',
    children: [
      { key: 'weekly-report', title: '周报管理' },
      { key: 'meeting', title: '组会管理' },
      { key: 'activity', title: '活动报名' },
      { key: 'task', title: '任务协作' },
      { key: 'forum', title: '讨论区' },
      { key: 'approval', title: '审批中心' }
    ]
  },
  {
    key: 'report',
    title: '统计报表',
    roles: [ROLE_MENTOR, ROLE_ADMIN],
    children: [
      { key: 'achievement-stat', title: '成果统计' },
      { key: 'attendance-stat', title: '考勤统计' },
      { key: 'task-stat', title: '任务统计' },
      { key: 'device-stat', title: '设备使用' },
      { key: 'activity-stat', title: '活跃度' },
      { key: 'export', title: '报表导出' }
    ]
  },
  {
    key: 'system',
    title: '系统设置',
    roles: [ROLE_ADMIN],
    children: [
      { key: 'user', title: '用户管理' },
      { key: 'audit', title: '日志审计' },
      { key: 'backup', title: '数据备份' },
      { key: 'param', title: '系统参数' },
      { key: 'update', title: '关于系统' }
    ]
  }
]

// 个人主页（右上角入口）内部的导航项
export const profileNavItems = [
  { key: 'overview', title: '主页概览' },
  { key: 'academic', title: '学术档案' },
  { key: 'my-project', title: '我的项目' },
  { key: 'my-achievement', title: '我的成果' },
  { key: 'my-task', title: '我的任务' },
  { key: 'my-schedule', title: '我的日程' },
  { key: 'message', title: '消息中心' },
  { key: 'setting', title: '个人设置' }
]

// 一级导航可见角色：未设置时返回 null（表示所有角色可见）
export function groupRoles(group) {
  return group.roles || null
}

// 二级导航实际可见角色：子项未指定时继承所属一级导航的 roles；仍无则 null（所有角色可见）
export function childRoles(group, child) {
  return child.roles || group.roles || null
}

// 判断某项（roles 数组或 null）对指定角色是否可见
export function isRoleAllowed(roles, role) {
  if (!roles || !Array.isArray(roles) || roles.length === 0) return true
  return roles.includes(role)
}

// 一级导航的默认落地路径：跳转到该组第一个二级导航
export function groupDefaultPath(group) {
  const first = group.children && group.children[0]
  return first ? `/${group.key}/${first.key}` : `/${group.key}`
}

// 默认首页路径：第一个一级导航的默认落地路径
export const defaultNavPath = '/workbench'
