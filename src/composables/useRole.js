// 角色判断组合式函数：从本地会话读取当前用户角色，供页面做按钮 / 模块显隐控制
import { useSession } from './useSession'
import { ROLE_ADMIN, ROLE_MENTOR } from '../config/constants'

export function useRole() {
  const { getSessionUser } = useSession()
  const user = getSessionUser()
  const role = user ? user.role : null
  return {
    role,
    // 是否管理员
    isAdmin: role === ROLE_ADMIN,
    // 是否管理角色（导师或管理员）：可执行管理类写操作
    isManager: role === ROLE_ADMIN || role === ROLE_MENTOR
  }
}
