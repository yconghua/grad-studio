// 应用路由（hash 模式）
//
// 结构：
//   - 登录 / 强制改密（独立于主布局）
//   - 主布局 HomeLayout 下挂载：
//       a) 全部业务菜单路由：由 src/config/navConfig.js 的 navItems 驱动生成，
//          key 即路由 path（platform-users → /platform/users），meta.roles 即角色权限数组，
//          路由守卫按当前角色拦截越权直达；
//       b) 个人中心 /profile（个人资料）与 /profile/password（修改密码）；
//       c) /help 使用帮助。
//   - 404 兜底
//
// 页面组件：业务页面统一懒加载 pages/<key>/index.vue（platform- 前缀为 pages/platform/<子页>/index.vue）。

import { createRouter, createWebHashHistory } from 'vue-router'
import LoginView from '../pages/auth/LoginView.vue'
import ForcePasswordView from '../pages/auth/ForcePassword.vue'
import HomeLayout from '../layouts/HomeLayout.vue'
import NotFoundView from '../pages/notfound/index.vue'
import ProfileView from '../pages/profile/index.vue'
import ProfilePasswordView from '../pages/profile/password.vue'
import HelpView from '../pages/help/index.vue'
import { navItems, defaultNavPath, isRoleAllowed, noGroupOnlyNavPath } from '../config/navConfig'
import { ROLE_MENTOR, ROLE_STUDENT } from '../config/constants'
import { useSession } from '../composables/useSession'
import { useGroupContext } from '../composables/useGroupContext'
import { getCurrentUser } from '../api'

const { isSessionValid, clearSession, getSessionUser } = useSession()
const { groups, loadGroups } = useGroupContext()

// 菜单 key → 路由 path 的映射规则：platform-xxx → /platform/xxx，其余 → /xxx
function keyToPath(key) {
  return '/' + key.replace(/^platform-/, 'platform/')
}

// 菜单 key → 页面组件（懒加载）
// platform- 前缀的 key 对应 pages/platform/<子页>/index.vue，其余对应 pages/<key>/index.vue。
// 动态导入路径中变量只保留一层目录名（vite dev 限制：变量仅代表单层文件名），
// 因此 platform 子页拆成「固定前缀 + 单层变量」的形式，避免两层变量解析失败。
function keyToPage(key) {
  if (key.indexOf('platform-') === 0) {
    const sub = key.replace('platform-', '')
    return () => import(`../pages/platform/${sub}/index.vue`)
  }
  return () => import(`../pages/${key}/index.vue`)
}

// 业务菜单路由（从 navItems 驱动，meta.roles 供守卫做角色校验）
const navRoutes = navItems.map((item) => ({
  path: keyToPath(item.key).replace(/^\//, ''),
  name: item.key,
  component: keyToPage(item.key),
  meta: { title: item.title, roles: item.roles || null }
}))

const routes = [
  { path: '/login', name: 'login', component: LoginView },
  { path: '/force-password', name: 'force-password', component: ForcePasswordView },
  {
    path: '/',
    component: HomeLayout,
    children: [
      { path: '', redirect: defaultNavPath },
      ...navRoutes,
      {
        path: 'profile',
        name: 'profile',
        component: ProfileView,
        meta: { title: '个人资料' }
      },
      {
        path: 'my-messages',
        name: 'my-messages',
        component: () => import('../pages/my-messages/index.vue'),
        meta: { title: '我的消息' }
      },
      {
        path: 'profile/password',
        name: 'profile-password',
        component: ProfilePasswordView,
        meta: { title: '修改密码' }
      },
      {
        path: 'help',
        name: 'help',
        component: HelpView,
        meta: { title: '使用帮助' }
      },
      {
        path: 'about',
        name: 'about',
        component: () => import('../pages/about/index.vue'),
        meta: { title: '系统介绍' }
      }
    ]
  },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// 校验后端会话是否仍然有效（主进程内存态）
async function checkBackendSession() {
  try {
    const u = await getCurrentUser()
    return u ? true : false
  } catch (e) {
    return 'unknown'
  }
}

// 登录后落地页：未加入课题组的导师/学生 → 测试内容页；其余（含课题组管理员）→ 工作台
async function resolveDefaultPath() {
  const u = getSessionUser()
  if (!u) return defaultNavPath
  if (u.role === ROLE_MENTOR || u.role === ROLE_STUDENT) {
    await loadGroups()
    if (groups.value.length === 0) return noGroupOnlyNavPath
  }
  return defaultNavPath
}

// 全局前置守卫：登录态 → 后端会话 → 强制改密 → 角色权限
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
  // 角色权限：meta.roles 数组与当前角色不匹配 → 打回该角色默认落地页
  const roles = to.meta && to.meta.roles
  if (Array.isArray(roles) && roles.length) {
    const u = getSessionUser()
    const r = u && u.role
    if (!r || !isRoleAllowed(roles, r)) {
      return await resolveDefaultPath()
    }
  }
  // 默认落地页非工作台的角色（未入组导师学生）：访问工作台时改跳各自落地页
  const home = await resolveDefaultPath()
  if (to.path === defaultNavPath && home !== defaultNavPath) {
    return home
  }
  return true
})

export default router
