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
import GuideView from '../pages/guide/GuideView.vue'
import GuideProfileView from '../pages/guide/GuideProfileView.vue'
import SuperAdminLayout from '../layouts/SuperAdminLayout.vue'
import GroupAdminLayout from '../layouts/GroupAdminLayout.vue'
import MentorLayout from '../layouts/MentorLayout.vue'
import StudentLayout from '../layouts/StudentLayout.vue'
import NotFoundView from '../pages/notfound/index.vue'
import { useSession } from '../composables/useSession'
import { useTabs } from '../composables/useTabs'
import { getCurrentUser } from '../api/auth'
import { ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN, ROLE_MENTOR, ROLE_STUDENT } from '../config/constants'
import { SUPER_ADMIN_HOME } from '../config/nav/super-admin'
import { GROUP_ADMIN_HOME } from '../config/nav/group-admin'
import { MENTOR_HOME } from '../config/nav/mentor'
import { STUDENT_HOME } from '../config/nav/student'

const { getSessionUser, updateSessionUser, isSessionValid } = useSession()
// 标签页状态单例：afterEach 进标签、守卫清空标签共用同一份状态
const tabsStore = useTabs()

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
  // 引导页布局（顶栏 + 左导航）：未入组 / 未指定导师 / 组管异常未绑定，
  // 引导说明与聊天（全平台功能）都嵌入右内容区
  {
    path: '/guide',
    component: GuideView,
    children: [
      { path: '', name: 'guide-home', component: () => import('../pages/guide/GuideHome.vue'), meta: { title: '引导' } },
      { path: 'chat', name: 'guide-chat', component: () => import('../pages/chat/ChatView.vue'), meta: { title: '聊天' } }
    ]
  },
  // 引导页风格的个人资料：引导状态下点「个人资料」进入，无侧栏，复用公共 ProfileForm
  { path: '/guide/profile', name: 'guide-profile', component: GuideProfileView },
  // ===== 超级管理员 =====
  {
    path: '/admin',
    component: SuperAdminLayout,
    meta: { role: ROLE_SUPER_ADMIN },
    children: [
      { path: 'dashboard', name: 'admin-dashboard', component: () => import('../pages/admin/AdminDashboard.vue'), meta: { title: '工作台' } },
      { path: 'report', name: 'admin-report', component: () => import('../pages/admin/SuperAdminReport.vue'), meta: { title: '周报统计' } },
      { path: 'users', name: 'admin-users', component: () => import('../pages/admin/AdminUserList.vue'), meta: { title: '用户管理' } },
      { path: 'users/:id/edit', name: 'admin-user-edit', component: () => import('../pages/admin/AdminUserEdit.vue'), meta: { title: '编辑用户' } },
      { path: 'groups', name: 'admin-groups', component: () => import('../pages/admin/AdminGroupList.vue'), meta: { title: '课题组设置' } },
      { path: 'group-detail', name: 'admin-group-detail', component: () => import('../pages/admin/AdminGroupDetail.vue'), meta: { title: '课题组详情' } },
      { path: 'task-overview', name: 'admin-task-overview', component: () => import('../pages/task/TaskOverviewView.vue'), meta: { title: '任务总览' } },
      { path: 'notices', name: 'admin-notices', component: () => import('../pages/admin/AdminGroupNotice.vue'), meta: { title: '课题组公告管理' } },
      { path: 'meetings', name: 'admin-meetings', component: () => import('../pages/admin/AdminMeetingList.vue'), meta: { title: '会议记录管理' } },
      { path: 'system', name: 'admin-system', component: () => import('../pages/admin/AdminSystemConfig.vue'), meta: { title: '系统配置' } },
      { path: 'profile', name: 'admin-profile', component: () => import('../pages/admin/AdminProfile.vue'), meta: { title: '个人资料' } },
      { path: 'system-intro', name: 'admin-system-intro', component: () => import('../pages/admin/AdminSystemIntro.vue'), meta: { title: '系统简介' } },
      { path: 'settings', name: 'admin-settings', component: () => import('../pages/admin/AdminSettings.vue'), meta: { title: '设置' } },
      { path: 'chat', name: 'admin-chat', component: () => import('../pages/chat/ChatView.vue'), meta: { title: '聊天' } },
      { path: 'notifications', name: 'admin-notifications', component: () => import('../pages/notification/NotificationCenter.vue'), meta: { title: '通知中心' } },
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
      { path: 'report', name: 'group-admin-report', component: () => import('../pages/group-admin/GroupAdminReport.vue'), meta: { title: '组内周报' } },
      { path: 'group', name: 'group-admin-group', component: () => import('../pages/group-admin/GroupAdminGroupSetting.vue'), meta: { title: '课题组设置' } },
      { path: 'members', name: 'group-admin-members', component: () => import('../pages/group-admin/GroupAdminMemberManage.vue'), meta: { title: '课题组成员' } },
      { path: 'notices', name: 'group-admin-notices', component: () => import('../pages/group-admin/GroupAdminGroupNotice.vue'), meta: { title: '本组公告管理' } },
      { path: 'meetings', name: 'group-admin-meetings', component: () => import('../pages/group-admin/GroupAdminMeetingList.vue'), meta: { title: '本组会议管理' } },
      { path: 'tasks', name: 'group_admin-tasks', component: () => import('../pages/task/TaskListView.vue'), meta: { title: '任务管理' } },
      { path: 'tasks/create', name: 'group_admin-task-create', component: () => import('../pages/task/TaskCreateView.vue'), meta: { title: '创建任务' } },
      { path: 'profile', name: 'group-admin-profile', component: () => import('../pages/group-admin/GroupAdminProfile.vue'), meta: { title: '个人资料' } },
      { path: 'system-intro', name: 'group-admin-system-intro', component: () => import('../pages/group-admin/GroupAdminSystemIntro.vue'), meta: { title: '系统简介' } },
      { path: 'settings', name: 'group-admin-settings', component: () => import('../pages/group-admin/GroupAdminSettings.vue'), meta: { title: '设置' } },
      { path: 'chat', name: 'group-admin-chat', component: () => import('../pages/chat/ChatView.vue'), meta: { title: '聊天' } },
      { path: 'notifications', name: 'group-admin-notifications', component: () => import('../pages/notification/NotificationCenter.vue'), meta: { title: '通知中心' } },
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
      { path: 'report', name: 'mentor-report', component: () => import('../pages/mentor/MentorReport.vue'), meta: { title: '周报批阅' } },
      { path: 'students', name: 'mentor-students', component: () => import('../pages/mentor/MentorStudentList.vue'), meta: { title: '我的学生' } },
      { path: 'notices', name: 'mentor-notices', component: () => import('../pages/mentor/MentorGroupNotice.vue'), meta: { title: '课题组公告' } },
      { path: 'meetings', name: 'mentor-meetings', component: () => import('../pages/mentor/MentorMeetingList.vue'), meta: { title: '会议记录' } },
      { path: 'tasks', name: 'mentor-tasks', component: () => import('../pages/task/TaskListView.vue'), meta: { title: '任务' } },
      { path: 'tasks/create', name: 'mentor-task-create', component: () => import('../pages/task/TaskCreateView.vue'), meta: { title: '创建任务' } },
      { path: 'profile', name: 'mentor-profile', component: () => import('../pages/mentor/MentorProfile.vue'), meta: { title: '个人资料' } },
      { path: 'system-intro', name: 'mentor-system-intro', component: () => import('../pages/mentor/MentorSystemIntro.vue'), meta: { title: '系统简介' } },
      { path: 'settings', name: 'mentor-settings', component: () => import('../pages/mentor/MentorSettings.vue'), meta: { title: '设置' } },
      { path: 'chat', name: 'mentor-chat', component: () => import('../pages/chat/ChatView.vue'), meta: { title: '聊天' } },
      { path: 'notifications', name: 'mentor-notifications', component: () => import('../pages/notification/NotificationCenter.vue'), meta: { title: '通知中心' } },
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
      { path: 'report', name: 'student-report', component: () => import('../pages/student/StudentReport.vue'), meta: { title: '我的周报' } },
      { path: 'notes', name: 'student-notes', component: () => import('../pages/student/StudentNotes.vue'), meta: { title: '我的笔记' } },
      { path: 'notices', name: 'student-notices', component: () => import('../pages/student/StudentGroupNotice.vue'), meta: { title: '课题组公告' } },
      { path: 'meetings', name: 'student-meetings', component: () => import('../pages/student/StudentMeetingList.vue'), meta: { title: '会议记录' } },
      { path: 'tasks', name: 'student-tasks', component: () => import('../pages/task/TaskListView.vue'), meta: { title: '我的任务' } },
      { path: 'profile', name: 'student-profile', component: () => import('../pages/student/StudentProfile.vue'), meta: { title: '个人资料' } },
      { path: 'system-intro', name: 'student-system-intro', component: () => import('../pages/student/StudentSystemIntro.vue'), meta: { title: '系统简介' } },
      { path: 'settings', name: 'student-settings', component: () => import('../pages/student/StudentSettings.vue'), meta: { title: '设置' } },
      { path: 'chat', name: 'student-chat', component: () => import('../pages/chat/ChatView.vue'), meta: { title: '聊天' } },
      { path: 'notifications', name: 'student-notifications', component: () => import('../pages/notification/NotificationCenter.vue'), meta: { title: '通知中心' } },
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

// 引导页判定：按角色与组/导师绑定状态计算是否需要引导
// mentor/student：groupId 为空 → 未入组；student 已入组但未指定导师 → 未指定导师；
// group_admin：groupId 为空（账号未绑定课题组，异常态）→ 兜底引导。
// 超管不属于任何组，不参与判定。
export function guideStateOf(user) {
  if (!user) return null
  if (user.role === ROLE_MENTOR || user.role === ROLE_STUDENT) {
    if (!user.groupId) return user.role === ROLE_MENTOR ? 'mentor-no-group' : 'student-no-group'
    if (user.role === ROLE_STUDENT && !user.mentorId) return 'student-no-mentor'
  }
  if (user.role === ROLE_GROUP_ADMIN && !user.groupId) return 'admin-no-group'
  return null
}

// 引导状态下的放行路径：引导页本身（含嵌入的聊天页）+ 引导页风格的个人资料页
// （其他页面一律重定向引导页）；各角色个人资料页（/mentor/profile 等嵌套在角色布局内、
// 带侧栏）在引导状态下统一重定向到 /guide/profile，避免引导用户被带出左侧导航。
const GUIDE_ALLOWED_PATHS = ['/guide', '/guide/chat', '/guide/profile']
const GUIDE_ROLE_PROFILE_PATHS = ['/mentor/profile', '/student/profile', '/group-admin/profile']

// 登录守卫：会话校验 + 强制改密拦截 + 角色越权拦截 + 引导页判定
router.beforeEach(async (to) => {
  let user = getSessionUser()
  const valid = isSessionValid()

  // 登录页：已登录直接进本角色工作台；未登录进入（登出/会话过期/切换账号失败）
  // 时清空标签存储，避免下次登录恢复出上个账号的标签
  if (to.path === '/login') {
    if (valid && user) return ROLE_HOME[user.role] || '/login'
    tabsStore.clearTabs()
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

  // 引导页判定：导师/学生/组管每次导航用主进程实时回库的用户刷新会话快照
  // （不重置过期时间），会话期间被移出组/重新入组后下一次导航即按最新状态判断
  if (user.role === ROLE_MENTOR || user.role === ROLE_STUDENT || user.role === ROLE_GROUP_ADMIN) {
    try {
      const res = await getCurrentUser()
      if (res && res.success && res.data) {
        user = res.data
        updateSessionUser(user)
      }
    } catch (e) {
      // 拉取失败沿用会话快照，不阻断导航
    }
  }
  const guideState = guideStateOf(user)
  if (guideState) {
    // 引导状态下只放行引导页本身 + 引导页风格的个人资料页；
    // 访问嵌套在角色布局内的个人资料页时重定向到无侧栏版本
    if (GUIDE_ALLOWED_PATHS.includes(to.path)) return true
    if (GUIDE_ROLE_PROFILE_PATHS.includes(to.path)) return '/guide/profile'
    return '/guide'
  }
  // 无需引导但目标是引导页：回本角色工作台
  if (to.path === '/guide') return ROLE_HOME[user.role] || '/login'

  return true
})

// 标签页联动：每次导航完成后，命中业务页则打开/激活对应标签
// 判定：路径位于四个角色路由前缀下即为业务页；登录/改密/引导/404 天然不匹配自动跳过，
// meta.tab === false 作为显式排除的后备开关（当前路由未使用）
router.afterEach((to) => {
  if (to.name === 'notfound') return
  if (to.meta && to.meta.tab === false) return
  if (!/^\/(admin|group-admin|mentor|student)\//.test(to.path)) return
  tabsStore.addTab(to)
})

export default router
