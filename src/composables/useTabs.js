// 标签页状态管理（组合式函数）：模块级单例，登录后整个应用共享一份标签状态
//
// - tabs：有序标签数组，固定标签（pinned，即本角色工作台）恒在最前、不可关闭、不可拖动
// - activeKey：当前激活标签的 key，key 即路由完整 path（动态路由含参数，不同 id 是不同标签）
// - 持久化：localStorage 保存标签顺序与激活态；登录后恢复，但只保留属于当前角色路由前缀的
//   标签（防止上次账号/角色的脏数据残留）；登出或回到登录页时清空
// - 关闭当前标签时跳转左侧相邻标签（工作台恒在最左，左侧必有落点）
//
// 注意：本模块在 router/index.js 中也被引用（afterEach 进标签、守卫清空标签），
// 因此顶层只创建状态与函数定义，不执行依赖 router 的代码，避免循环初始化问题。

import { ref } from 'vue'
import router from '../router'
import { useSession } from './useSession'
import { ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN, ROLE_MENTOR, ROLE_STUDENT } from '../config/constants'
import { SUPER_ADMIN_HOME } from '../config/nav/super-admin'
import { GROUP_ADMIN_HOME } from '../config/nav/group-admin'
import { MENTOR_HOME } from '../config/nav/mentor'
import { STUDENT_HOME } from '../config/nav/student'

// localStorage 存储 key：结构为 { tabs: Tab[], activeKey: string }
const STORAGE_KEY = 'gra_studio_tabs_v1'

// 角色 → 路由前缀：恢复时只保留当前角色路由树下的标签
const ROLE_PREFIX = {
  [ROLE_SUPER_ADMIN]: '/admin/',
  [ROLE_GROUP_ADMIN]: '/group-admin/',
  [ROLE_MENTOR]: '/mentor/',
  [ROLE_STUDENT]: '/student/'
}

// 角色 → 固定工作台路径（作为 pinned 标签，重建时按当前角色生成）
const ROLE_HOME_PATH = {
  [ROLE_SUPER_ADMIN]: SUPER_ADMIN_HOME,
  [ROLE_GROUP_ADMIN]: GROUP_ADMIN_HOME,
  [ROLE_MENTOR]: MENTOR_HOME,
  [ROLE_STUDENT]: STUDENT_HOME
}

// 模块级单例状态
const tabs = ref([])
const activeKey = ref('')
// 本次会话是否已执行过一次恢复（登录后首次进入布局时恢复，之后不再重复合并）
let restored = false

// 当前登录用户的角色
function currentRole() {
  const user = useSession().getSessionUser()
  return user ? user.role : null
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs: tabs.value, activeKey: activeKey.value }))
  } catch (e) {
    // 存储失败（如隐私模式配额满）静默忽略，标签仍可正常使用，仅不跨重启保留
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || !Array.isArray(data.tabs)) return null
    return data
  } catch (e) {
    return null
  }
}

// 惰性恢复：把上次保存的、属于当前角色的标签合并进 tabs（已存在的 key 跳过），
// 再按当前角色重建 pinned 工作台；恢复只执行一次，重复调用无副作用。
function restoreOnce() {
  if (restored) return
  restored = true
  const saved = load()
  const prefix = currentRole() && ROLE_PREFIX[currentRole()]
  if (!saved || !prefix) return
  for (const t of saved.tabs) {
    if (!t || typeof t.key !== 'string' || t.pinned) continue
    if (!t.key.startsWith(prefix)) continue
    if (tabs.value.some((x) => x.key === t.key)) continue
    tabs.value.push({ key: t.key, path: t.key, title: t.title || t.key, pinned: false })
  }
  if (saved.activeKey && tabs.value.some((t) => t.key === saved.activeKey)) {
    activeKey.value = saved.activeKey
  }
}

// 确保当前角色的固定工作台标签存在且位于最前；激活态无效时回落到工作台
function ensureHomeTab() {
  restoreOnce()
  const role = currentRole()
  const homePath = role ? ROLE_HOME_PATH[role] : null
  if (!homePath) return
  const home = tabs.value.find((t) => t.key === homePath)
  if (home) {
    if (!home.pinned) home.pinned = true
  } else {
    tabs.value.unshift({ key: homePath, path: homePath, title: '工作台', pinned: true })
  }
  // 固定工作台永远在最前（防御：即使被外部改动顺序也拉回来）
  const idx = tabs.value.findIndex((t) => t.key === homePath)
  if (idx > 0) {
    const [home] = tabs.value.splice(idx, 1)
    tabs.value.unshift(home)
  }
  if (!activeKey.value || !tabs.value.some((t) => t.key === activeKey.value)) {
    activeKey.value = homePath
  }
  persist()
}

// 路由切换进入业务页时调用：已存在同 key 仅激活，否则追加到最右边
function addTab(route) {
  const key = route && (route.fullPath || route.path)
  if (!key) return
  ensureHomeTab()
  const exist = tabs.value.find((t) => t.key === key)
  if (exist) {
    activeKey.value = key
    persist()
    return
  }
  const title = (route.meta && route.meta.title) || route.name || key
  tabs.value.push({ key, path: key, title, pinned: false })
  activeKey.value = key
  persist()
}

// 关闭标签：固定标签不可关闭（调用方已拦截，此处再防御一次）；
// 关闭当前标签时先移除，再跳左侧相邻标签（移除后左侧索引即原 idx-1）
function closeTab(key) {
  const idx = tabs.value.findIndex((t) => t.key === key)
  if (idx === -1) return
  const tab = tabs.value[idx]
  if (tab.pinned) return
  const isActive = key === activeKey.value
  tabs.value.splice(idx, 1)
  if (isActive) {
    const left = tabs.value[idx - 1] || tabs.value[0] || null
    if (left) {
      activeKey.value = left.key
      router.push(left.path).catch(() => {})
    } else {
      activeKey.value = ''
    }
  }
  persist()
}

// 拖拽排序后写回新顺序：固定标签恒在最前，其余按拖拽结果排列
function reorder(draggableList) {
  const pinned = tabs.value.filter((t) => t.pinned)
  const ordered = Array.isArray(draggableList) ? draggableList : []
  const rest = ordered.filter((t) => t && !t.pinned)
  // 去重：防止拖拽列表与现有 tabs 不一致时出现重复 key
  const seen = new Set()
  const merged = []
  for (const t of [...pinned, ...rest]) {
    if (!t || seen.has(t.key)) continue
    seen.add(t.key)
    merged.push(t)
  }
  tabs.value = merged
  persist()
}

// 清空标签（登出 / 切换账号 / 会话失效回到登录页时调用），并允许下次登录重新恢复
function clearTabs() {
  tabs.value = []
  activeKey.value = ''
  restored = false
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (e) {
    // 清理失败静默，下次恢复时仍会被角色前缀过滤
  }
}

export function useTabs() {
  return { tabs, activeKey, addTab, closeTab, reorder, restore: restoreOnce, ensureHomeTab, clearTabs }
}
