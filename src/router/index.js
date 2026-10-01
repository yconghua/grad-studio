// 应用路由（hash 模式）
//
// 结构：
//   - /login 登录页（含数据库连接管理）
//   - /force-password 首次登录强制修改密码（保留既有机制）
//   - 四个角色各自独立的布局与页面树：
//       /admin        超级管理员（工作台 / 用户管理 / 课题组设置 / 系统配置 / 个人资料 / 设置）
//       /group-admin  课题组管理员（工作台 / 课题组设置 / 课题组成员 / 个人资料 / 设置）
//       /mentor       导师（工作台 / 我的学生 / 个人资料 / 设置）
//       /student      学生（工作台 / 个人资料 / 设置）
//   - 404 兜底
// 守卫逻辑：
//   1. 未登录（无会话或过期）一律回登录页；
//   2. 需强制改密（mustChangePassword）时拦截到 /force-password；
//   3. 角色越权直达时跳回本角色工作台（后端接口另有权限校验，前端守卫仅作体验层）。
import { createRouter, createWebHashHistory } from 'vue-router'
import LoginView from '../pages/auth/LoginView.vue'
import ForcePasswordView from '../pages/auth/ForcePassword.vue'
import SuperAdminLayout from '../layouts/SuperAdminLayout.vue'
import GroupAdminLayout from '../layouts/GroupAdminLayout.vue'
import MentorLayout from '../layouts/MentorLayout.vue'
import StudentLayout from '../layouts/StudentLayout.vue'
import NotFoundView from '../pages/notfound/index.vue'
import { useSession } from '../composables/useSession'
import { ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN, ROLE_MENTOR, ROLE_STUDENT } from '../config/constants'
import { SUPER_ADMIN_HOME } from '../config/nav/super-admin'
import { GROUP_ADMIN_HOME } from '../config/nav/group-admin'
import { MENTOR_HOME } from '../config/nav/mentor'
import { STUDENT_HOME } from '../config/nav/student'

const { getSessionUser, isSessionValid } = useSession()

// 角色 → 登录后工作台
export const ROLE_HOME = {
  [ROLE_SUPER_ADMIN]: SUPER_ADMIN_HOME,
  [ROLE_GROUP_ADMIN]: GROUP_ADMIN_HOME,
  [ROLE_MENTOR]: MENTOR_HOME,
  [ROLE_STUDENT]: STUDENT_HOME
}

const routes = [
  { path: '/login', name: 'login', component: LoginView },
  { path: '/force-password', name: 'force-password', component: ForcePasswordView },
  // ===== 超级管理员 =====
  {
    path: '/admin',
    component: SuperAdminLayout,
    meta: { role: ROLE_SUPER_ADMIN },
    children: [
      { path: 'dashboard', name: 'admin-dashboard', component: () => import('../pages/admin/AdminDashboard.vue'), meta: { title: '工作台' } },
      { path: 'users', name: 'admin-users', component: () => import('../pages/admin/AdminUserList.vue'), meta: { title: '用户管理' } },
      { path: 'users/:id/edit', name: 'admin-user-edit', component: () => import('../pages/admin/AdminUserEdit.vue'), meta: { title: '编辑用户' } },
      { path: 'groups', name: 'admin-groups', component: () => import('../pages/admin/AdminGroupList.vue'), meta: { title: '课题组设置' } },
      { path: 'system', name: 'admin-system', component: () => import('../pages/admin/AdminSystemConfig.vue'), meta: { title: '系统配置' } },
      { path: 'profile', name: 'admin-profile', component: () => import('../pages/admin/AdminProfile.vue'), meta: { title: '个人资料' } },
      { path: 'settings', name: 'admin-settings', component: () => import('../pages/admin/AdminSettings.vue'), meta: { title: '设置' } },
      { path: '', redirect: SUPER_ADMIN_HOME }
    ]
  },
  // ===== 课题组管理员 =====
  {
    path: '/group-admin',
    component: GroupAdminLayout,
    meta: { role: ROLE_GROUP_ADMIN },
    children: [
      { path: 'dashboard', name: 'group-admin-dashboard', component: () => import('../pages/group-admin/GroupAdminDashboard.vue'), meta: { title: '工作台' } },
      { path: 'group', name: 'group-admin-group', component: () => import('../pages/group-admin/GroupAdminGroupSetting.vue'), meta: { title: '课题组设置' } },
      { path: 'members', name: 'group-admin-members', component: () => import('../pages/group-admin/GroupAdminMemberManage.vue'), meta: { title: '课题组成员' } },
      { path: 'profile', name: 'group-admin-profile', component: () => import('../pages/group-admin/GroupAdminProfile.vue'), meta: { title: '个人资料' } },
      { path: 'settings', name: 'group-admin-settings', component: () => import('../pages/group-admin/GroupAdminSettings.vue'), meta: { title: '设置' } },
      { path: '', redirect: GROUP_ADMIN_HOME }
    ]
  },
  // ===== 导师 =====
  {
    path: '/mentor',
    component: MentorLayout,
    meta: { role: ROLE_MENTOR },
    children: [
      { path: 'dashboard', name: 'mentor-dashboard', component: () => import('../pages/mentor/MentorDashboard.vue'), meta: { title: '工作台' } },
      { path: 'students', name: 'mentor-students', component: () => import('../pages/mentor/MentorStudentList.vue'), meta: { title: '我的学生' } },
      { path: 'profile', name: 'mentor-profile', component: () => import('../pages/mentor/MentorProfile.vue'), meta: { title: '个人资料' } },
      { path: 'settings', name: 'mentor-settings', component: () => import('../pages/mentor/MentorSettings.vue'), meta: { title: '设置' } },
      { path: '', redirect: MENTOR_HOME }
    ]
  },
  // ===== 学生 =====
  {
    path: '/student',
    component: StudentLayout,
    meta: { role: ROLE_STUDENT },
    children: [
      { path: 'dashboard', name: 'student-dashboard', component: () => import('../pages/student/StudentDashboard.vue'), meta: { title: '工作台' } },
      { path: 'profile', name: 'student-profile', component: () => import('../pages/student/StudentProfile.vue'), meta: { title: '个人资料' } },
      { path: 'settings', name: 'student-settings', component: () => import('../pages/student/StudentSettings.vue'), meta: { title: '设置' } },
      { path: '', redirect: STUDENT_HOME }
    ]
  },
  // 404 兜底
  { path: '/:pathMatch(.*)*', name: 'notfound', component: NotFoundView }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// 登录守卫：会话校验 + 强制改密拦截 + 角色越权拦截
router.beforeEach((to) => {
  const user = getSessionUser()
  const valid = isSessionValid()

  // 登录页：已登录直接进本角色工作台
  if (to.path === '/login') {
    if (valid && user) return ROLE_HOME[user.role] || '/login'
    return true
  }
  // 强制改密页：仅允许「需改密」的登录用户访问
  if (to.path === '/force-password') {
    if (!valid || !user) return '/login'
    if (!user.mustChangePassword) return ROLE_HOME[user.role] || '/login'
    return true
  }
  // 未登录 / 会话过期
  if (!valid || !user) return '/login'
  // 待改密用户只能停留在强制改密页
  if (user.mustChangePassword) return '/force-password'
  // 角色越权直达：跳回本角色工作台
  const needRole = to.meta && to.meta.role
  if (needRole && needRole !== user.role) {
    return ROLE_HOME[user.role] || '/login'
  }
  return true
})

export default router
