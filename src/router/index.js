import { createRouter, createWebHashHistory } from 'vue-router'
import LoginView from '../pages/auth/LoginView.vue'
import HomeLayout from '../layouts/HomeLayout.vue'
import ProfileView from '../pages/profile/index.vue'
import PlaceholderView from '../pages/placeholder/index.vue'
import { navGroups, profileNavItems, childRoles, groupDefaultPath, defaultNavPath } from '../config/navConfig'
import { useSession } from '../composables/useSession'
import { getCurrentUser } from '../api'

// 各二级导航 key -> 真实页面组件 的映射（`一级key.二级key`），未登记的回退到占位页
import WorkbenchOverview from '../pages/workbench/Overview.vue'
import WorkbenchTodo from '../pages/workbench/Todo.vue'
import WorkbenchSchedule from '../pages/workbench/Schedule.vue'
import WorkbenchNotice from '../pages/workbench/Notice.vue'
import WorkbenchShortcuts from '../pages/workbench/Shortcuts.vue'
import ResearchProject from '../pages/research/Project.vue'
import ResearchPaper from '../pages/research/Paper.vue'
import ResearchPatent from '../pages/research/Patent.vue'
import ResearchSubject from '../pages/research/Subject.vue'
import ResearchLog from '../pages/research/ResearchLog.vue'
import ResearchAchievement from '../pages/research/Achievement.vue'
import ResearchFund from '../pages/research/Fund.vue'
import StudioMember from '../pages/studio/Member.vue'
import StudioSeat from '../pages/studio/Seat.vue'
import StudioDevice from '../pages/studio/Device.vue'
import StudioAttendance from '../pages/studio/Attendance.vue'
import StudioDuty from '../pages/studio/Duty.vue'
import StudioRegulation from '../pages/studio/Regulation.vue'
import StudioJoinLeave from '../pages/studio/JoinLeave.vue'
import StudioBorrow from '../pages/studio/Borrow.vue'
import ResourceDoc from '../pages/resource/Doc.vue'
import ResourceDataset from '../pages/resource/Dataset.vue'
import ResourceCode from '../pages/resource/Code.vue'
import ResourceTool from '../pages/resource/Tool.vue'
import ResourceTemplate from '../pages/resource/Template.vue'
import ResourceDrive from '../pages/resource/Drive.vue'
import ResourceLink from '../pages/resource/Link.vue'
import CollabMeeting from '../pages/collab/Meeting.vue'
import CollabActivity from '../pages/collab/Activity.vue'
import CollabTask from '../pages/collab/Task.vue'
import CollabForum from '../pages/collab/Forum.vue'
import CollabApproval from '../pages/collab/Approval.vue'
import ReportAchievementStat from '../pages/report/AchievementStat.vue'
import ReportAttendanceStat from '../pages/report/AttendanceStat.vue'
import ReportTaskStat from '../pages/report/TaskStat.vue'
import ReportDeviceStat from '../pages/report/DeviceStat.vue'
import ReportActivityStat from '../pages/report/ActivityStat.vue'
import ReportExport from '../pages/report/Export.vue'
import SystemUser from '../pages/system/User.vue'
import SystemAudit from '../pages/system/Audit.vue'
import SystemBackup from '../pages/system/Backup.vue'
import SystemParam from '../pages/system/Param.vue'
import SystemAbout from '../pages/system/About.vue'
import ProfileOverview from '../pages/profile/Overview.vue'
import ProfileAcademic from '../pages/profile/Academic.vue'
import ProfileMyProject from '../pages/profile/MyProject.vue'
import ProfileMyAchievement from '../pages/profile/MyAchievement.vue'
import ProfileMyTask from '../pages/profile/MyTask.vue'
import ProfileMySchedule from '../pages/profile/MySchedule.vue'
import ProfileMessage from '../pages/profile/Message.vue'
import ProfileSetting from '../pages/profile/Setting.vue'

// 左侧二级导航页面映射
const navPageMap = {
  'workbench.overview': WorkbenchOverview,
  'workbench.todo': WorkbenchTodo,
  'workbench.schedule': WorkbenchSchedule,
  'workbench.notice': WorkbenchNotice,
  'workbench.shortcuts': WorkbenchShortcuts,
  'research.project': ResearchProject,
  'research.paper': ResearchPaper,
  'research.patent': ResearchPatent,
  'research.subject': ResearchSubject,
  'research.log': ResearchLog,
  'research.achievement': ResearchAchievement,
  'research.fund': ResearchFund,
  'studio.member': StudioMember,
  'studio.seat': StudioSeat,
  'studio.device': StudioDevice,
  'studio.attendance': StudioAttendance,
  'studio.duty': StudioDuty,
  'studio.regulation': StudioRegulation,
  'studio.join-leave': StudioJoinLeave,
  'studio.borrow': StudioBorrow,
  'resource.doc': ResourceDoc,
  'resource.dataset': ResourceDataset,
  'resource.code': ResourceCode,
  'resource.tool': ResourceTool,
  'resource.template': ResourceTemplate,
  'resource.drive': ResourceDrive,
  'resource.link': ResourceLink,
  'collaboration.meeting': CollabMeeting,
  'collaboration.activity': CollabActivity,
  'collaboration.task': CollabTask,
  'collaboration.forum': CollabForum,
  'collaboration.approval': CollabApproval,
  'report.achievement-stat': ReportAchievementStat,
  'report.attendance-stat': ReportAttendanceStat,
  'report.task-stat': ReportTaskStat,
  'report.device-stat': ReportDeviceStat,
  'report.activity-stat': ReportActivityStat,
  'report.export': ReportExport,
  'system.user': SystemUser,
  'system.audit': SystemAudit,
  'system.backup': SystemBackup,
  'system.param': SystemParam,
  'system.update': SystemAbout
}

// 个人主页页签页面映射
const profilePageMap = {
  overview: ProfileOverview,
  academic: ProfileAcademic,
  'my-project': ProfileMyProject,
  'my-achievement': ProfileMyAchievement,
  'my-task': ProfileMyTask,
  'my-schedule': ProfileMySchedule,
  message: ProfileMessage,
  setting: ProfileSetting
}

// 登录守卫需要会话判断；useSession 内部为纯函数（无生命周期钩子），可在此直接调用
const { isSessionValid, clearSession, getSessionUser } = useSession()

// 二级小导航路由：/groupKey/childKey（如 workbench/overview → /workbench/overview）
// 组件按 navPageMap 映射到真实页面，未登记的 key 回退到占位组件；meta.roles 取「子项 roles 优先、否则继承一级导航 roles」
const navChildRoutes = navGroups.flatMap((group) =>
  group.children.map((child) => ({
    path: `${group.key}/${child.key}`,
    name: `${group.key}-${child.key}`,
    component: navPageMap[`${group.key}.${child.key}`] || PlaceholderView,
    meta: { title: child.title, roles: childRoles(group, child) }
  }))
)

// 一级大导航落地路由：/groupKey 重定向到该组默认二级导航
const navGroupRedirects = navGroups.map((group) => ({
  path: group.key,
  redirect: groupDefaultPath(group)
}))

// 个人主页页签路由：/profile/<key>（容器由 ProfileView 提供，页签为独立子路由）
// 组件按 profilePageMap 映射到真实页面，未登记的 key 回退到占位组件
const profileTabRoutes = profileNavItems.map((tab) => ({
  path: tab.key,
  name: `profile-${tab.key}`,
  component: profilePageMap[tab.key] || PlaceholderView,
  meta: { title: tab.title }
}))

const routes = [
  { path: '/login', name: 'login', component: LoginView },
  {
    path: '/',
    component: HomeLayout,
    children: [
      { path: '', redirect: defaultNavPath },
      ...navGroupRedirects,
      ...navChildRoutes,
      {
        // 个人主页：容器（标题 + 页签导航）挂 RouterView，各页签为独立子路由
        path: 'profile',
        component: ProfileView,
        children: [
          { path: '', redirect: { name: 'profile-overview' } },
          ...profileTabRoutes
        ]
      }
    ]
  },
  // 404 兜底：必须放在最后，未匹配路径显示独立 404 页
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../pages/notfound/index.vue')
  }
]

const router = createRouter({
  // hash 模式：打包后走 file:// 也能直接定位子路由，不会白屏
  history: createWebHashHistory(),
  routes
})

// 登录守卫：先校验本地会话（localStorage 过期时间），再校验后端会话
// + 后端会话校验：后端明确未登录（getCurrentUser 返回 null）时清理本地会话并回登录页；
//   IPC 失败（后端未就绪等）按 unknown 降级放行，不误杀本地会话。
// + 角色守卫：meta.roles 标记的页面，当前用户角色不在允许列表时弹回默认首页。

// 三态：true=后端已登录；false=后端明确未登录；'unknown'=IPC 失败无法判断
async function checkBackendSession() {
  try {
    const u = await getCurrentUser()
    return u ? true : false
  } catch (e) {
    return 'unknown'
  }
}

router.beforeEach(async (to) => {
  // 分支1：本地会话已失效 → 清除陈旧登录态，跳回登录页（同步，不发 IPC）
  if (!isSessionValid()) {
    clearSession()
    return to.path === '/login' ? true : '/login'
  }
  // 分支2：已停在登录页且本地会话有效 → 顺便校验后端，再决定是否放行到首页
  if (to.path === '/login') {
    const st = await checkBackendSession()
    if (st === false) {
      // 后端已不认这个会话：清掉陈旧本地会话，留在登录页
      clearSession()
      return true
    }
    // true 或 unknown：放行到首页
    return '/'
  }
  // 分支3：业务页 → 校验后端会话，明确未登录则清理并回登录页
  const st = await checkBackendSession()
  if (st === false) {
    clearSession()
    return '/login'
  }
  // st === true 或 unknown：继续放行
  // 分支4：角色守卫 → meta.roles 存在且非空时，当前用户角色必须在允许列表中
  const roles = to.meta && to.meta.roles
  if (Array.isArray(roles) && roles.length) {
    const u = getSessionUser()
    const r = u && u.role
    if (!r || !roles.includes(r)) {
      return defaultNavPath
    }
  }
  return true
})

export default router
