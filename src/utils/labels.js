/**
 * 通用显示标签：角色 / 状态 / 性别文案映射
 */
import { ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN, ROLE_MENTOR, ROLE_STUDENT } from '../config/constants'

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
  0: '禁用'
}

export function statusText(status) {
  return status === 0 ? '禁用' : '启用'
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
