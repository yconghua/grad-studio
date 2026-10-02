/**
 * 通用显示标签：角色 / 状态 / 性别文案映射
 */
import {
  ROLE_SUPER_ADMIN,
  ROLE_GROUP_ADMIN,
  ROLE_MENTOR,
  ROLE_STUDENT,
  TASK_STATUS_TODO,
  TASK_STATUS_DOING,
  TASK_STATUS_REVIEW,
  TASK_STATUS_DONE,
  TASK_STATUS_CANCELED,
  TASK_PRIORITY_LOW,
  TASK_PRIORITY_MEDIUM,
  TASK_PRIORITY_HIGH,
  TASK_PRIORITY_URGENT
} from '../config/constants'

export const ROLE_TEXT = {
  [ROLE_SUPER_ADMIN]: '超级管理员',
  [ROLE_GROUP_ADMIN]: '课题组管理员',
  [ROLE_MENTOR]: '导师',
  [ROLE_STUDENT]: '学生'
}

export function roleText(role) {
  return ROLE_TEXT[role] || role || '-'
}

export const STATUS_TEXT = {
  1: '启用',
  0: '停用'
}

export function statusText(status) {
  return status === 0 ? '停用' : '启用'
}

export function statusTagClass(status) {
  return status === 0 ? 'tag tag-red' : 'tag tag-green'
}

export const GENDER_TEXT = {
  0: '未知',
  1: '男',
  2: '女'
}

export function genderText(gender) {
  return GENDER_TEXT[gender] || '未知'
}

// ===== 任务状态 =====
export const TASK_STATUS_TEXT = {
  [TASK_STATUS_TODO]: '待办',
  [TASK_STATUS_DOING]: '进行中',
  [TASK_STATUS_REVIEW]: '待验收',
  [TASK_STATUS_DONE]: '已完成',
  [TASK_STATUS_CANCELED]: '已取消'
}

export function taskStatusText(status) {
  return TASK_STATUS_TEXT[status] || '-'
}

export function taskStatusTagClass(status) {
  const map = {
    [TASK_STATUS_TODO]: 'tag tag-gray',
    [TASK_STATUS_DOING]: 'tag tag-blue',
    [TASK_STATUS_REVIEW]: 'tag tag-orange',
    [TASK_STATUS_DONE]: 'tag tag-green',
    [TASK_STATUS_CANCELED]: 'tag tag-red'
  }
  return map[status] || 'tag'
}

// ===== 任务优先级 =====
export const TASK_PRIORITY_TEXT = {
  [TASK_PRIORITY_LOW]: '低',
  [TASK_PRIORITY_MEDIUM]: '中',
  [TASK_PRIORITY_HIGH]: '高',
  [TASK_PRIORITY_URGENT]: '紧急'
}

export function taskPriorityText(priority) {
  return TASK_PRIORITY_TEXT[priority] || '-'
}

export function taskPriorityTagClass(priority) {
  const map = {
    [TASK_PRIORITY_LOW]: 'tag tag-gray',
    [TASK_PRIORITY_MEDIUM]: 'tag tag-blue',
    [TASK_PRIORITY_HIGH]: 'tag tag-orange',
    [TASK_PRIORITY_URGENT]: 'tag tag-red'
  }
  return map[priority] || 'tag'
}
