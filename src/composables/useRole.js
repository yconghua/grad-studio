// 角色判断组合式函数：从本地会话读取当前用户角色，供页面做按钮 / 模块显隐控制
import { useSession } from './useSession'
import {
  ROLE_SUPER_ADMIN,
  ROLE_GROUP_ADMIN,
  ROLE_MENTOR,
  ROLE_STUDENT
} from '../config/constants'

export function useRole() {
  const { getSessionUser } = useSession()
  const user = getSessionUser()
  const role = user ? user.role : null
  return {
    role,
    // 是否超级管理员（平台运维）
    isSuperAdmin: role === ROLE_SUPER_ADMIN,
    // 是否课题组管理员（组内最高管理角色）
    isGroupAdmin: role === ROLE_GROUP_ADMIN,
    // 是否导师
    isMentor: role === ROLE_MENTOR,
    // 是否学生
    isStudent: role === ROLE_STUDENT,
    // 是否组内管理角色（课题组管理员或导师）：可执行组内管理类写操作
    isManager: role === ROLE_GROUP_ADMIN || role === ROLE_MENTOR,
    // 兼容旧调用：是否管理员（= 超级管理员）
    isAdmin: role === ROLE_SUPER_ADMIN
  }
}
