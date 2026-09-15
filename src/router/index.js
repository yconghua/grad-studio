import { createRouter, createWebHashHistory } from 'vue-router'
import LoginView from '../pages/auth/LoginView.vue'
import HomeLayout from '../layouts/HomeLayout.vue'
import HomePageView from '../pages/home/index.vue'
import ProfileView from '../pages/profile/index.vue'
// 个人主页各页签（独立路由，可直达 / 前进后退）
import ProfileInfoTab from '../pages/profile/tabs/info.vue'
import ProfileUsersTab from '../pages/profile/tabs/users.vue'
import ProfileSysTab from '../pages/profile/tabs/sys.vue'
import ProfileWeblinksTab from '../pages/profile/tabs/weblinks.vue'
// 各业务模块的子页面（每个小导航栏一个独立文件，不复用通用占位）
import moduleAOne from '../pages/module-a/page-one.vue'
import moduleATwo from '../pages/module-a/page-two.vue'
import moduleBOne from '../pages/module-b/page-one.vue'
import moduleCOne from '../pages/module-c/page-one.vue'
import moduleCTwo from '../pages/module-c/page-two.vue'
import evacSim from '../pages/evacuation/simulation.vue'
import aboutIntro from '../pages/about/intro.vue'
import aboutGuide from '../pages/about/guide.vue'
import aboutFeedback from '../pages/about/feedback.vue'
import aboutContact from '../pages/about/contact.vue'
// 各分组落地页（大导航点击跳转：pages/<大组文件夹>/index.vue）
import moduleAIndex from '../pages/module-a/index.vue'
import moduleBIndex from '../pages/module-b/index.vue'
import moduleCIndex from '../pages/module-c/index.vue'
import evacIndex from '../pages/evacuation/index.vue'
import aboutIndex from '../pages/about/index.vue'
import { navTopItems, navGroups, defaultNavPath } from '../config/navConfig'
import { ROLE_ADMIN } from '../config/constants'
import { useSession } from '../composables/useSession'
import { getCurrentUser } from '../api'

// 登录守卫需要会话判断；useSession 内部为纯函数（无生命周期钩子），可在此直接调用
const { isSessionValid, clearSession, getSessionUser } = useSession()

// 顶部独立导航项路由（如「首页」）；当前仅有首页，均指向 HomePageView
// 后续新增顶部项时，在此按 item.key 映射对应页面组件
const navTopRoutes = navTopItems.map((item) => ({
  path: item.key,
  name: item.key,
  component: HomePageView,
  meta: { title: item.title }
}))

// 子项 key → 组件 映射：新增子导航时在此登记对应页面组件（key 与 pages对应文件夹里面的 vue 对应）
const childComponentMap = {
  'mod-a-1': moduleAOne,
  'mod-a-2': moduleATwo,
  'mod-b-1': moduleBOne,
  'mod-c-1': moduleCOne,
  'mod-c-2': moduleCTwo,
  'evac-sim': evacSim,
  'about-intro': aboutIntro,
  'about-guide': aboutGuide,
  'about-feedback': aboutFeedback,
  'about-contact': aboutContact
}

// 分组 key → 组件 映射：大导航点击跳转到各分组落地页（key 与 pages/<大组文件夹>/index.vue 对应）
const groupComponentMap = {
  'module-a': moduleAIndex,
  'module-b': moduleBIndex,
  'module-c': moduleCIndex,
  'evac': evacIndex,
  'about': aboutIndex
}

// 分组落地页路由：由 navGroups 生成，path 为分组 key（如 module-a → /module-a），与子项路由并列挂载在 / 下
const groupRoutes = navGroups
  .filter((g) => g.key && groupComponentMap[g.key])
  .map((g) => ({
    path: g.key,
    name: g.key,
    component: groupComponentMap[g.key],
    meta: { title: g.title }
  }))

// 由导航配置生成下拉子路由：每个子项映射到各自的独立页面组件（标题取自 config）
const navChildren = navGroups.flatMap((group) =>
  group.children.map((child) => ({
    path: child.key,
    name: child.key,
    component: childComponentMap[child.key],
    meta: { title: child.title }
  }))
)

const routes = [
  { path: '/login', name: 'login', component: LoginView },
  {
    path: '/',
    component: HomeLayout,
    children: [
      { path: '', redirect: defaultNavPath },
      ...navTopRoutes,
      ...groupRoutes,
      ...navChildren,
      {
        // 个人主页：容器（标题 + 页签导航）挂 RouterView，各页签为独立子路由
        path: 'profile',
        component: ProfileView,
        children: [
          // 裸 /profile 默认落到「个人信息」
          { path: '', redirect: { name: 'profile-info' } },
          {
            path: 'info',
            name: 'profile-info',
            component: ProfileInfoTab,
            meta: { title: '个人信息' }
          },
          {
            path: 'users',
            name: 'profile-users',
            component: ProfileUsersTab,
            meta: { title: '用户管理', adminOnly: true }
          },
          {
            path: 'sys',
            name: 'profile-sys',
            component: ProfileSysTab,
            meta: { title: '系统管理', adminOnly: true }
          },
          {
            path: 'weblinks',
            name: 'profile-weblinks',
            component: ProfileWeblinksTab,
            meta: { title: '网址收藏夹' }
          }
        ]
      }
    ]
  },
  // 404 兜底：必须放在最后，未匹配路径显示独立 404 页（未登录时仍会被上面的登录守卫拦到 /login）
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
// + 仅管理员页面守卫：meta.adminOnly 标记的页面，普通用户一律弹回「个人信息」

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
      // 后端已不认这个会话：清掉陈旧本地会话，留在登录页（return true 避免重复导航）
      clearSession()
      return true
    }
    // true 或 unknown：放行到首页（unknown 为降级策略，不误杀本地会话）
    return '/'
  }
  // 分支3：业务页 → 校验后端会话，明确未登录则清理并回登录页
  const st = await checkBackendSession()
  if (st === false) {
    clearSession()
    return '/login'
  }
  // st === true 或 unknown：继续放行
  // 分支4：仅管理员页面 → 用本地用户角色判断（unknown 时降级为本地角色判断）
  if (to.meta && to.meta.adminOnly) {
    const u = getSessionUser()
    if (!u || u.role !== ROLE_ADMIN) {
      return { name: 'profile-info' }
    }
  }
  return true
})

export default router
