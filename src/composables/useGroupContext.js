// 课题组上下文：当前操作的 group_id 持久化与读取。
//
// 后端提供 group:listMine（当前登录用户所属课题组，含组内角色）与 group:list（超管全量）。
// 已登录时首次调用本 composable 即自动加载当前用户可见的课题组列表（不依赖组件挂载）：
//   - super_admin：listGroups() 全部课题组；
//   - group_admin / mentor / student：listMyGroups() 所属课题组，自动选中第一个。
// 换账号登录时按用户 id 重新加载，避免沿用上一账号的组列表。
// 页面统一通过 currentGroupId 取当前课题组；页头 <GroupSelector /> 仅超管与组管显示，
// 导师 / 学生由后端归属自动确定，不显示选择器。
import { ref, watch } from 'vue'
import { listGroups, listMyGroups } from '../api'
import { useRole } from './useRole'
import { useSession } from './useSession'

const STORAGE_KEY = 'gra_current_group_id_001'

// 模块级单例：跨页面共享当前课题组选择，避免每页重复拉取
const currentGroupId = ref(Number(localStorage.getItem(STORAGE_KEY)) || null)
const groups = ref([])
const groupsLoaded = ref(false)
// 组列表所属用户 id：切换账号后自动重拉
let loadedForUserId = null
// 进行中的加载 Promise：多个组件并发调用时共享同一次请求
let loadPromise = null

watch(currentGroupId, (v) => {
  if (v) localStorage.setItem(STORAGE_KEY, String(v))
  else localStorage.removeItem(STORAGE_KEY)
})

export function useGroupContext() {
  const { isSuperAdmin } = useRole()
  const { getSessionUser } = useSession()
  const user = getSessionUser()

  // 加载当前用户可见的课题组列表：超管全量，其他角色仅所属组
  // 并发去重：首次调用发起请求，进行中的后续调用共享同一 Promise
  async function loadGroups() {
    const uid = user ? user.id : null
    if (groupsLoaded.value && loadedForUserId === uid) return loadPromise
    if (loadPromise) return loadPromise
    loadPromise = (async () => {
      try {
        const res = isSuperAdmin ? await listGroups() : await listMyGroups()
        if (res && res.success) {
          groups.value = res.groups || []
          groupsLoaded.value = true
          loadedForUserId = uid
          // 未选中或已选中的组不可用时：自动选中第一个
          const hit = groups.value.find((g) => Number(g.id) === currentGroupId.value)
          if (!hit) {
            currentGroupId.value = groups.value.length ? groups.value[0].id : null
          }
        }
      } catch (e) {
        // 加载失败不阻断页面：超管 / 组管仍可手动输入兜底
      } finally {
        loadPromise = null
      }
    })()
    return loadPromise
  }

  // 已登录时首次调用即触发加载（导师 / 学生端无 GroupSelector，不能依赖组件挂载）
  if (user) loadGroups()

  function setGroupId(id) {
    const n = Number(id)
    currentGroupId.value = Number.isFinite(n) && n > 0 ? n : null
  }

  return { currentGroupId, groups, groupsLoaded, loadGroups, setGroupId, isSuperAdmin }
}
