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
// 页面组件：当前为骨架阶段，业务页面统一指向 pages/<key>/index.vue 的占位实现
// （内部引用 PagePlaceholder 组件），后续按模块逐个替换为真实页面。

import { createRouter, createWebHashHistory } from 'vue-router'
import LoginView from '../pages/auth/LoginView.vue'
import ForcePasswordView from '../pages/auth/ForcePassword.vue'
import HomeLayout from '../layouts/HomeLayout.vue'
import PlaceholderView from '../pages/placeholder/index.vue'
import NotFoundView from '../pages/notfound/index.vue'
import ProfileView from '../pages/profile/index.vue'
import ProfilePasswordView from '../pages/profile/password.vue'
import HelpView from '../pages/help/index.vue'
import { navItems, defaultNavPath, isRoleAllowed } from '../config/navConfig'
import { useSession } from '../composables/useSession'
import { getCurrentUser } from '../api'

const { isSessionValid, clearSession, getSessionUser } = useSession()

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
  // 角色权限：meta.roles 数组与当前角色不匹配 → 打回默认首页
  const roles = to.meta && to.meta.roles
  if (Array.isArray(roles) && roles.length) {
    const u = getSessionUser()
    const r = u && u.role
    if (!r || !isRoleAllowed(roles, r)) {
      return defaultNavPath
    }
  }
  return true
})

export default router
