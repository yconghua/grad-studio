import { createRouter, createWebHashHistory } from 'vue-router'
import LoginView from '../pages/auth/LoginView.vue'
import ForcePasswordView from '../pages/auth/ForcePassword.vue'
import HomeLayout from '../layouts/HomeLayout.vue'
import ProfileView from '../pages/profile/index.vue'
import PlaceholderView from '../pages/placeholder/index.vue'
import { navGroups, profileNavItems, childRoles, defaultNavPath, isRoleAllowed } from '../config/navConfig'
import { ROLE_STUDENT } from '../config/constants'
import { useSession } from '../composables/useSession'
import { getCurrentUser } from '../api'

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
import ResearchGraduation from '../pages/research/Graduation.vue'
import ResearchOverview from '../pages/research/ResearchOverview.vue'
import StudioMember from '../pages/studio/Member.vue'
import StudioSeat from '../pages/studio/Seat.vue'
import StudioDevice from '../pages/studio/Device.vue'
import StudioAttendance from '../pages/studio/Attendance.vue'
import StudioDuty from '../pages/studio/Duty.vue'
import StudioRegulation from '../pages/studio/Regulation.vue'
import StudioJoinLeave from '../pages/studio/JoinLeave.vue'
import StudioBorrow from '../pages/studio/Borrow.vue'
import StudioOverview from '../pages/studio/StudioOverview.vue'
import ResourceDoc from '../pages/resource/Doc.vue'
import ResourceDataset from '../pages/resource/Dataset.vue'
import ResourceCode from '../pages/resource/Code.vue'
import ResourceTool from '../pages/resource/Tool.vue'
import ResourceTemplate from '../pages/resource/Template.vue'
import ResourceDrive from '../pages/resource/Drive.vue'
import ResourceLink from '../pages/resource/Link.vue'
import ResourceOverview from '../pages/resource/ResourceOverview.vue'
import CollabMeeting from '../pages/collab/Meeting.vue'
import CollabActivity from '../pages/collab/Activity.vue'
import CollabTask from '../pages/collab/Task.vue'
import CollabForum from '../pages/collab/Forum.vue'
import CollabApproval from '../pages/collab/Approval.vue'
import CollabWeeklyReport from '../pages/collab/WeeklyReport.vue'
import CollabOverview from '../pages/collaboration/CollaborationOverview.vue'
import ReportAchievementStat from '../pages/report/AchievementStat.vue'
import ReportAttendanceStat from '../pages/report/AttendanceStat.vue'
import ReportTaskStat from '../pages/report/TaskStat.vue'
import ReportDeviceStat from '../pages/report/DeviceStat.vue'
import ReportActivityStat from '../pages/report/ActivityStat.vue'
import ReportExport from '../pages/report/Export.vue'
import ReportOverview from '../pages/report/ReportOverview.vue'
import SystemUser from '../pages/system/User.vue'
import SystemAudit from '../pages/system/Audit.vue'
import SystemBackup from '../pages/system/Backup.vue'
import SystemParam from '../pages/system/Param.vue'
import SystemAbout from '../pages/system/About.vue'
import SystemOverview from '../pages/system/SystemOverview.vue'
import ProfileOverview from '../pages/profile/Overview.vue'
import ProfileAcademic from '../pages/profile/Academic.vue'
import ProfileMyProject from '../pages/profile/MyProject.vue'
import ProfileMyAchievement from '../pages/profile/MyAchievement.vue'
import ProfileMyTask from '../pages/profile/MyTask.vue'
import ProfileMySchedule from '../pages/profile/MySchedule.vue'
import ProfileMessage from '../pages/profile/Message.vue'
import ProfileSetting from '../pages/profile/Setting.vue'

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
  'research.graduation': ResearchGraduation,
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
  'collaboration.weekly-report': CollabWeeklyReport,
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

const overviewMap = {
  workbench: WorkbenchOverview,
  research: ResearchOverview,
  studio: StudioOverview,
  resource: ResourceOverview,
  collaboration: CollabOverview,
  report: ReportOverview,
  system: SystemOverview
}

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

const { isSessionValid, clearSession, getSessionUser } = useSession()

const navChildRoutes = navGroups.flatMap((group) =>
  group.children.map((child) => ({
    path: `${group.key}/${child.key}`,
    name: `${group.key}-${child.key}`,
    component: navPageMap[`${group.key}.${child.key}`] || PlaceholderView,
    meta: { title: child.title, roles: childRoles(group, child) }
  }))
)

const navGroupRedirects = navGroups.map((group) => ({
  path: group.key,
  name: `${group.key}-overview`,
  component: overviewMap[group.key] || PlaceholderView,
  meta: { title: group.title, roles: group.roles || null }
}))

const profileTabRoutes = profileNavItems.map((tab) => ({
  path: tab.key,
  name: `profile-${tab.key}`,
  component: profilePageMap[tab.key] || PlaceholderView,
  meta: { title: tab.title }
}))

const routes = [
  { path: '/login', name: 'login', component: LoginView },
  { path: '/force-password', name: 'force-password', component: ForcePasswordView },
  {
    path: '/',
    component: HomeLayout,
    children: [
      { path: '', redirect: defaultNavPath },
      ...navGroupRedirects,
      ...navChildRoutes,
      {
        path: 'profile',
        component: ProfileView,
        children: [
          { path: '', redirect: { name: 'profile-overview' } },
          ...profileTabRoutes
        ]
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../pages/notfound/index.vue')
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

async function checkBackendSession() {
  try {
    const u = await getCurrentUser()
    return u ? true : false
  } catch (e) {
    return 'unknown'
  }
}

router.beforeEach(async (to) => {
  if (!isSessionValid()) {
    clearSession()
    return to.path === '/login' ? true : '/login'
  }
  if (to.path === '/login') {
    const st = await checkBackendSession()
    if (st === false) {
      clearSession()
      return true
    }
    return '/'
  }
  const st = await checkBackendSession()
  if (st === false) {
    clearSession()
    return '/login'
  }
  // 首次登录强制改密：未改密前只允许停留在改密页，其他页面一律拦截
  if (to.path !== '/force-password' && to.path !== '/login') {
    const su = getSessionUser()
    if (su && su.mustChangePassword) {
      return '/force-password'
    }
  }
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
