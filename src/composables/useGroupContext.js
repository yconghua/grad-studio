// 课题组上下文：当前操作的 group_id 持久化与读取。
//
// 后端提供 group:listMine（当前登录用户所属课题组，含组内角色）与 group:list（超管全量）。
// 登录后自动加载当前用户可见的课题组列表：
//   - super_admin：listGroups() 全部课题组，下拉选择；
//   - group_admin / mentor / student：listMyGroups() 所属课题组，下拉选择。
// 组列表加载失败或为空时保留手动输入 group_id 兜底。
// 所有需要 group_id 的业务页面统一通过本 composable 取 currentGroupId，
// 并在页头放置 <GroupSelector /> 供切换。
import { ref, watch } from 'vue'
import { listGroups, listMyGroups } from '../api'
import { useRole } from './useRole'

const STORAGE_KEY = 'gra_current_group_id_001'

// 模块级单例：跨页面共享当前课题组选择，避免每页重复拉取
const currentGroupId = ref(Number(localStorage.getItem(STORAGE_KEY)) || null)
const groups = ref([])
const groupsLoaded = ref(false)

watch(currentGroupId, (v) => {
  if (v) localStorage.setItem(STORAGE_KEY, String(v))
  else localStorage.removeItem(STORAGE_KEY)
})

export function useGroupContext() {
  const { isSuperAdmin } = useRole()

  // 加载当前用户可见的课题组列表：超管全量，其他角色仅所属组
  async function loadGroups() {
    if (groupsLoaded.value) return
    try {
      const res = isSuperAdmin ? await listGroups() : await listMyGroups()
      if (res && res.success) {
        groups.value = res.groups || []
        groupsLoaded.value = true
        // 未选中或已选中的组不可用时：自动选中第一个
        const hit = groups.value.find((g) => Number(g.id) === currentGroupId.value)
        if (!hit) {
          currentGroupId.value = groups.value.length ? groups.value[0].id : null
        }
      }
    } catch (e) {
      // 加载失败不阻断页面：用户仍可手动输入
    }
  }

  function setGroupId(id) {
    const n = Number(id)
    currentGroupId.value = Number.isFinite(n) && n > 0 ? n : null
  }

  return { currentGroupId, groups, groupsLoaded, loadGroups, setGroupId, isSuperAdmin }
}
